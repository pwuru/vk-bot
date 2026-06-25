const { VK } = require('vk-io');

const TOKEN = 'process.env.VK_TOKEN';

const vk = new VK({
    token: TOKEN
});

vk.updates.start()
    .then(() => {
        console.log('Бот запущен и готов к работе!');
        console.log('Отправьте сообщение в группу, чтобы проверить');
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