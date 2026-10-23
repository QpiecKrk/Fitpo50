CREATE TABLE IF NOT EXISTS entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(600) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  lead TEXT,
  content LONGTEXT NOT NULL,
  status ENUM('draft','published','hidden') NOT NULL DEFAULT 'draft',
  video_source VARCHAR(16) NOT NULL DEFAULT 'none',
  youtube_video_id VARCHAR(32),
  youtube_orientation VARCHAR(12) NOT NULL DEFAULT 'horizontal',
  uploaded_video_filename VARCHAR(300),
  uploaded_video_mime VARCHAR(100),
  uploaded_video_orientation VARCHAR(12) NOT NULL DEFAULT 'horizontal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at DATETIME,
  html_file VARCHAR(300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  filename VARCHAR(300) NOT NULL,
  original_name VARCHAR(300),
  mime_type VARCHAR(100),
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS failed_logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45),
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
