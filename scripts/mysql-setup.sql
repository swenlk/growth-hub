-- Run this as a MySQL administrator (root), not as the keycloak user.
-- Replace change-me with the same value as KC_DB_PASSWORD before you run it.
--
-- The account is @'%' so the Keycloak container can connect. An account that
-- exists only as 'keycloak'@'localhost' is not enough.
--
-- MySQL must accept connections from the Docker network, not only 127.0.0.1.
-- In my.ini / my.cnf, bind-address should be 0.0.0.0 or *. Restart MySQL
-- after changing it. Docker Desktop on Windows sometimes reaches a
-- loopback-only server; if Keycloak cannot connect, this is the first place
-- to check.

CREATE DATABASE IF NOT EXISTS `growth-hub` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'growth-hub'@'%' IDENTIFIED BY 'GrowthHub@123';

GRANT ALL PRIVILEGES ON `growth-hub`.* TO 'growth-hub'@'%';
FLUSH PRIVILEGES;
