-- 统一通知系统重构 - 第一阶段：基础数据表
-- 创建日期: 2025-08-21
-- 描述: 实施统一通知系统，合并模板表，添加队列和调度功能

BEGIN;

-- 1. 统一通知模板表（合并原有两个模板表）
CREATE TABLE IF NOT EXISTS unified_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'sms', 'push', 'in_app')),
  notification_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- 模板内容（根据渠道类型使用不同字段）
  subject_template TEXT, -- 邮件/短信标题
  html_template TEXT,    -- 邮件HTML内容  
  text_template TEXT,    -- 纯文本内容
  push_title TEXT,       -- 推送标题
  push_body TEXT,        -- 推送内容
  
  -- 配置
  variables JSONB DEFAULT '[]'::jsonb,       -- 可用变量列表
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 通知渠道配置表
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb, -- API密钥、发送限制等配置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 重新设计的用户通知偏好表
CREATE TABLE IF NOT EXISTS user_notification_preferences_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly', 'never')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type, channel_type)
);

-- 4. 通知队列表（支持延迟发送和重试）
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  recipient TEXT NOT NULL, -- 邮箱、手机号等
  
  -- 内容
  subject TEXT,
  content JSONB DEFAULT '{}'::jsonb, -- 渲染后的内容
  variables JSONB DEFAULT '{}'::jsonb, -- 模板变量
  
  -- 调度
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0,
  
  -- 状态
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  failed_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 统一通知日志表（替代email_logs）
CREATE TABLE IF NOT EXISTS notification_logs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  
  -- 内容快照
  subject TEXT,
  content_preview TEXT, -- 内容预览（前100字符）
  
  -- 发送状态
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  external_id TEXT, -- 外部服务返回的ID
  error_message TEXT,
  
  -- 统计
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  -- 元数据
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 定时通知调度表
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  template_key TEXT NOT NULL,
  
  -- 调度配置
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'relative', 'fixed')),
  cron_expression TEXT, -- 如 '0 9 * * *' 每天9点
  relative_trigger TEXT, -- 如 'subscription_expires_in_7_days'
  fixed_datetime TIMESTAMPTZ,
  
  -- 条件
  conditions JSONB DEFAULT '{}'::jsonb, -- 触发条件（如用户设置检查）
  target_users TEXT DEFAULT 'all', -- 'all' 或特定用户组
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 通知规则表（复杂条件判断）
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  
  -- 规则配置
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb, -- 复杂的JSON条件
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,    -- 满足条件时的动作
  
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
-- unified_notification_templates 索引
CREATE INDEX IF NOT EXISTS idx_unified_notification_templates_key ON unified_notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_unified_notification_templates_type ON unified_notification_templates(notification_type);
CREATE INDEX IF NOT EXISTS idx_unified_notification_templates_channel ON unified_notification_templates(channel_type);
CREATE INDEX IF NOT EXISTS idx_unified_notification_templates_active ON unified_notification_templates(is_active);

-- notification_channels 索引
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_enabled ON notification_channels(is_enabled);

-- user_notification_preferences_v2 索引
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_v2_user_id ON user_notification_preferences_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_v2_type ON user_notification_preferences_v2(notification_type);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_v2_channel ON user_notification_preferences_v2(channel_type);

