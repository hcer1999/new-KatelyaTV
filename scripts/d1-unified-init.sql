-- KatelyaTV 统一数据库初始化脚本
-- 用于创建与代码完全兼容的 D1 数据库表结构
-- 解决多版本表定义不一致的问题

-- 删除可能存在的旧表（谨慎使用，建议先备份数据）
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS play_records;
-- DROP TABLE IF EXISTS favorites;
-- DROP TABLE IF EXISTS search_history;
-- DROP TABLE IF EXISTS admin_config;
-- DROP TABLE IF EXISTS admin_configs;
-- DROP TABLE IF EXISTS skip_configs;
-- DROP TABLE IF EXISTS user_settings;

-- 1. 用户表 - 使用 username 作为主键（与代码匹配）
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 2. 播放记录表 - 字段与 D1Storage 代码完全匹配
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

-- 3. 收藏表 - 字段与 D1Storage 代码完全匹配
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

-- 4. 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  keyword TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(username, keyword)
);

-- 5. 管理员配置表 - 使用新的结构
CREATE TABLE IF NOT EXISTS admin_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 6. 跳过配置表 - 与 D1Storage 代码匹配
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

-- 7. 用户设置表 - 使用 JSON 存储格式（与 D1Storage 代码匹配）
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  settings TEXT NOT NULL,
  updated_time INTEGER NOT NULL
);

-- 创建索引以优化查询性能
-- 播放记录索引
CREATE INDEX IF NOT EXISTS idx_play_records_username ON play_records(username);
CREATE INDEX IF NOT EXISTS idx_play_records_username_key ON play_records(username, key);
CREATE INDEX IF NOT EXISTS idx_play_records_username_save_time ON play_records(username, save_time DESC);

-- 收藏索引
CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username);
CREATE INDEX IF NOT EXISTS idx_favorites_username_key ON favorites(username, key);
CREATE INDEX IF NOT EXISTS idx_favorites_username_save_time ON favorites(username, save_time DESC);

-- 搜索历史索引
CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username);
CREATE INDEX IF NOT EXISTS idx_search_history_username_keyword ON search_history(username, keyword);
CREATE INDEX IF NOT EXISTS idx_search_history_username_created_at ON search_history(username, created_at DESC);

-- 跳过配置索引
CREATE INDEX IF NOT EXISTS idx_skip_configs_username ON skip_configs(username);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_key ON skip_configs(username, key);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_updated_time ON skip_configs(username, updated_time DESC);

-- 用户设置索引
CREATE INDEX IF NOT EXISTS idx_user_settings_username ON user_settings(username);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_time ON user_settings(updated_time DESC);

-- 插入默认管理员配置
INSERT OR IGNORE INTO admin_configs (config_key, config_value, description) VALUES
('site_name', 'JiabanTV', '站点名称'),
('site_description', '高性能影视播放平台', '站点描述'),
('enable_register', 'true', '是否允许用户注册'),
('max_users', '100', '最大用户数量'),
('cache_ttl', '3600', '缓存时间（秒）');

-- 验证表结构
SELECT 'Tables created successfully:' as message;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- 验证索引
SELECT 'Indexes created successfully:' as message;
SELECT name FROM sqlite_master WHERE type='index' ORDER BY name;
