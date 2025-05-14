-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 06, 2025 at 01:49 PM
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
-- Database: `crypterhelper_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `action_type` enum('key_generation','key_recovery','file_upload','file_download') DEFAULT NULL,
  `timestamp` datetime DEFAULT current_timestamp(),
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `username`, `action_type`, `timestamp`, `description`) VALUES
(1, 'test1', '', '2025-05-03 16:57:17', 'Encryption key was generated successfully.'),
(2, 'test1', '', '2025-05-03 16:57:28', 'Encryption key was generated successfully.'),
(3, 'test1', 'key_recovery', '2025-05-03 16:57:37', 'Encryption key was recovered successfully.');

-- --------------------------------------------------------

--
-- Table structure for table `educational_materials`
--

CREATE TABLE `educational_materials` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `type` enum('Security Guidelines','Key Management') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `educational_materials`
--

INSERT INTO `educational_materials` (`id`, `title`, `content`, `type`, `created_at`) VALUES
(1, 'Security Guidelines', '1. Use Strong Passwords: Always create passwords with a mix of upper and lowercase letters, numbers, and special characters. Avoid using easily guessable information.\r\n\r\n2. Beware of Phishing and Social Engineering: Do not click on suspicious links or share your login information via email or phone.\r\n\r\n3. Secure Your Devices: Ensure that your devices are protected with a password or biometric authentication and always lock your device when not in use.\r\n\r\n4. Keep Software and Systems Updated: Regularly update your software to patch any security vulnerabilities.\r\n\r\n5. Backup Your Data: Regularly back up important data to prevent loss in case of system failure or attacks.\r\n\r\n6. Monitor Your Account Activity: Regularly review your login and activity logs for any suspicious actions.', 'Security Guidelines', '2025-04-27 13:57:34'),
(2, 'How to Manage Keys', '1. Passphrase for Key Generation: Ensure you use a strong passphrase (aim for at least 12 characters, using a combination of uppercase and lowercase letters, numbers, and symbols) when generating the encryption key\r\n\r\n2. Key Generation: Always generate your encryption keys using strong, secure methods within the app. Never share your encryption keys with others.\r\n\r\n3. Storing Encryption Keys: Do not store your encryption keys in unprotected or easily accessible locations. Use secure storage solutions.\r\n\r\n4. Key Backup: Ensure you have a secure backup of your keys, especially if you plan to use them across multiple devices.\r\n\r\n5. Key Recovery: Follow the app\'s process for key recovery if you lose your encryption key.\r\n\r\n6. Key Expiry & Revocation: Rotate your keys regularly, and revoke or replace keys if compromised.\r\n\r\n7. Sharing Keys: If you need to share keys, ensure they are transferred securely through encrypted channels.\r\n\r\n8. Monitor Key Usage: Regularly review the use of your encryption keys to ensure they are being used appropriately and securely.', 'Key Management', '2025-04-27 13:57:34');

-- --------------------------------------------------------

--
-- Table structure for table `files`
--

CREATE TABLE `files` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `file_name` int(255) NOT NULL,
  `file_path` int(11) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

CREATE TABLE `support_tickets` (
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `reply` varchar(255) NOT NULL,
  `status` enum('open','not_resolved','resolved') DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL DEFAULT 'end_user',
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `plan_type` varchar(255) NOT NULL,
  `status` enum('enabled','disabled') DEFAULT 'enabled',
  `passphrase_hash` varchar(255) DEFAULT NULL,
  `kdf_salt` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `role`, `password_hash`, `email`, `plan_type`, `status`, `passphrase_hash`, `kdf_salt`) VALUES
(12, 'test12', 'end_user', '$2y$10$NDjTgx5cTMikZLbxd0RC1e0n6v0klJ6p.VrVLkUgCGTIv0U.taF8e', 'test12@gmail.com', 'free', 'enabled', NULL, '8fa09b3f0a0bd1b85ae858fa9cd2a4719d950c72f03b4f70721835dc2bc0de50'),
(13, 'test13', 'end_user', '$2y$10$iQuQvgQfJFh1oW/0uSgvD.s5psx/BvFGAfkxmpNlSDKCqfsk9w0e6', 'test13@gmail.com', 'free', 'enabled', NULL, '362a11617ef1976387fc9319f44ce7be2ce4ecdc6e124eeef8c8e53570c9ebd5'),
(14, 'test1', 'end_user', '$2y$10$yJ4/n1NansyTsHCVMLOwieUjeuD86DjaWmcCfFT0Y7w7COgcm63LS', 'test1@gmail.com', 'free', 'enabled', '$2b$10$P4uu4K5ByAxApsM/Oe7Rw.32asc9BGF5VsLXt.9s8q0JO6d9AMPsG', '5ff9b9f068ef61e4fd3266c6befc38ed9f483d62c887f3eebf36c436af05525a'),
(15, 'test2', 'end_user', '$2y$10$9YURGKYRipjj6SkyGlhmk.nbHFd7q286T7nXhzf8lG1kmqahwFfzS', 'test2@gmail.com', 'free', 'enabled', '$2b$10$7.jUmywvGjIQWIdQqUNc8uoeMLfys41mRU834RsMbDt/APClvcY7K', 'b51ff714816d63c0b566b07f9548d82b04b9210d09c0941709580e4e71d58387');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `educational_materials`
--
ALTER TABLE `educational_materials`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `files`
--
ALTER TABLE `files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_user_id` (`user_id`);

--
-- Indexes for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD PRIMARY KEY (`ticket_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `educational_materials`
--
ALTER TABLE `educational_materials`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `files`
--
ALTER TABLE `files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `support_tickets`
--
ALTER TABLE `support_tickets`
  MODIFY `ticket_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `files`
--
ALTER TABLE `files`
  ADD CONSTRAINT `fk_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `support_tickets`
--
ALTER TABLE `support_tickets`
  ADD CONSTRAINT `support_tickets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
