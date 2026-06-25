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
    
    console.log(`Получено сообщение от ${userId}: ${text}`);

    try {
        await context.send('Привет! Я бот для заказа пиццы!');
        console.log(`Ответ отправлен пользователю ${userId}`);
    } catch (error) {
        console.error('Ошибка отправки:', error);
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Необработанная ошибка:', error);
});

console.log('Бот запускается...');