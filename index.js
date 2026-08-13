require('dotenv').config();
const { VK } = require('vk-io');
const mysql = require('mysql2/promise');
const axios = require('axios');

const TOKEN = process.env.VK_TOKEN;

const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const YANDEX_API_KEY = process.env.YANDEX_API_KEY;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function checkDB() {
    try {
        const [rows] = await pool.query('SELECT 1');
        console.log('База данных подключена');
        return true;
    } catch (error) {
        console.error('Ошибка подключения к БД:', error.message);
        return false;
    }
}

async function getDialogState(userId) {
    try {
        const [rows] = await pool.query(
            'SELECT state, collected_data FROM dialog_states WHERE user_id = ?',
            [userId]
        );
        if (rows.length > 0) {
            return {
                state: rows[0].state,
                collectedData: rows[0].collected_data ? JSON.parse(rows[0].collected_data) : {}
            };
        }
        return { state: 'new', collectedData: {} };
    } catch (error) {
        console.error('Ошибка в getDialogState:', error);
        return { state: 'new', collectedData: {} };
    }
}

async function saveDialogState(userId, state, collectedData) {
    try {
        await pool.query(
            `INSERT INTO dialog_states (user_id, state, collected_data) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             state = VALUES(state), 
             collected_data = VALUES(collected_data),
             last_message = CURRENT_TIMESTAMP`,
            [userId, state, JSON.stringify(collectedData)]
        );
        return true;
    } catch (error) {
        console.error('Ошибка в saveDialogState:', error);
        return false;
    }
}

async function clearDialogState(userId) {
    try {
        await pool.query(
            'DELETE FROM dialog_states WHERE user_id = ?',
            [userId]
        );
        return true;
    } catch (error) {
        console.error('Ошибка в clearDialogState:', error);
        return false;
    }
}

async function getOrCreateUser(vkId, name) {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE vk_id = ?',
            [vkId.toString()]
        );
        
        if (rows.length > 0) {
            if (name && rows[0].name !== name) {
                await pool.query(
                    'UPDATE users SET name = ? WHERE vk_id = ?',
                    [name, vkId.toString()]
                );
            }
            return rows[0];
        }
        
        const [result] = await pool.query(
            'INSERT INTO users (vk_id, name) VALUES (?, ?)',
            [vkId.toString(), name || null]
        );
        
        const [newUser] = await pool.query(
            'SELECT * FROM users WHERE id = ?',
            [result.insertId]
        );
        
        return newUser[0];
    } catch (error) {
        console.error('Ошибка в getOrCreateUser:', error);
        return null;
    }
}

