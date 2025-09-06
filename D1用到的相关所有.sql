CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS play_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  cover TEXT NOT NULL,
  year TEXT NOT NULL,
  index_episode INTEGER NOT NULL,
  total_episodes INTEGER NOT NULL,
  play_time INTEGER NOT NULL,
  total_time INTEGER NOT NULL,
  save_time INTEGER NOT NULL,
  search_title TEXT,
  UNIQUE(username, key)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  cover TEXT NOT NULL,
  year TEXT NOT NULL,
  total_episodes INTEGER NOT NULL,
  save_time INTEGER NOT NULL,
  UNIQUE(username, key)
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  keyword TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(username, keyword)
);

CREATE TABLE IF NOT EXISTS admin_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS skip_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  source TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  segments TEXT NOT NULL,
  updated_time INTEGER NOT NULL,
  UNIQUE(username, key)
);

-- 基本索引
CREATE INDEX IF NOT EXISTS idx_play_records_username ON play_records(username);
CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username);
CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username ON skip_configs(username);

-- 复合索引优化查询性能
-- 播放记录：用户名+键值的复合索引，用于快速查找特定记录
CREATE INDEX IF NOT EXISTS idx_play_records_username_key ON play_records(username, key);
-- 播放记录：用户名+保存时间的复合索引，用于按时间排序的查询
CREATE INDEX IF NOT EXISTS idx_play_records_username_save_time ON play_records(username, save_time DESC);

-- 收藏：用户名+键值的复合索引，用于快速查找特定收藏
CREATE INDEX IF NOT EXISTS idx_favorites_username_key ON favorites(username, key);
-- 收藏：用户名+保存时间的复合索引，用于按时间排序的查询
CREATE INDEX IF NOT EXISTS idx_favorites_username_save_time ON favorites(username, save_time DESC);

-- 搜索历史：用户名+关键词的复合索引，用于快速查找/删除特定搜索记录
CREATE INDEX IF NOT EXISTS idx_search_history_username_keyword ON search_history(username, keyword);
-- 搜索历史：用户名+创建时间的复合索引，用于按时间排序的查询
CREATE INDEX IF NOT EXISTS idx_search_history_username_created_at ON search_history(username, created_at DESC);

-- 搜索历史清理查询的优化索引
CREATE INDEX IF NOT EXISTS idx_search_history_username_id_created_at ON search_history(username, id, created_at DESC);

-- 跳过配置索引
-- 跳过配置：用户名+键值的复合索引，用于快速查找特定配置
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_key ON skip_configs(username, key);
-- 跳过配置：用户名+更新时间的复合索引，用于按时间排序的查询
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_updated_time ON skip_configs(username, updated_time DESC);


-- 创建跳过配置表
CREATE TABLE IF NOT EXISTS skip_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  source TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  segments TEXT NOT NULL,
  updated_time INTEGER NOT NULL,
  UNIQUE(username, key)
);

-- 为跳过配置添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_skip_configs_username ON skip_configs(username);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_key ON skip_configs(username, key);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_updated_time ON skip_configs(username, updated_time DESC);


-- 检查表是否存在
SELECT name FROM sqlite_master WHERE type='table' AND name='skip_configs';

-- 检查表结构
PRAGMA table_info(skip_configs);

-- 检查索引是否创建
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='skip_configs';


-- D1 数据库初始化脚本
-- 用于创建 KatelyaTV 所需的数据表

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 播放记录表
CREATE TABLE IF NOT EXISTS play_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  record_key TEXT NOT NULL,
  video_url TEXT,
  current_time REAL DEFAULT 0,
  duration REAL DEFAULT 0,
  episode_index INTEGER DEFAULT 0,
  episode_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, record_key)
);

-- 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  favorite_key TEXT NOT NULL,
  title TEXT,
  cover_url TEXT,
  rating REAL,
  year TEXT,
  area TEXT,
  category TEXT,
  actors TEXT,
  director TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, favorite_key)
);

-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 跳过配置表
CREATE TABLE IF NOT EXISTS skip_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_key TEXT NOT NULL,
  start_time INTEGER DEFAULT 0,
  end_time INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, config_key)
);

