CREATE TABLE IF NOT EXISTS failed_logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45),
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