-- notification_queue 索引
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel_type ON notification_queue(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_template_key ON notification_queue(template_key);

-- notification_logs_v2 索引
CREATE INDEX IF NOT EXISTS idx_notification_logs_v2_user_id ON notification_logs_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_v2_type ON notification_logs_v2(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_v2_channel ON notification_logs_v2(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_v2_status ON notification_logs_v2(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_v2_sent_at ON notification_logs_v2(sent_at);

-- notification_schedules 索引
CREATE INDEX IF NOT EXISTS idx_notification_schedules_type ON notification_schedules(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_schedule_type ON notification_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_active ON notification_schedules(is_active);

-- notification_rules 索引
CREATE INDEX IF NOT EXISTS idx_notification_rules_type ON notification_rules(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_active ON notification_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_rules_priority ON notification_rules(priority);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_unified_notification_templates_updated_at
    BEFORE UPDATE ON unified_notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_channels_updated_at
    BEFORE UPDATE ON notification_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_v2_updated_at
    BEFORE UPDATE ON user_notification_preferences_v2
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_logs_v2_updated_at
    BEFORE UPDATE ON notification_logs_v2
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_schedules_updated_at
    BEFORE UPDATE ON notification_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rules_updated_at
    BEFORE UPDATE ON notification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用RLS
ALTER TABLE unified_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略

-- 模板表：所有认证用户可读，只有管理员可写
CREATE POLICY "Users can view active templates" ON unified_notification_templates
    FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "Admins can manage templates" ON unified_notification_templates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = auth.uid() AND au.is_active = true
        )
    );

-- 渠道配置：只有管理员可访问
CREATE POLICY "Only admins can access channels" ON notification_channels
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = auth.uid() AND au.is_active = true
        )
    );

-- 用户偏好：用户只能访问自己的数据
CREATE POLICY "Users can manage own preferences" ON user_notification_preferences_v2
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- 通知队列：用户只能访问自己的队列
CREATE POLICY "Users can view own queue" ON notification_queue
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System can manage queue" ON notification_queue
    FOR ALL TO service_role
    USING (true);

-- 通知日志：用户只能查看自己的日志
CREATE POLICY "Users can view own logs" ON notification_logs_v2
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System can manage logs" ON notification_logs_v2
    FOR ALL TO service_role
    USING (true);

-- 调度配置：只有管理员可访问
CREATE POLICY "Only admins can access schedules" ON notification_schedules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = auth.uid() AND au.is_active = true
        )
    );

-- 通知规则：只有管理员可访问
CREATE POLICY "Only admins can access rules" ON notification_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.user_id = auth.uid() AND au.is_active = true
        )
    );

-- 插入初始数据

-- 通知渠道配置
INSERT INTO notification_channels (channel_type, name, is_enabled, config) VALUES
('email', 'Email Notifications', true, '{"provider": "resend", "from_email": "noreply@service.lskun.top"}'),
('sms', 'SMS Notifications', false, '{"provider": "twilio"}'),
('push', 'Push Notifications', false, '{"provider": "firebase"}'),
('in_app', 'In-App Notifications', true, '{}')
ON CONFLICT (channel_type) DO NOTHING;

-- 迁移现有email_templates到unified_notification_templates
INSERT INTO unified_notification_templates (
    template_key, 
    name, 
    channel_type, 
    notification_type, 
    priority,
    subject_template, 
    html_template, 
    text_template, 
    variables,
    is_active
)
SELECT 
    template_key,
    name,
    'email' as channel_type,
    'general' as notification_type, -- email_templates表没有type字段，使用默认值
    'normal' as priority, -- email_templates表没有priority字段，使用默认值
    subject_template,
    html_template,
    text_template,
    COALESCE(variables, '[]'::jsonb) as variables,
    is_active
FROM email_templates
ON CONFLICT (template_key) DO NOTHING;

-- 迁移现有notification_templates到unified_notification_templates（应用内通知）
INSERT INTO unified_notification_templates (
    template_key, 
    name, 
    channel_type, 
    notification_type, 
    priority,
    subject_template, 
    text_template, 
    variables,
    is_active
)
SELECT 
    template_key,
    name,
    'in_app' as channel_type,
    COALESCE(type, 'general') as notification_type,
    COALESCE(priority, 'normal') as priority,
    title_template as subject_template,
    message_template as text_template,
    '[]'::jsonb as variables,
    is_active
FROM notification_templates
WHERE NOT EXISTS (
    SELECT 1 FROM unified_notification_templates unt 
    WHERE unt.template_key = notification_templates.template_key
)
ON CONFLICT (template_key) DO NOTHING;

COMMIT;