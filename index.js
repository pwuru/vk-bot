require('dotenv').config();
const { VK } = require('vk-io');
const mysql = require('mysql2/promise');

const TOKEN = 'process.env.VK_TOKEN';

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

async function getOrCreateUser(vkId, name) {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE vk_id = ?',
            [vkId.toString()]
        );
        
        if (rows.length > 0) {
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

function extractPhone(text) {
    const match = text.match(/\b(\d{10,11})\b/);
    if (match) {
        const phone = match[1];
        if (phone.length === 11 && !phone.startsWith('8') && !phone.startsWith('7')) {
            return null;
        }
        return phone;
    }
    return null;
}

function extractName(text) {
    const patterns = [
        /имя\s+([А-ЯЁ][а-яё]+)/i,
        /\bя\b\s+([А-ЯЁ][а-яё]+)/i,
        /меня зовут\s+([А-ЯЁ][а-яё]+)/i,
        /зовут\s+([А-ЯЁ][а-яё]+)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

function extractPizzaType(text) {
    const types = [
        { base: 'маргарит', result: 'Маргарита' },
        { base: 'пепперони', result: 'Пепперони' },
        { base: 'гавайск', result: 'Гавайская' },
        { base: 'четыре сыра', result: 'Четыре сыра' },
        { base: 'диабло', result: 'Диабло' },
        { base: 'мексиканск', result: 'Мексиканская' },
        { base: 'вегетарианск', result: 'Вегетарианская' },
        { base: 'сырн', result: 'Сырная' }
    ];
    
    const lowerText = text.toLowerCase();
    for (const type of types) {
        if (lowerText.includes(type.base)) {
            return type.result;
        }
    }
    return null;
}

function extractTime(text) {
    const patterns = [
        /время\s+(\d{1,2})[:.](\d{2})/i,
        /в\s+(\d{1,2})[:.](\d{2})/i,
        /к\s+(\d{1,2})[:.](\d{2})/i,
        /на\s+(\d{1,2})[:.](\d{2})/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }
    }
    return null;
}

function extractAddress(text) {
    const patterns = [
        /адрес\s*:\s*(.+)/i,
        /адрес\s+(.+)/i,
        /по адресу\s*:\s*(.+)/i,
        /по адресу\s+(.+)/i,
        /доставка\s*:\s*(.+)/i,
        /доставка\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let address = match[1].trim();
            address = address.replace(/\d{1,2}[:.]\d{2}/g, '');
            address = address.replace(/\bвремя\b\s*/gi, '');
            address = address.replace(/\bв\b\s*/gi, '');
            address = address.replace(/\bк\b\s*/gi, '');
            address = address.replace(/\bна\b\s*/gi, '');
            address = address.replace(/время\s*/gi, '');
            address = address.replace(/в\s*/gi, '');
            address = address.replace(/к\s*/gi, '');
            address = address.replace(/на\s*/gi, '');
            address = address.replace(/^[,.\s]+/, '').replace(/[,.\s]+$/, '');
            return address || null;
        }
    }
    return null;
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
                '- Ваше имя (используйте маркер "имя")\n' +
                '- Телефон (10 или 11 цифр подряд)\n' +
                '- Адрес доставки (используйте маркер "адрес")\n' +
                '- Желаемое время доставки (необязательно)\n\n' +
                'Пример: "Хочу пепперони, зовут Михаил, 89991234567, адрес: ул. Ленина, 15, 19:30"');
            return;
        }

        const phone = extractPhone(text);
        const name = extractName(text);
        const pizzaType = extractPizzaType(text);
        const deliveryTime = extractTime(text);
        const address = extractAddress(text);
        
        console.log('Извлеченные данные:', { phone, name, pizzaType, address, deliveryTime });

        const missingFields = [];
        if (!name) missingFields.push('имя (используйте маркер "имя")');
        if (!phone) missingFields.push('телефон (10 или 11 цифр)');
        if (!address) missingFields.push('адрес (используйте маркер "адрес")');
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
            
            await context.send(response);
            return;
        }

        const user = await getOrCreateUser(userId, firstName);
        if (!user) {
            await context.send('Ошибка базы данных. Попробуйте позже.');
            return;
        }
        
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