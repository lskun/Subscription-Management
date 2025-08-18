-- =====================================================
-- 完整的 Supabase 数据库架构文档
-- 创建时间: 2025-01-04
-- 描述: 订阅管理系统的完整数据库结构、触发器、函数和说明
-- =====================================================

-- 本文件仅作为文档用途，不执行任何实际的数据库操作
-- 所有表结构、触发器和函数都已通过之前的迁移文件创建

/*
=======================================================
数据库概览
=======================================================

本数据库为订阅管理系统设计，包含以下主要功能模块：
1. 用户认证和授权 (auth schema)
2. 用户资料管理 (user_profiles)
3. 订阅管理 (subscriptions, categories, payment_methods)
4. 支付历史 (payment_history)
5. 汇率管理 (exchange_rates, exchange_rate_history)
6. 通知系统 (user_notifications, notification_templates)
7. 邮件系统 (email_logs, email_templates, email_queue)
8. 管理员系统 (admin_users, admin_roles, admin_sessions, admin_operation_logs)
9. 系统监控 (system_health, system_stats, system_logs)
10. 用户设置 (user_settings, user_email_preferences)
11. 调度任务系统 (scheduler_jobs, scheduler_job_runs)

=======================================================
已安装的扩展
=======================================================

-- 核心扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";        -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- 加密函数
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- SQL 统计
CREATE EXTENSION IF NOT EXISTS "pg_net";           -- HTTP 客户端
CREATE EXTENSION IF NOT EXISTS "pg_graphql";       -- GraphQL 支持
CREATE EXTENSION IF NOT EXISTS "supabase_vault";   -- Supabase Vault
CREATE EXTENSION IF NOT EXISTS "pg_cron";          -- 定时任务调度

=======================================================
认证相关表 (auth schema)
=======================================================
*/

-- auth.users - 用户基础信息表
-- 由 Supabase 自动管理，包含用户认证信息
-- 主要字段：id, email, encrypted_password, email_confirmed_at, created_at, updated_at

-- auth.sessions - 用户会话表
-- 存储用户登录会话信息
-- 主要字段：id, user_id, created_at, updated_at, not_after

-- auth.refresh_tokens - 刷新令牌表
-- 存储 JWT 刷新令牌
-- 主要字段：id, token, user_id, revoked, created_at, updated_at

-- auth.identities - 身份认证表
-- 存储用户的身份认证信息（邮箱、OAuth等）
-- 主要字段：id, user_id, provider, provider_id, identity_data

-- auth.mfa_factors - 多因素认证因子表
-- 存储 MFA 认证因子
-- 主要字段：id, user_id, friendly_name, factor_type, status

-- auth.mfa_challenges - MFA 挑战表
-- 存储 MFA 认证挑战
-- 主要字段：id, factor_id, created_at, verified_at

-- auth.mfa_amr_claims - MFA AMR 声明表
-- 存储多因素认证方法引用声明
-- 主要字段：session_id, created_at, updated_at, authentication_method

-- auth.flow_state - 流程状态表
-- 存储 PKCE 登录的元数据
-- 主要字段：id, user_id, auth_code, code_challenge_method

-- auth.one_time_tokens - 一次性令牌表
-- 存储一次性使用的令牌
-- 主要字段：id, user_id, token_type, token_hash, relates_to

-- auth.sso_providers - SSO 提供商表
-- 管理 SSO 身份提供商信息
-- 主要字段：id, resource_id, created_at, updated_at

-- auth.sso_domains - SSO 域名表
-- 管理 SSO 邮箱域名映射
-- 主要字段：id, sso_provider_id, domain, created_at, updated_at

-- auth.saml_providers - SAML 提供商表
-- 管理 SAML 身份提供商连接
-- 主要字段：id, sso_provider_id, entity_id, metadata_xml

-- auth.saml_relay_states - SAML 中继状态表
-- 包含每个服务提供商发起的登录的 SAML 中继状态信息
-- 主要字段：id, sso_provider_id, request_id, for_email

-- auth.audit_log_entries - 审计日志表
-- 用户操作的审计跟踪
-- 主要字段：id, payload, created_at, ip_address

-- auth.instances - 实例表
-- 跨多个站点管理用户
-- 主要字段：id, uuid, raw_base_config, created_at, updated_at

-- auth.schema_migrations - 认证系统迁移表
-- 管理认证系统的更新
-- 主要字段：version

/*
=======================================================
用户相关表 (public schema)
=======================================================
*/

-- user_profiles - 用户资料表
-- 存储用户的详细资料信息
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'zh-CN',
    last_login_time TIMESTAMPTZ COMMENT '用户最后登录时间，用于判断活跃状态',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE COMMENT '用户是否被锁定，默认为false（未锁定）',
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_settings - 用户设置表
-- 存储用户的个性化设置
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- user_subscriptions - 用户订阅表
-- 存储用户的订阅计划信息
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

/*
=======================================================
订阅管理相关表
=======================================================
*/

-- subscription_plans - 订阅计划表
-- 存储系统的订阅计划信息
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC DEFAULT 0,
    price_yearly NUMERIC DEFAULT 0,
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- categories - 分类表
-- 存储订阅服务的分类信息
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    label TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payment_methods - 支付方式表
-- 存储用户的支付方式信息
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    label TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- subscriptions - 订阅表
-- 存储用户的具体订阅信息
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly')),
    next_billing_date DATE,
    last_billing_date DATE,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'cancelled')),
    category_id UUID NOT NULL REFERENCES categories(id),
    renewal_type TEXT NOT NULL DEFAULT 'manual' CHECK (renewal_type IN ('auto', 'manual')),
    notes TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payment_history - 支付历史表
-- 存储用户的支付记录
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount_paid NUMERIC NOT NULL,
    currency TEXT NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/*
=======================================================
汇率管理相关表
=======================================================
*/

