-- V16: 用户表（Phase 7 账号体系）
-- 表名 app_user 避开 PostgreSQL 保留字 user
CREATE TABLE IF NOT EXISTS app_user (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password      VARCHAR(128) NOT NULL,             -- BCrypt 哈希
    display_name  VARCHAR(64),
    role          VARCHAR(16)  NOT NULL DEFAULT 'USER',  -- USER / ADMIN
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_user_username ON app_user (username);

-- 种子管理员账号（password = BCrypt("admin123")，上线前必须改密码）
-- 哈希由 BCryptPasswordEncoder（round=10）生成，Spring Security 可直接验证
INSERT INTO app_user (username, password, display_name, role)
VALUES ('admin', '$2b$10$ypvcuPu9n0jddgcvpO6CCehp2xMk13kLmkmhppt1xAp9gyMrckLaW', '管理员', 'ADMIN')
ON CONFLICT (username) DO NOTHING;
