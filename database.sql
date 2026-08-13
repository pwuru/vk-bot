-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 13, 2026 at 01:28 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `vk-bot`
--

-- --------------------------------------------------------

--
-- Table structure for table `addons`
--

CREATE TABLE `addons` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Название товара',
  `category` enum('drink','sauce','extra') NOT NULL COMMENT 'Категория',
  `price` decimal(10,2) DEFAULT 0.00 COMMENT 'Цена',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Доступен ли для заказа',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Дата добавления'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Дополнительные товары';

--
-- Dumping data for table `addons`
--

INSERT INTO `addons` (`id`, `name`, `category`, `price`, `is_active`, `created_at`) VALUES
(1, 'Кока-Кола 0.5л', 'drink', 120.00, 1, '2026-06-25 15:51:39'),
(2, 'Спрайт 0.5л', 'drink', 120.00, 1, '2026-06-25 15:51:39'),
(3, 'Соус барбекю', 'sauce', 50.00, 1, '2026-06-25 15:51:39'),
(4, 'Соус чесночный', 'sauce', 50.00, 1, '2026-06-25 15:51:39'),
(5, 'Добавить сыр', 'extra', 60.00, 1, '2026-06-25 15:51:39'),
(6, 'Добавить грибы', 'extra', 70.00, 1, '2026-06-25 15:51:39');

-- --------------------------------------------------------

--
-- Table structure for table `dialog_states`
--

CREATE TABLE `dialog_states` (
  `user_id` int(11) NOT NULL COMMENT 'ID пользователя',
  `state` varchar(50) NOT NULL DEFAULT 'new' COMMENT 'Текущее состояние диалога',
  `collected_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Собранные данные в формате JSON' CHECK (json_valid(`collected_data`)),
  `last_message` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Время последнего сообщения'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Состояния диалогов';

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'ID пользователя',
  `name` varchar(100) NOT NULL COMMENT 'Имя клиента',
  `phone` varchar(20) NOT NULL COMMENT 'Телефон клиента',
  `address` text NOT NULL COMMENT 'Адрес доставки (полностью, как написал пользователь)',
  `pizza_type` varchar(100) NOT NULL COMMENT 'Тип пиццы',
  `pizza_size` varchar(20) DEFAULT '30 см' COMMENT 'Размер пиццы',
  `quantity` int(11) DEFAULT 1 COMMENT 'Количество',
  `price` decimal(10,2) DEFAULT 0.00 COMMENT 'Общая цена',
  `comment` text DEFAULT NULL COMMENT 'Комментарий/пожелания к заказу',
  `status` enum('new','confirmed','cooking','delivering','delivered','cancelled') DEFAULT 'new' COMMENT 'Статус заказа',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Время создания',
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Время обновления',
  `delivered_at` datetime DEFAULT NULL COMMENT 'Время доставки',
  `delivery_time` varchar(10) DEFAULT NULL COMMENT 'Желаемое время доставки'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Заказы пиццы';

--
-- Table structure for table `pizza_types`
--

CREATE TABLE `pizza_types` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Название пиццы',
  `description` text DEFAULT NULL COMMENT 'Описание',
  `price` decimal(10,2) DEFAULT 0.00 COMMENT 'Цена (средняя)',
  `ingredients` text DEFAULT NULL COMMENT 'Ингредиенты',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Доступна ли для заказа',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Дата добавления'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Типы пиццы';

--
-- Dumping data for table `pizza_types`
--

INSERT INTO `pizza_types` (`id`, `name`, `description`, `price`, `ingredients`, `is_active`, `created_at`) VALUES
(1, 'Маргарита', 'Классическая итальянская пицца с томатным соусом и моцареллой', 450.00, 'Томатный соус, моцарелла, базилик, оливковое масло', 1, '2026-06-25 15:51:39'),
(2, 'Пепперони', 'Пицца с острым салями и сыром', 550.00, 'Томатный соус, моцарелла, пепперони, орегано', 1, '2026-06-25 15:51:39'),
(3, 'Гавайская', 'Пицца с курицей и ананасами', 500.00, 'Томатный соус, моцарелла, курица, ананас, соус барбекю', 1, '2026-06-25 15:51:39'),
(4, 'Четыре сыра', 'Пицца с четырьмя видами сыра', 600.00, 'Томатный соус, моцарелла, пармезан, горгонзола, фета, орегано', 1, '2026-06-25 15:51:39'),
(5, 'Диабло', 'Острая пицца с колбасками и перцем чили', 580.00, 'Томатный соус, моцарелла, пепперони, перец чили, острый соус', 1, '2026-06-25 15:51:39'),
(6, 'Мексиканская', 'Пицца с острыми колбасками и овощами', 530.00, 'Томатный соус, моцарелла, чоризо, перец халапеньо, кукуруза, фасоль', 1, '2026-06-25 15:51:39'),
(7, 'Вегетарианская', 'Пицца с овощами и грибами', 480.00, 'Томатный соус, моцарелла, грибы, болгарский перец, лук, оливки, базилик', 1, '2026-06-25 15:51:39'),
(8, 'Сырная', 'Пицца с увеличенным количеством сыра', 520.00, 'Томатный соус, моцарелла, чеддер, пармезан, сливочный сыр', 1, '2026-06-25 15:51:39');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `vk_id` varchar(50) NOT NULL COMMENT 'ID пользователя ВКонтакте',
  `name` varchar(100) DEFAULT NULL COMMENT 'Имя пользователя',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Номер телефона',
  `address` text DEFAULT NULL COMMENT 'Сохраненный адрес доставки',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Дата регистрации',
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Дата обновления'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Пользователи бота';

--
-- Indexes for dumped tables
--

--
-- Indexes for table `addons`
--
ALTER TABLE `addons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_category` (`category`);

--
-- Indexes for table `dialog_states`
--
ALTER TABLE `dialog_states`
  ADD PRIMARY KEY (`user_id`),
  ADD KEY `idx_state` (`state`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `pizza_types`
--
ALTER TABLE `pizza_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vk_id` (`vk_id`),
  ADD KEY `idx_vk_id` (`vk_id`),
  ADD KEY `idx_phone` (`phone`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `addons`
--
ALTER TABLE `addons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `pizza_types`
--
ALTER TABLE `pizza_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `dialog_states`
--
ALTER TABLE `dialog_states`
  ADD CONSTRAINT `dialog_states_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