-- exchange_rates - 汇率表
-- 存储当前汇率信息
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'api' CHECK (source IN ('api', 'manual', 'system', 'mock')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

-- exchange_rate_history - 汇率历史表
-- 存储历史汇率数据
CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    date DATE NOT NULL,
    source TEXT DEFAULT 'api' CHECK (source IN ('api', 'manual', 'system', 'mock')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- exchange_rate_update_logs - 汇率更新日志表
-- 记录汇率更新操作的日志
CREATE TABLE IF NOT EXISTS exchange_rate_update_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_type TEXT NOT NULL CHECK (update_type IN ('scheduled', 'manual', 'api')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    rates_updated INTEGER DEFAULT 0,
    error_message TEXT,
    source TEXT DEFAULT 'system',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/*
=======================================================
通知系统相关表
=======================================================
*/

-- notification_templates - 通知模板表
-- 存储系统通知模板
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    action_url_template TEXT,
    action_label TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_notifications - 用户通知表
-- 存储应用内通知
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'subscription', 'payment', 'system', 'security')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    action_label TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_notification_preferences - 用户通知偏好设置表
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
);

/*
=======================================================
邮件系统相关表
=======================================================
*/

-- email_templates - 邮件模板表
-- 存储系统邮件模板
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- email_logs - 邮件发送日志表
-- 记录所有邮件发送状态
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN ('welcome', 'subscription_expiry', 'payment_failed', 'payment_success', 'quota_warning', 'security_alert', 'system_update', 'password_reset')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced', 'complained')),
    error_message TEXT,
    external_email_id TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- email_queue - 邮件队列表
-- 用于批量发送和重试机制
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    email_type TEXT NOT NULL,
    template_data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_email_preferences - 用户邮件偏好设置表
CREATE TABLE IF NOT EXISTS user_email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly', 'never')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_type)
);

/*
=======================================================
管理员系统相关表
=======================================================
*/

-- admin_roles - 管理员角色表
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_users - 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES admin_roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_sessions - 管理员会话表
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin_operation_logs - 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    operation_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    operation_details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/*
=======================================================
系统监控相关表
=======================================================
*/

-- system_settings - 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- system_health - 系统健康状态表
CREATE TABLE IF NOT EXISTS system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
    response_time INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- system_stats - 系统统计表
CREATE TABLE IF NOT EXISTS system_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_type TEXT NOT NULL,
    stat_value BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- system_logs - 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- scheduler_jobs - 调度任务表
CREATE TABLE IF NOT EXISTS scheduler_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL UNIQUE,
    job_type TEXT NOT NULL CHECK (job_type IN ('edge_function', 'rpc', 'http_post')),
    cron_spec TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    pg_cron_job_id INTEGER,
    payload JSONB,
    headers JSONB,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status TEXT CHECK (last_status IN ('success', 'failed', 'partial') OR last_status IS NULL),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- scheduler_job_runs - 调度任务运行记录表
CREATE TABLE IF NOT EXISTS scheduler_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES scheduler_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    result JSONB,
    error_message TEXT
);

/*
=======================================================
索引定义
=======================================================
*/

-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON user_profiles(last_login_time);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_blocked ON user_profiles(is_blocked);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id_key ON user_settings(user_id, setting_key);