-- 管理员配置表
CREATE TABLE IF NOT EXISTS admin_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认管理员配置
INSERT OR IGNORE INTO admin_configs (config_key, config_value, description) VALUES
('site_name', 'JiabanTV', '站点名称'),
('site_description', '高性能影视播放平台', '站点描述'),
('enable_register', 'true', '是否允许用户注册'),
('max_users', '100', '最大用户数量'),
('cache_ttl', '3600', '缓存时间（秒）');

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_play_records_user_id ON play_records(user_id);
CREATE INDEX IF NOT EXISTS idx_play_records_record_key ON play_records(record_key);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_skip_configs_user_id ON skip_configs(user_id);

-- 创建视图以简化查询
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
  u.id,
  u.username,
  COUNT(DISTINCT pr.id) as play_count,
  COUNT(DISTINCT f.id) as favorite_count,
  COUNT(DISTINCT sh.id) as search_count,
  u.created_at
FROM users u
LEFT JOIN play_records pr ON u.id = pr.user_id
LEFT JOIN favorites f ON u.id = f.user_id
LEFT JOIN search_history sh ON u.id = sh.user_id
GROUP BY u.id, u.username, u.created_at;


-- D1 数据库迁移脚本：修复 admin_config 表名问题
-- 将旧的 admin_config 表数据迁移到新的 admin_configs 表结构

-- 首先确保新的 admin_configs 表存在
CREATE TABLE IF NOT EXISTS admin_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 检查是否存在旧的 admin_config 表
-- 如果存在，迁移数据到新表
INSERT OR IGNORE INTO admin_configs (config_key, config_value, description)
SELECT 
  'main_config' as config_key,
  config as config_value,
  '从旧表迁移的主要管理员配置' as description
FROM admin_config 
WHERE id = 1;

-- 插入默认管理员配置（如果不存在）
INSERT OR IGNORE INTO admin_configs (config_key, config_value, description) VALUES
('site_name', 'JiabanTV', '站点名称'),
('site_description', '高性能影视播放平台', '站点描述'),
('enable_register', 'true', '是否允许用户注册'),
('max_users', '100', '最大用户数量'),
('cache_ttl', '3600', '缓存时间（秒）');

-- 可选：删除旧表（请谨慎使用，建议先备份数据）
-- DROP TABLE IF EXISTS admin_config;


-- 删除现有的不兼容表
DROP TABLE IF EXISTS user_settings;

-- 创建与代码完全兼容的表结构
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  settings TEXT NOT NULL,
  updated_time INTEGER NOT NULL
);

-- 添加必要索引
CREATE INDEX IF NOT EXISTS idx_user_settings_username ON user_settings(username);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_time ON user_settings(updated_time DESC);




CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  filter_adult_content BOOLEAN DEFAULT 1,
  theme TEXT DEFAULT 'auto',
  language TEXT DEFAULT 'zh-CN',
  auto_play BOOLEAN DEFAULT 1,
  video_quality TEXT DEFAULT 'auto',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, username)
);


-- 为用户设置添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_username ON user_settings(username);


-- 插入设置数据（请替换 'your_username' 为实际用户名）
INSERT INTO user_settings (
  user_id,
  username,
  filter_adult_content,
  theme,
  language,
  auto_play,
  video_quality,
  updated_at
) VALUES (
  1,                  -- 假设 admin 的 user_id = 1
  'admin',
  1,                  -- filter_adult_content = true
  'auto',
  'zh-CN',
  1,                  -- auto_play = true
  'auto',
  CURRENT_TIMESTAMP
);


-- 验证数据插入成功
SELECT * FROM user_settings WHERE username = 'admin';

-- 创建跳过配置表
CREATE TABLE IF NOT EXISTS skip_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_key TEXT NOT NULL,
  start_time INTEGER DEFAULT 0,
  end_time INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, config_key)
);

-- 为跳过配置添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_skip_configs_user_id ON skip_configs(user_id);

-- 检查 user_settings 表是否存在
SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings';

-- 检查 skip_configs 表是否存在
SELECT name FROM sqlite_master WHERE type='table' AND name='skip_configs';

-- 查看 user_settings 表结构
PRAGMA table_info(user_settings);

-- 查看 skip_configs 表结构
PRAGMA table_info(skip_configs);

-- 检查表是否存在
SELECT name FROM sqlite_master WHERE type='table' AND name='skip_configs';

-- 检查表结构
PRAGMA table_info(skip_configs);

-- 检查索引是否创建
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='skip_configs';
