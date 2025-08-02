-- 邮件通知系统数据库架构
-- 创建邮件日志表用于跟踪邮件发送状态

-- 邮件日志表
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'welcome',
        'subscription_expiry', 
        'payment_failed',
        'payment_success',
        'quota_warning',
        'security_alert',
        'system_update',
        'password_reset'
    )),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'sent', 
        'failed',
        'delivered',
        'bounced',
        'complained'
    )),
    error_message TEXT,
    external_email_id TEXT, -- 第三方邮件服务的邮件ID
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 索引
    INDEX idx_email_logs_user_id (user_id),
    INDEX idx_email_logs_email_type (email_type),
    INDEX idx_email_logs_status (status),
    INDEX idx_email_logs_sent_at (sent_at)
);

-- 启用RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS策略 - 用户只能查看自己的邮件日志
CREATE POLICY "用户只能查看自己的邮件日志"
ON email_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 管理员可以查看所有邮件日志（预留）
CREATE POLICY "管理员可以查看所有邮件日志"
ON email_logs FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND (metadata->>'role')::text = 'admin'
    )
);

-- 邮件模板表（用于存储自定义邮件模板）
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- 模板变量列表
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 索引
    INDEX idx_email_templates_key (template_key),
    INDEX idx_email_templates_active (is_active)
);

-- 插入默认邮件模板
INSERT INTO email_templates (template_key, name, description, subject_template, html_template, text_template, variables) VALUES
('welcome', '欢迎邮件', '新用户注册时发送的欢迎邮件', 
 '欢迎使用订阅管理器！🎉',
 '<!DOCTYPE html><html><body><h1>欢迎 {{displayName}}！</h1><p>感谢您注册订阅管理器。</p></body></html>',
 '欢迎 {{displayName}}！\n\n感谢您注册订阅管理器。',
 '["displayName", "email"]'::jsonb),

('subscription_expiry', '订阅到期提醒', '订阅即将到期时发送的提醒邮件',
 '⏰ {{subscriptionName}} 即将到期提醒',
 '<!DOCTYPE html><html><body><h1>订阅到期提醒</h1><p>您的 {{subscriptionName}} 将在 {{daysLeft}} 天后到期。</p></body></html>',
 '订阅到期提醒\n\n您的 {{subscriptionName}} 将在 {{daysLeft}} 天后到期。',
 '["displayName", "subscriptionName", "expiryDate", "daysLeft"]'::jsonb),

('payment_failed', '支付失败通知', '支付失败时发送的通知邮件',
 '❌ {{subscriptionName}} 支付失败通知',
 '<!DOCTYPE html><html><body><h1>支付失败</h1><p>您的 {{subscriptionName}} 支付失败，金额：{{amount}} {{currency}}。</p></body></html>',
 '支付失败\n\n您的 {{subscriptionName}} 支付失败，金额：{{amount}} {{currency}}。',
 '["displayName", "subscriptionName", "amount", "currency"]'::jsonb),

('payment_success', '支付成功确认', '支付成功时发送的确认邮件',
 '✅ {{subscriptionName}} 支付成功确认',
 '<!DOCTYPE html><html><body><h1>支付成功</h1><p>您的 {{subscriptionName}} 支付成功，金额：{{amount}} {{currency}}。</p></body></html>',
 '支付成功\n\n您的 {{subscriptionName}} 支付成功，金额：{{amount}} {{currency}}。',
 '["displayName", "subscriptionName", "amount", "currency"]'::jsonb);

-- 用户邮件偏好设置表
CREATE TABLE user_email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly', 'never')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 确保每个用户每种邮件类型只有一条记录
    UNIQUE(user_id, email_type),
    
    -- 索引
    INDEX idx_user_email_preferences_user_id (user_id),
    INDEX idx_user_email_preferences_type (email_type)
);

-- 启用RLS
ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能管理自己的邮件偏好"
ON user_email_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 插入默认邮件偏好设置的函数
CREATE OR REPLACE FUNCTION create_default_email_preferences()
RETURNS TRIGGER AS $$
BEGIN
    -- 为新用户创建默认邮件偏好设置
    INSERT INTO user_email_preferences (user_id, email_type, enabled, frequency) VALUES
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

-- 创建触发器，在用户注册时自动创建默认邮件偏好
CREATE TRIGGER create_user_email_preferences_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_email_preferences();

-- 邮件队列表（用于批量发送和重试机制）
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    email_type TEXT NOT NULL,
    template_data JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1最高优先级，10最低
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 索引
    INDEX idx_email_queue_status (status),
    INDEX idx_email_queue_scheduled_at (scheduled_at),
    INDEX idx_email_queue_priority (priority),
    INDEX idx_email_queue_user_id (user_id)
);

-- 启用RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS策略 - 用户只能查看自己的邮件队列
CREATE POLICY "用户只能查看自己的邮件队列"
ON email_queue FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 管理员可以管理所有邮件队列（预留）
CREATE POLICY "管理员可以管理所有邮件队列"
ON email_queue FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND (metadata->>'role')::text = 'admin'
    )
);

-- 邮件统计视图
CREATE VIEW email_statistics AS
SELECT 
    user_id,
    email_type,
    status,
    COUNT(*) as count,
    DATE_TRUNC('day', sent_at) as date
FROM email_logs
GROUP BY user_id, email_type, status, DATE_TRUNC('day', sent_at);

-- 用户邮件统计视图
CREATE VIEW user_email_statistics AS
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

-- 创建更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为相关表添加更新时间戳触发器
CREATE TRIGGER update_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_email_preferences_updated_at
    BEFORE UPDATE ON user_email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE email_logs IS '邮件发送日志表，记录所有邮件发送状态';
COMMENT ON TABLE email_templates IS '邮件模板表，存储系统邮件模板';
COMMENT ON TABLE user_email_preferences IS '用户邮件偏好设置表';
COMMENT ON TABLE email_queue IS '邮件队列表，用于批量发送和重试机制';
COMMENT ON VIEW email_statistics IS '邮件统计视图';
COMMENT ON VIEW user_email_statistics IS '用户邮件统计视图';