-- 订阅相关索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category_id ON subscriptions(category_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method_id ON subscriptions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_date ON payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_date ON payment_history(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_status_date ON payment_history(user_id, status, payment_date);

-- 唯一约束：防止同一计费周期内重复成功支付
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_successful_payment_per_billing_period 
ON payment_history(subscription_id, billing_period_start, billing_period_end) 
WHERE status = 'success';

-- 汇率相关索引
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_composite ON exchange_rates(from_currency, to_currency, date);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_currencies ON exchange_rate_history(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_date ON exchange_rate_history(date);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_created_at ON exchange_rate_history(created_at);
CREATE INDEX IF NOT EXISTS idx_erh_pair_date_desc ON exchange_rate_history(from_currency, to_currency, date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_update_logs_status ON exchange_rate_update_logs(status);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_update_logs_created_at ON exchange_rate_update_logs(created_at);

-- 分类和支付方式索引
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_default ON categories(is_default);
CREATE INDEX IF NOT EXISTS idx_categories_user_id_default ON categories(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id_default ON payment_methods(user_id, is_default);

-- 通知相关索引
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_archived ON user_notifications(is_archived);
CREATE INDEX IF NOT EXISTS idx_user_notifications_priority ON user_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires_at ON user_notifications(expires_at);

-- 邮件相关索引
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_user_id ON user_email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_preferences_type ON user_email_preferences(email_type);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_type ON user_notification_preferences(notification_type);

-- 管理员相关索引
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON admin_users(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_admin_user_id ON admin_operation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_created_at ON admin_operation_logs(created_at);

-- 系统监控相关索引
CREATE INDEX IF NOT EXISTS idx_system_health_service_name ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_service_checked ON system_health(service_name, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_stats_type ON system_stats(stat_type);
CREATE INDEX IF NOT EXISTS idx_system_stats_recorded_at ON system_stats(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_stats_type_recorded ON system_stats(stat_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- 调度任务相关索引
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_name ON scheduler_jobs(job_name);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_enabled ON scheduler_jobs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_runs_job_id ON scheduler_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_runs_started_at ON scheduler_job_runs(started_at DESC);

/*
=======================================================
触发器和函数
=======================================================
*/

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有需要的表添加更新时间戳触发器
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rate_history_updated_at
    BEFORE UPDATE ON exchange_rate_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notifications_updated_at
    BEFORE UPDATE ON user_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduler_jobs_updated_at
    BEFORE UPDATE ON scheduler_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 用户初始化函数
CREATE OR REPLACE FUNCTION initialize_user_data(input_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- 创建用户资料
    INSERT INTO public.user_profiles (id, display_name, email)
    SELECT 
        input_user_id,
        COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
        u.email
    FROM auth.users u
    WHERE u.id = input_user_id
    ON CONFLICT (id) DO NOTHING;
    
    -- 创建默认分类
    INSERT INTO public.categories (user_id, value, label, is_default)
    VALUES 
        (input_user_id, 'entertainment', '娱乐', true),
        (input_user_id, 'productivity', '生产力', true),
        (input_user_id, 'education', '教育', true),
        (input_user_id, 'business', '商务', true),
        (input_user_id, 'other', '其他', true)
    ON CONFLICT (user_id, value) DO NOTHING;
    
    -- 创建默认支付方式
    INSERT INTO public.payment_methods (user_id, value, label, is_default)
    VALUES 
        (input_user_id, 'credit_card', '信用卡', true),
        (input_user_id, 'debit_card', '借记卡', false),
        (input_user_id, 'paypal', 'PayPal', false),
        (input_user_id, 'alipay', '支付宝', false),
        (input_user_id, 'wechat_pay', '微信支付', false)
    ON CONFLICT (user_id, value) DO NOTHING;
    
    -- 创建默认邮件偏好设置
    INSERT INTO public.user_email_preferences (user_id, email_type, enabled, frequency)
    VALUES 
        (input_user_id, 'welcome', true, 'immediate'),
        (input_user_id, 'subscription_expiry', true, 'immediate'),
        (input_user_id, 'payment_failed', true, 'immediate'),
        (input_user_id, 'payment_success', true, 'immediate'),
        (input_user_id, 'quota_warning', true, 'immediate'),
        (input_user_id, 'security_alert', true, 'immediate'),
        (input_user_id, 'system_update', false, 'weekly'),
        (input_user_id, 'password_reset', true, 'immediate')
    ON CONFLICT (user_id, email_type) DO NOTHING;
    
    -- 创建默认通知偏好设置
    INSERT INTO public.user_notification_preferences (user_id, notification_type, enabled, push_enabled, email_enabled, in_app_enabled)
    VALUES 
        (input_user_id, 'subscription', true, true, true, true),
        (input_user_id, 'payment', true, true, true, true),
        (input_user_id, 'system', true, false, false, true),
        (input_user_id, 'security', true, true, true, true)
    ON CONFLICT (user_id, notification_type) DO NOTHING;
    
    SELECT json_build_object(
        'success', true,
        'message', 'User data initialized successfully',
        'user_id', input_user_id
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 当前用户初始化函数
CREATE OR REPLACE FUNCTION initialize_current_user_data()
RETURNS JSON AS $$
BEGIN
    RETURN initialize_user_data(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建默认邮件偏好设置触发器函数
CREATE OR REPLACE FUNCTION create_default_email_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_email_preferences (user_id, email_type, enabled, frequency)
    VALUES 
        (NEW.id, 'welcome', true, 'immediate'),
        (NEW.id, 'subscription_expiry', true, 'immediate'),
        (NEW.id, 'payment_failed', true, 'immediate'),
        (NEW.id, 'payment_success', true, 'immediate'),
        (NEW.id, 'quota_warning', true, 'immediate'),
        (NEW.id, 'security_alert', true, 'immediate'),
        (NEW.id, 'system_update', false, 'weekly'),
        (NEW.id, 'password_reset', true, 'immediate')
    ON CONFLICT (user_id, email_type) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建默认通知偏好设置触发器函数
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_notification_preferences (user_id, notification_type, enabled, push_enabled, email_enabled, in_app_enabled)
    VALUES 
        (NEW.id, 'subscription', true, true, true, true),
        (NEW.id, 'payment', true, true, true, true),
        (NEW.id, 'system', true, false, false, true),
        (NEW.id, 'security', true, true, true, true)
    ON CONFLICT (user_id, notification_type) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 用户注册触发器
CREATE TRIGGER create_user_email_preferences_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_default_email_preferences();

CREATE TRIGGER create_user_notification_preferences_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_default_notification_preferences();

-- 汇率历史记录函数
CREATE OR REPLACE FUNCTION log_exchange_rate_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 当汇率更新时，将旧值存入历史表
    IF TG_OP = 'UPDATE' AND OLD.rate != NEW.rate THEN
        INSERT INTO exchange_rate_history (from_currency, to_currency, rate, date, source)
        VALUES (OLD.from_currency, OLD.to_currency, OLD.rate, OLD.date, OLD.source);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 汇率时间戳更新函数
CREATE OR REPLACE FUNCTION update_exchange_rate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 汇率历史触发器
CREATE TRIGGER trigger_log_exchange_rate_changes
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION log_exchange_rate_changes();

CREATE TRIGGER trigger_update_exchange_rate_timestamp
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION update_exchange_rate_timestamp();

/*
=======================================================
行级安全策略 (RLS)
=======================================================
*/

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_update_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_operation_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own categories" ON categories
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own payment methods" ON payment_methods
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view own payment history" ON payment_history
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON user_notifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own email logs" ON email_logs
    FOR SELECT USING (auth.uid() = user_id);

-- 汇率数据对所有认证用户可见
CREATE POLICY "Authenticated users can view exchange rates" ON exchange_rates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view exchange rate history" ON exchange_rate_history
    FOR SELECT USING (auth.role() = 'authenticated');

-- 管理员策略
CREATE POLICY "Admin users can view admin data" ON admin_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = auth.uid() AND au.is_active = true
        )
    );

/*
=======================================================
默认数据插入
=======================================================
*/

-- 插入默认订阅计划
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, features, limits, is_default) VALUES
('免费版', '基础功能，适合个人用户', 0, 0, '{"subscriptions": 5, "categories": 10, "reports": "basic"}', '{"max_subscriptions": 5}', true),
('专业版', '完整功能，适合专业用户', 29, 290, '{"subscriptions": "unlimited", "categories": "unlimited", "reports": "advanced", "export": true}', '{"max_subscriptions": -1}', false),
('企业版', '企业级功能和支持', 99, 990, '{"subscriptions": "unlimited", "categories": "unlimited", "reports": "premium", "export": true, "api": true, "priority_support": true}', '{"max_subscriptions": -1}', false)
ON CONFLICT (name) DO NOTHING;

-- 插入默认管理员角色
INSERT INTO admin_roles (name, description, permissions) VALUES
('超级管理员', '拥有所有权限的超级管理员', '{"users": {"read": true, "write": true, "delete": true}, "system": {"read": true, "write": true}, "admin": {"read": true, "write": true}}'),
('用户管理员', '负责用户管理的管理员', '{"users": {"read": true, "write": true, "delete": false}, "system": {"read": true, "write": false}}'),
('系统监控员', '负责系统监控的管理员', '{"system": {"read": true, "write": false}, "monitoring": {"read": true, "write": true}}')
ON CONFLICT (name) DO NOTHING;

-- 插入默认邮件模板
INSERT INTO email_templates (template_key, name, subject_template, html_template, text_template, variables) VALUES
('welcome', '欢迎邮件', '欢迎使用订阅管理系统', '<h1>欢迎 {{user_name}}!</h1><p>感谢您注册我们的订阅管理系统。</p>', '欢迎 {{user_name}}! 感谢您注册我们的订阅管理系统。', '["user_name", "email"]'),
('subscription_expiry', '订阅到期提醒', '您的订阅即将到期', '<h1>订阅到期提醒</h1><p>您的 {{subscription_name}} 订阅将在 {{expiry_date}} 到期。</p>', '您的 {{subscription_name}} 订阅将在 {{expiry_date}} 到期。', '["subscription_name", "expiry_date"]'),
('payment_failed', '支付失败通知', '支付失败通知', '<h1>支付失败</h1><p>您的 {{subscription_name}} 支付失败，请检查支付方式。</p>', '您的 {{subscription_name}} 支付失败，请检查支付方式。', '["subscription_name", "amount"]'),
('payment_success', '支付成功通知', '支付成功确认', '<h1>支付成功</h1><p>您的 {{subscription_name}} 支付成功，金额：{{amount}}。</p>', '您的 {{subscription_name}} 支付成功，金额：{{amount}}。', '["subscription_name", "amount"]')
ON CONFLICT (template_key) DO NOTHING;

-- 插入默认通知模板
INSERT INTO notification_templates (template_key, name, title_template, message_template, type, priority) VALUES
('subscription_expiry', '订阅到期提醒', '订阅即将到期', '您的 {{subscription_name}} 订阅将在 {{days}} 天后到期', 'subscription', 'high'),
('payment_failed', '支付失败', '支付失败', '您的 {{subscription_name}} 支付失败，请检查支付方式', 'payment', 'high'),
('payment_success', '支付成功', '支付成功', '您的 {{subscription_name}} 支付成功，金额：{{amount}}', 'payment', 'normal'),
('quota_warning', '配额警告', '配额即将用完', '您的 {{quota_type}} 配额已使用 {{usage_percent}}%', 'system', 'warning'),
('security_alert', '安全警告', '安全警告', '检测到异常登录活动，请检查您的账户安全', 'security', 'urgent')
ON CONFLICT (template_key) DO NOTHING;

-- 插入默认系统设置
INSERT INTO system_settings (setting_key, setting_value, description, is_public) VALUES
('app_name', '"订阅管理系统"', '应用程序名称', true),
('app_version', '"1.0.0"', '应用程序版本', true),
('maintenance_mode', 'false', '维护模式开关', false),
('max_subscriptions_per_user', '100', '每个用户最大订阅数量', false),
('email_notifications_enabled', 'true', '邮件通知开关', false),
('push_notifications_enabled', 'true', '推送通知开关', false),
('exchange_rate_update_interval', '3600', '汇率更新间隔（秒）', false),
('session_timeout', '86400', '会话超时时间（秒）', false)
ON CONFLICT (setting_key) DO NOTHING;

/*
=======================================================
视图定义
=======================================================
*/

-- 用户统计视图
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    up.display_name,
    up.last_login_time,
    COUNT(s.id) as subscription_count,
    COALESCE(SUM(s.amount), 0) as total_monthly_cost,
    COUNT(ph.id) as payment_count,
    up.created_at as registration_date
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN payment_history ph ON u.id = ph.user_id
GROUP BY u.id, u.email, up.display_name, up.last_login_time, up.created_at;

-- 订阅统计视图
CREATE OR REPLACE VIEW subscription_stats AS
SELECT 
    s.id,
    s.name,
    s.amount,
    s.currency,
    s.billing_cycle,
    s.status,
    c.label as category_name,
    pm.label as payment_method_name,
    s.next_billing_date,
    CASE 
        WHEN s.next_billing_date < CURRENT_DATE THEN 'overdue'
        WHEN s.next_billing_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
        ELSE 'normal'
    END as billing_status
FROM subscriptions s
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id;

-- 系统健康状态视图
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    service_name,
    status,
    AVG(response_time) as avg_response_time,
    COUNT(*) as check_count,
    MAX(checked_at) as last_check
FROM system_health 
WHERE checked_at >= NOW() - INTERVAL '1 hour'
GROUP BY service_name, status
ORDER BY service_name;

-- 邮件统计视图
CREATE OR REPLACE VIEW email_statistics AS
SELECT 
    user_id,
    email_type,
    status,
    COUNT(*) as count,
    DATE_TRUNC('day', sent_at) as date
FROM email_logs
GROUP BY user_id, email_type, status, DATE_TRUNC('day', sent_at);

-- 用户邮件统计视图
CREATE OR REPLACE VIEW user_email_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_emails,
    COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced_emails,
    MAX(sent_at) as last_email_sent
FROM email_logs
GROUP BY user_id;

-- 用户通知统计视图
CREATE OR REPLACE VIEW user_notification_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_notifications,
    COUNT(CASE WHEN is_archived = false THEN 1 END) as active_notifications,
    COUNT(CASE WHEN type = 'error' OR priority = 'urgent' THEN 1 END) as urgent_notifications,
    MAX(created_at) as last_notification_at
FROM user_notifications
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY user_id;

/*
=======================================================
存储过程和函数
=======================================================
*/

-- 获取用户订阅统计
CREATE OR REPLACE FUNCTION get_user_subscription_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_subscriptions', COUNT(*),
        'active_subscriptions', COUNT(*) FILTER (WHERE status = 'active'),
        'total_monthly_cost', COALESCE(SUM(amount) FILTER (WHERE billing_cycle = 'monthly'), 0),
        'total_yearly_cost', COALESCE(SUM(amount) FILTER (WHERE billing_cycle = 'yearly'), 0),
        'next_payment_date', MIN(next_billing_date) FILTER (WHERE status = 'active' AND next_billing_date >= CURRENT_DATE)
    ) INTO result
    FROM subscriptions 
    WHERE user_id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期通知
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_notifications 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO system_logs (log_type, message, metadata)
    VALUES ('cleanup', 'Cleaned up expired notifications', json_build_object('deleted_count', deleted_count));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新系统统计
CREATE OR REPLACE FUNCTION update_system_stats()
RETURNS VOID AS $$
BEGIN
    -- 更新用户统计
    INSERT INTO system_stats (stat_type, stat_value, metadata)
    VALUES ('total_users', (SELECT COUNT(*) FROM auth.users), '{}')
    ON CONFLICT (stat_type) DO UPDATE SET 
        stat_value = EXCLUDED.stat_value,
        recorded_at = NOW();
    
    -- 更新订阅统计
    INSERT INTO system_stats (stat_type, stat_value, metadata)
    VALUES ('total_subscriptions', (SELECT COUNT(*) FROM subscriptions), '{}')
    ON CONFLICT (stat_type) DO UPDATE SET 
        stat_value = EXCLUDED.stat_value,
        recorded_at = NOW();
    
    -- 更新活跃订阅统计
    INSERT INTO system_stats (stat_type, stat_value, metadata)
    VALUES ('active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'), '{}')
    ON CONFLICT (stat_type) DO UPDATE SET 
        stat_value = EXCLUDED.stat_value,
        recorded_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理员权限检查函数
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users au 
        WHERE au.user_id = user_uuid AND au.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_admin_permission(user_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM admin_users au
        JOIN admin_roles ar ON au.role_id = ar.id
        WHERE au.user_id = user_uuid 
        AND au.is_active = true
        AND ar.is_active = true
        AND (ar.permissions->permission_name)::boolean = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理员权限检查函数
CREATE OR REPLACE FUNCTION _ensure_is_admin()
RETURNS VOID AS $$
BEGIN
    IF NOT is_admin_user(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_can_manage_system()
RETURNS VOID AS $$
BEGIN
    IF NOT has_admin_permission(auth.uid(), 'manage_system') THEN
        RAISE EXCEPTION 'Access denied: System management privileges required';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户统计信息
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM auth.users),
        'active_users', (SELECT COUNT(*) FROM user_profiles WHERE last_login_time >= NOW() - INTERVAL '30 days'),
        'blocked_users', (SELECT COUNT(*) FROM user_profiles WHERE is_blocked = true),
        'total_subscriptions', (SELECT COUNT(*) FROM subscriptions),
        'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
        'total_payments', (SELECT COUNT(*) FROM payment_history),
        'successful_payments', (SELECT COUNT(*) FROM payment_history WHERE status = 'success')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取系统统计信息
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT json_build_object(
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'total_tables', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'),
        'total_functions', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public'),
        'uptime', EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time()))::INTEGER
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取汇率统计信息
CREATE OR REPLACE FUNCTION get_exchange_rate_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_rates', (SELECT COUNT(*) FROM exchange_rates),
        'last_update', (SELECT MAX(updated_at) FROM exchange_rates),
        'supported_currencies', (
            SELECT json_agg(DISTINCT from_currency) 
            FROM exchange_rates 
            WHERE from_currency != 'CNY'
        ),
        'update_frequency', '每小时更新'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取最新汇率
CREATE OR REPLACE FUNCTION get_latest_exchange_rate(p_from_currency TEXT, p_to_currency TEXT)
RETURNS NUMERIC AS $$
DECLARE
    rate_value NUMERIC;
BEGIN
    SELECT rate INTO rate_value
    FROM exchange_rates
    WHERE from_currency = p_from_currency 
    AND to_currency = p_to_currency
    ORDER BY date DESC, updated_at DESC
    LIMIT 1;
    
    RETURN COALESCE(rate_value, 1.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 用户列表函数
CREATE OR REPLACE FUNCTION list_users(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 20,
    p_search TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    offset_val INTEGER;
BEGIN
    offset_val := (p_page - 1) * p_limit;
    
    WITH filtered_users AS (
        SELECT 
            u.id,
            u.email,
            up.display_name,
            up.last_login_time,
            up.is_blocked,
            up.created_at,
            COUNT(s.id) as subscription_count
        FROM auth.users u
        LEFT JOIN user_profiles up ON u.id = up.id
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
        WHERE 
            (p_search IS NULL OR 
             u.email ILIKE '%' || p_search || '%' OR 
             up.display_name ILIKE '%' || p_search || '%')
        AND (p_status IS NULL OR 
             (p_status = 'active' AND up.is_blocked = false) OR
             (p_status = 'blocked' AND up.is_blocked = true))
        GROUP BY u.id, u.email, up.display_name, up.last_login_time, up.is_blocked, up.created_at
        ORDER BY up.created_at DESC
        LIMIT p_limit OFFSET offset_val
    )
    SELECT json_build_object(
        'users', json_agg(row_to_json(filtered_users)),
        'total_count', (
            SELECT COUNT(*)
            FROM auth.users u
            LEFT JOIN user_profiles up ON u.id = up.id
            WHERE 
                (p_search IS NULL OR 
                 u.email ILIKE '%' || p_search || '%' OR 
                 up.display_name ILIKE '%' || p_search || '%')
            AND (p_status IS NULL OR 
                 (p_status = 'active' AND up.is_blocked = false) OR
                 (p_status = 'blocked' AND up.is_blocked = true))
        ),
        'page', p_page,
        'limit', p_limit
    ) INTO result
    FROM filtered_users;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 调度器相关函数
CREATE OR REPLACE FUNCTION scheduler_start(
    p_job_name TEXT,
    p_cron TEXT,
    p_timezone TEXT,
    p_payload JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- 更新或插入调度任务
    INSERT INTO scheduler_jobs (job_name, job_type, cron_spec, timezone, is_enabled, payload)
    VALUES (p_job_name, 'edge_function', p_cron, p_timezone, true, p_payload)
    ON CONFLICT (job_name) DO UPDATE SET
        cron_spec = EXCLUDED.cron_spec,
        timezone = EXCLUDED.timezone,
        is_enabled = true,
        payload = EXCLUDED.payload,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION scheduler_stop(p_job_name TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE scheduler_jobs 
    SET is_enabled = false, updated_at = NOW()
    WHERE job_name = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION scheduler_update(
    p_job_name TEXT,
    p_cron TEXT,
    p_timezone TEXT,
    p_payload JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE scheduler_jobs 
    SET 
        cron_spec = p_cron,
        timezone = p_timezone,
        payload = p_payload,
        updated_at = NOW()
    WHERE job_name = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION scheduler_status(p_job_name TEXT)
RETURNS TABLE(
    job_name TEXT,
    job_type TEXT,
    cron_spec TEXT,
    timezone TEXT,
    is_enabled BOOLEAN,
    pg_cron_job_id INTEGER,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status TEXT,
    failed_attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sj.job_name,
        sj.job_type,
        sj.cron_spec,
        sj.timezone,
        sj.is_enabled,
        sj.pg_cron_job_id,
        sj.last_run_at,
        sj.next_run_at,
        sj.last_status,
        sj.failed_attempts
    FROM scheduler_jobs sj
    WHERE sj.job_name = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION scheduler_status_public(p_job_name TEXT)
RETURNS TABLE(
    job_name TEXT,
    is_enabled BOOLEAN,
    cron_spec TEXT,
    timezone TEXT,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_status TEXT,
    failed_attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sj.job_name,
        sj.is_enabled,
        sj.cron_spec,
        sj.timezone,
        sj.last_run_at,
        sj.next_run_at,
        sj.last_status,
        sj.failed_attempts
    FROM scheduler_jobs sj
    WHERE sj.job_name = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION scheduler_invoke_edge_function(p_job_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- 这个函数用于手动触发边缘函数
    -- 实际实现需要调用相应的边缘函数
    INSERT INTO scheduler_job_runs (job_id, status, started_at, completed_at)
    SELECT 
        id, 
        'success', 
        NOW(), 
        NOW()
    FROM scheduler_jobs 
    WHERE job_name = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取管理的订阅信息
CREATE OR REPLACE FUNCTION get_managed_subscriptions(
    p_user_id UUID,
    p_target_currency TEXT DEFAULT 'CNY',
    p_filters JSONB DEFAULT '{}',
    p_sorting JSONB DEFAULT '{"field": "nextBillingDate", "order": "asc"}',
    p_include_categories BOOLEAN DEFAULT true,
    p_include_payment_methods BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH subscription_data AS (
        SELECT 
            s.*,
            c.label as category_label,
            pm.label as payment_method_label,
            CASE 
                WHEN s.currency != p_target_currency THEN
                    s.amount * get_latest_exchange_rate(s.currency, p_target_currency)
                ELSE s.amount
            END as converted_amount
        FROM subscriptions s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
        WHERE s.user_id = p_user_id
        AND (
            p_filters = '{}' OR
            (p_filters->>'status' IS NULL OR s.status = p_filters->>'status') AND
            (p_filters->>'category' IS NULL OR c.value = p_filters->>'category')
        )
    )
    SELECT json_build_object(
        'subscriptions', json_agg(subscription_data ORDER BY 
            CASE WHEN p_sorting->>'field' = 'nextBillingDate' AND p_sorting->>'order' = 'asc' THEN next_billing_date END ASC,
            CASE WHEN p_sorting->>'field' = 'nextBillingDate' AND p_sorting->>'order' = 'desc' THEN next_billing_date END DESC,
            CASE WHEN p_sorting->>'field' = 'amount' AND p_sorting->>'order' = 'asc' THEN converted_amount END ASC,
            CASE WHEN p_sorting->>'field' = 'amount' AND p_sorting->>'order' = 'desc' THEN converted_amount END DESC,
            created_at DESC
        ),
        'categories', CASE WHEN p_include_categories THEN (
            SELECT json_agg(json_build_object('value', value, 'label', label))
            FROM categories WHERE user_id = p_user_id OR is_default = true
        ) ELSE '[]'::json END,
        'payment_methods', CASE WHEN p_include_payment_methods THEN (
            SELECT json_agg(json_build_object('value', value, 'label', label))
            FROM payment_methods WHERE user_id = p_user_id OR is_default = true
        ) ELSE '[]'::json END,
        'target_currency', p_target_currency
    ) INTO result
    FROM subscription_data;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取仪表板分析数据
CREATE OR REPLACE FUNCTION get_dashboard_analytics(
    target_currency TEXT DEFAULT 'CNY',
    upcoming_days INTEGER DEFAULT 7,
    recent_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_uuid UUID;
BEGIN
    user_uuid := auth.uid();
    
    WITH analytics_data AS (
        SELECT 
            -- 总订阅数
            COUNT(*) as total_subscriptions,
            -- 活跃订阅数
            COUNT(*) FILTER (WHERE status = 'active') as active_subscriptions,
            -- 月度总费用
            SUM(CASE 
                WHEN billing_cycle = 'monthly' AND status = 'active' THEN
                    CASE WHEN currency != target_currency THEN
                        amount * get_latest_exchange_rate(currency, target_currency)
                    ELSE amount END
                ELSE 0
            END) as monthly_cost,
            -- 年度总费用
            SUM(CASE 
                WHEN billing_cycle = 'yearly' AND status = 'active' THEN
                    CASE WHEN currency != target_currency THEN
                        amount * get_latest_exchange_rate(currency, target_currency)
                    ELSE amount END
                ELSE 0
            END) as yearly_cost,
            -- 即将到期的订阅
            COUNT(*) FILTER (
                WHERE status = 'active' 
                AND next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + upcoming_days
            ) as upcoming_renewals,
            -- 最近支付
            (SELECT COUNT(*) FROM payment_history ph 
             WHERE ph.user_id = user_uuid 
             AND ph.payment_date >= CURRENT_DATE - recent_days
             AND ph.status = 'success'
            ) as recent_payments
        FROM subscriptions 
        WHERE user_id = user_uuid
    ),
    category_breakdown AS (
        SELECT json_agg(
            json_build_object(
                'category', c.label,
                'count', category_counts.count,
                'total_amount', category_counts.total_amount
            )
        ) as categories
        FROM (
            SELECT 
                s.category_id,
                COUNT(*) as count,
                SUM(CASE 
                    WHEN s.currency != target_currency THEN
                        s.amount * get_latest_exchange_rate(s.currency, target_currency)
                    ELSE s.amount
                END) as total_amount
            FROM subscriptions s
            WHERE s.user_id = user_uuid AND s.status = 'active'
            GROUP BY s.category_id
        ) category_counts
        JOIN categories c ON category_counts.category_id = c.id
    ),
    upcoming_renewals AS (
        SELECT json_agg(
            json_build_object(
                'id', s.id,
                'name', s.name,
                'amount', CASE 
                    WHEN s.currency != target_currency THEN
                        s.amount * get_latest_exchange_rate(s.currency, target_currency)
                    ELSE s.amount
                END,
                'currency', target_currency,
                'next_billing_date', s.next_billing_date,
                'days_until_renewal', s.next_billing_date - CURRENT_DATE
            )
        ) as renewals
        FROM subscriptions s
        WHERE s.user_id = user_uuid 
        AND s.status = 'active'
        AND s.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + upcoming_days
        ORDER BY s.next_billing_date
    ),
    recent_payments AS (
        SELECT json_agg(
            json_build_object(
                'id', ph.id,
                'subscription_name', s.name,
                'amount', CASE 
                    WHEN ph.currency != target_currency THEN
                        ph.amount_paid * get_latest_exchange_rate(ph.currency, target_currency)
                    ELSE ph.amount_paid
                END,
                'currency', target_currency,
                'payment_date', ph.payment_date,
                'status', ph.status
            )
        ) as payments
        FROM payment_history ph
        JOIN subscriptions s ON ph.subscription_id = s.id
        WHERE ph.user_id = user_uuid 
        AND ph.payment_date >= CURRENT_DATE - recent_days
        ORDER BY ph.payment_date DESC
        LIMIT 10
    )
    SELECT json_build_object(
        'summary', json_build_object(
            'total_subscriptions', ad.total_subscriptions,
            'active_subscriptions', ad.active_subscriptions,
            'monthly_cost', ad.monthly_cost,
            'yearly_cost', ad.yearly_cost,
            'upcoming_renewals', ad.upcoming_renewals,
            'recent_payments', ad.recent_payments,
            'target_currency', target_currency
        ),
        'category_breakdown', COALESCE(cb.categories, '[]'::json),
        'upcoming_renewals', COALESCE(ur.renewals, '[]'::json),
        'recent_payments', COALESCE(rp.payments, '[]'::json)
    ) INTO result
    FROM analytics_data ad
    CROSS JOIN category_breakdown cb
    CROSS JOIN upcoming_renewals ur
    CROSS JOIN recent_payments rp;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 处理订阅续费
CREATE OR REPLACE FUNCTION process_subscription_renewal(
    p_subscription_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    subscription_record RECORD;
    next_billing DATE;
    result JSONB;
BEGIN
    -- 获取订阅信息
    SELECT * INTO subscription_record
    FROM subscriptions 
    WHERE id = p_subscription_id AND user_id = p_user_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Subscription not found or not active'
        );
    END IF;
    
    -- 计算下次计费日期
    CASE subscription_record.billing_cycle
        WHEN 'monthly' THEN
            next_billing := subscription_record.next_billing_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            next_billing := subscription_record.next_billing_date + INTERVAL '3 months';
        WHEN 'yearly' THEN
            next_billing := subscription_record.next_billing_date + INTERVAL '1 year';
        ELSE
            next_billing := subscription_record.next_billing_date + INTERVAL '1 month';
    END CASE;
    
    -- 更新订阅的下次计费日期
    UPDATE subscriptions 
    SET 
        next_billing_date = next_billing,
        last_billing_date = subscription_record.next_billing_date,
        updated_at = NOW()
    WHERE id = p_subscription_id;
    
    -- 创建支付记录
    INSERT INTO payment_history (
        user_id,
        subscription_id,
        payment_date,
        amount_paid,
        currency,
        billing_period_start,
        billing_period_end,
        status,
        notes
    ) VALUES (
        p_user_id,
        p_subscription_id,
        subscription_record.next_billing_date,
        subscription_record.amount,
        subscription_record.currency,
        subscription_record.next_billing_date,
        next_billing - INTERVAL '1 day',
        'success',
        'Auto-renewal processed'
    );
    
    RETURN json_build_object(
        'success', true,
        'subscription_id', p_subscription_id,
        'next_billing_date', next_billing,
        'amount_paid', subscription_record.amount,
        'currency', subscription_record.currency
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 处理到期的自动续费订阅
CREATE OR REPLACE FUNCTION process_due_auto_renewals(p_limit INTEGER DEFAULT 500)
RETURNS JSONB AS $$
DECLARE
    processed_count INTEGER := 0;
    failed_count INTEGER := 0;
    subscription_record RECORD;
    renewal_result JSONB;
BEGIN
    -- 处理到期的自动续费订阅
    FOR subscription_record IN
        SELECT id, user_id, name
        FROM subscriptions 
        WHERE status = 'active'
        AND renewal_type = 'auto'
        AND next_billing_date <= CURRENT_DATE
        ORDER BY next_billing_date
        LIMIT p_limit
    LOOP
        -- 处理单个订阅续费
        SELECT process_subscription_renewal(subscription_record.id, subscription_record.user_id) 
        INTO renewal_result;
        
        IF (renewal_result->>'success')::boolean THEN
            processed_count := processed_count + 1;
        ELSE
            failed_count := failed_count + 1;
        END IF;
    END LOOP;
    
    RETURN json_build_object(
        'processed_count', processed_count,
        'failed_count', failed_count,
        'total_checked', processed_count + failed_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
=======================================================
定时任务和维护
=======================================================
*/

-- 注意：以下定时任务需要通过 pg_cron 扩展或外部调度器执行

-- 每小时清理过期通知
-- SELECT cron.schedule('cleanup-notifications', '0 * * * *', 'SELECT cleanup_expired_notifications();');

-- 每天更新系统统计
-- SELECT cron.schedule('update-stats', '0 2 * * *', 'SELECT update_system_stats();');

-- 每天清理旧的系统日志（保留30天）
-- SELECT cron.schedule('cleanup-logs', '0 3 * * *', 'DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL ''30 days'';');

/*
=======================================================
备份和恢复建议
=======================================================

1. 定期备份策略：
   - 每日全量备份
   - 每小时增量备份
   - 保留30天的备份数据

2. 关键表备份优先级：
   - 高优先级：auth.users, user_profiles, subscriptions, payment_history
   - 中优先级：categories, payment_methods, user_settings
   - 低优先级：system_logs, email_logs, exchange_rate_history

3. 恢复测试：
   - 每月进行恢复测试
   - 验证数据完整性
   - 测试应用程序功能

=======================================================
性能优化建议
=======================================================

1. 索引优化：
   - 定期分析查询性能
   - 根据查询模式调整索引
   - 监控索引使用情况

2. 查询优化：
   - 使用 EXPLAIN ANALYZE 分析慢查询
   - 优化复杂的 JOIN 查询
   - 考虑使用物化视图

3. 数据清理：
   - 定期清理过期数据
   - 归档历史数据
   - 监控表大小增长

=======================================================
安全建议
=======================================================

1. 访问控制：
   - 定期审查 RLS 策略
   - 最小权限原则
   - 定期轮换密钥

2. 数据加密：
   - 敏感数据加密存储
   - 传输加密
   - 密钥管理

3. 审计日志：
   - 启用数据库审计
   - 监控异常访问
   - 定期审查日志

=======================================================
监控建议
=======================================================

1. 性能监控：
   - 查询响应时间
   - 连接数监控
   - 资源使用率

2. 业务监控：
   - 用户活跃度
   - 订阅转化率
   - 支付成功率

3. 系统监控：
   - 数据库可用性
   - 备份状态
   - 错误率监控

=======================================================
*/

/*
=======================================================
更新日志
=======================================================

2025-08-13 更新:
- 添加了调度任务系统表 (scheduler_jobs, scheduler_job_runs)
- 添加了管理员操作日志表 (admin_operation_logs)
- 更新了用户初始化函数，支持手动调用
- 添加了邮件和通知偏好设置的触发器函数
- 添加了汇率更新时间戳触发器
- 添加了订阅管理相关函数 (get_managed_subscriptions, get_dashboard_analytics)
- 添加了自动续费处理函数 (process_subscription_renewal, process_due_auto_renewals)
- 添加了管理员权限检查函数 (is_admin_user, has_admin_permission)
- 添加了系统统计和用户管理函数
- 添加了调度器管理函数
- 添加了邮件和通知统计视图
- 完善了索引结构，提高查询性能
- 添加了 pg_cron 扩展支持

主要功能增强:
1. 完整的调度任务管理系统
2. 增强的管理员权限控制
3. 自动订阅续费处理
4. 完善的邮件和通知系统
5. 详细的统计和分析功能
6. 优化的数据库索引结构

=======================================================
*/

-- 文档结束标记
SELECT 'Supabase 数据库架构文档更新完成 - 2025-08-13' as documentation_status;