async function createOrder(userId, orderData) {
    try {
        const [result] = await pool.query(
            `INSERT INTO orders 
             (user_id, name, phone, address, pizza_type, pizza_size, quantity, price, comment, delivery_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                orderData.name || null,
                orderData.phone || null,
                orderData.address || null,
                orderData.pizza_type || null,
                orderData.pizza_size || '30 см',
                orderData.quantity || 1,
                orderData.price || 0,
                orderData.comment || null,
                orderData.delivery_time || null
            ]
        );
        return result.insertId;
    } catch (error) {
        console.error('Ошибка в createOrder:', error);
        return null;
    }
}

async function extractEntitiesWithYandex(text) {
    try {
        const prompt = `Ты — ассистент для извлечения данных из сообщений пользователя.

Извлеки из текста следующие данные и верни их строго в формате JSON с полями:
- name: имя человека (если указано)
- phone: номер телефона (если указан)
- address: адрес доставки (если указан)
- pizza_type: тип пиццы (если указан)
- delivery_time: время доставки (если указано)

Если какое-то поле отсутствует в тексте, верни для него null.

Важно: ВНИМАТЕЛЬНО анализируй текст. Пользователь может писать недостающие данные отдельными сообщениями. Например, в сообщении "адрес култукская 11" нужно извлечь address: "култукская 11".

Текст: "${text}"`;

        const response = await axios.post(
            'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
            {
                modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite/latest`,
                completionOptions: {
                    stream: false,
                    temperature: 0.1,
                    maxTokens: 300
                },
                messages: [
                    {
                        role: 'system',
                        text: 'Ты извлекаешь данные из текста. Возвращай только чистый JSON без Markdown, без пояснений, без кавычек вокруг JSON. Используй только поля: name, phone, address, pizza_type, delivery_time. Всегда возвращай JSON, даже если данные неполные. Для отсутствующих полей используй null.'
                    },
                    {
                        role: 'user',
                        text: prompt
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Api-Key ${YANDEX_API_KEY}`,
                    'x-folder-id': YANDEX_FOLDER_ID,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        let result = response.data.result.alternatives[0].message.text;
        
        console.log('Ответ Yandex:', result);
        
        result = result.replace(/```json\s*/gi, '');
        result = result.replace(/```\s*/gi, '');
        result = result.trim();
        
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            result = jsonMatch[0];
        }
        
        return JSON.parse(result);
    } catch (error) {
        console.error('Ошибка при запросе к Yandex:', error.message);
        if (error.response) {
            console.error('Ответ Yandex с ошибкой:', JSON.stringify(error.response.data, null, 2));
        }
        return null;
    }
}

const vk = new VK({
    token: TOKEN
});

vk.updates.start()
    .then(async () => {
        console.log('Бот запущен и готов к работе!');
        console.log('Отправьте сообщение в группу, чтобы проверить');
        await checkDB();
    })
    .catch((error) => {
        console.error('Ошибка запуска:', error);
    });

vk.updates.on('message_new', async (context) => {
    if (context.isGroup) return;
    
    const userId = context.senderId;
    const text = context.text || '';

    let firstName = null;
    try {
        if (context.sender && context.sender.firstName) {
            firstName = context.sender.firstName;
        }
    } catch (e) {}
    
    console.log(`Получено сообщение от ${userId}: ${text}`);
    
    try {
        const orderKeywords = ['пицц', 'заказ', 'хочу', 'доставк', 'нужн', 'привези', 'закаж'];
        const hasOrderKeyword = orderKeywords.some(keyword => text.toLowerCase().includes(keyword));

        if (!hasOrderKeyword && text.length < 10) {
            await context.send('Привет! Я бот для заказа пиццы!\n\n' +
                'Напишите одним сообщением:\n' +
                '- Какую пиццу хотите\n' +
                '- Ваше имя\n' +
                '- Телефон (10 или 11 цифр подряд)\n' +
                '- Адрес доставки\n' +
                '- Желаемое время доставки (необязательно)\n\n' +
                'Пример: "Хочу пепперони, зовут Михаил, 89991234567, адрес: ул. Ленина, 15, 19:30"');
            return;
        }

        const user = await getOrCreateUser(userId, firstName);
        if (!user) {
            await context.send('Ошибка базы данных. Попробуйте позже.');
            return;
        }

        const dialogState = await getDialogState(user.id);
        let collectedData = dialogState.collectedData || {};

        const extracted = await extractEntitiesWithYandex(text);
        
        if (!extracted) {
            await context.send('Сервер анализа временно недоступен. Попробуйте позже.');
            return;
        }

        if (extracted.name) collectedData.name = extracted.name;
        if (extracted.phone) collectedData.phone = extracted.phone;
        if (extracted.address) collectedData.address = extracted.address;
        if (extracted.pizza_type) collectedData.pizza_type = extracted.pizza_type;
        if (extracted.delivery_time) collectedData.delivery_time = extracted.delivery_time;

        const phone = collectedData.phone || null;
        const name = collectedData.name || null;
        const pizzaType = collectedData.pizza_type || null;
        const deliveryTime = collectedData.delivery_time || null;
        const address = collectedData.address || null;

        console.log('Собранные данные:', { phone, name, pizzaType, address, deliveryTime });

        const missingFields = [];
        if (!name) missingFields.push('имя');
        if (!phone) missingFields.push('телефон (10 или 11 цифр)');
        if (!address) missingFields.push('адрес');
        if (!pizzaType) missingFields.push('тип пиццы');

        if (missingFields.length > 0) {
            let response = 'Не хватает данных для заказа:\n';
            missingFields.forEach((field, index) => {
                response += `${index + 1}. ${field}\n`;
            });
            response += '\nПожалуйста, напишите недостающую информацию.';
            
            if (name) response += `\nИмя: ${name}`;
            if (phone) response += `\nТелефон: ${phone}`;
            if (address) response += `\nАдрес: ${address}`;
            if (pizzaType) response += `\nПицца: ${pizzaType}`;
            if (deliveryTime) response += `\nВремя: ${deliveryTime}`;
            
            await saveDialogState(user.id, 'collecting', collectedData);
            await context.send(response);
            return;
        }

        await clearDialogState(user.id);
        
        const orderId = await createOrder(user.id, {
            name: name,
            phone: phone,
            address: address,
            pizza_type: pizzaType,
            comment: text,
            delivery_time: deliveryTime || null
        });
        
        if (orderId) {
            let response = `Заказ #${orderId} оформлен!\n\n` +
                `Детали заказа:\n` +
                `- Пицца: ${pizzaType}\n` +
                `- Имя: ${name}\n` +
                `- Телефон: ${phone}\n` +
                `- Адрес: ${address}\n`;
            
            if (deliveryTime) {
                response += `- Желаемое время: ${deliveryTime}\n`;
            } else {
                response += `- Доставка: как можно скорее\n`;
            }
            
            response += `\nДоставим в ближайшее время!`;
            
            await context.send(response);
            console.log(`Заказ #${orderId} создан для пользователя ${userId}`);
        } else {
            await context.send('Ошибка при создании заказа. Попробуйте позже.');
        }
        
    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
        await context.send('Произошла ошибка. Попробуйте позже.');
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Необработанная ошибка:', error);
});

console.log('Бот запускается...');