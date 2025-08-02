-- =====================================================
-- 订阅管理SaaS平台 - 初始数据库架构
-- =====================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 用户配置表
-- =====================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'zh-CN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的配置"
ON user_profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "用户只能插入自己的配置"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "用户只能更新自己的配置"
ON user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "用户只能删除自己的配置"
ON user_profiles FOR DELETE
TO authenticated
USING (id = auth.uid());

-- =====================================================
-- 订阅计划表（预留扩展）
-- =====================================================
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    stripe_price_id_monthly TEXT, -- 预留字段
    stripe_price_id_yearly TEXT,  -- 预留字段
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认免费计划
INSERT INTO subscription_plans (name, description, features, limits, is_default) VALUES
('免费版', '完整功能，免费使用', 
 '{"all_current_features": true, "email_support": true}',
 '{"max_subscriptions": -1, "api_calls_per_hour": 1000}',
 true);

-- =====================================================
-- 用户订阅关系表
-- =====================================================
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id TEXT, -- 预留字段，后续Stripe集成使用
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ, -- 免费计划可为NULL（永久有效）
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的订阅"
ON user_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "用户只能插入自己的订阅"
ON user_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的订阅"
ON user_subscriptions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的订阅"
ON user_subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 分类表（支持系统默认和用户自定义）
-- =====================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, value)
);

-- 启用RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户可以访问默认分类和自己的分类"
ON categories FOR SELECT
TO authenticated
USING (is_default = true OR user_id = auth.uid());

CREATE POLICY "用户只能插入自己的分类"
ON categories FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的分类"
ON categories FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的分类"
ON categories FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 插入默认分类
INSERT INTO categories (value, label, is_default) VALUES
('streaming', '流媒体', true),
('software', '软件工具', true),
('cloud', '云服务', true),
('gaming', '游戏娱乐', true),
('productivity', '生产力工具', true),
('news', '新闻资讯', true),
('music', '音乐', true),
('fitness', '健身运动', true),
('education', '教育学习', true),
('other', '其他', true);

-- =====================================================
-- 支付方式表（支持系统默认和用户自定义）
-- =====================================================
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, value)
);

-- 启用RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户可以访问默认支付方式和自己的支付方式"
ON payment_methods FOR SELECT
TO authenticated
USING (is_default = true OR user_id = auth.uid());

CREATE POLICY "用户只能插入自己的支付方式"
ON payment_methods FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的支付方式"
ON payment_methods FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的支付方式"
ON payment_methods FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 插入默认支付方式
INSERT INTO payment_methods (value, label, is_default) VALUES
('credit_card', '信用卡', true),
('debit_card', '借记卡', true),
('alipay', '支付宝', true),
('wechat_pay', '微信支付', true),
('paypal', 'PayPal', true),
('bank_transfer', '银行转账', true),
('apple_pay', 'Apple Pay', true),
('google_pay', 'Google Pay', true);

-- =====================================================
-- 订阅管理表
-- =====================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL,
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly')),
    next_billing_date DATE,
    last_billing_date DATE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
    category_id UUID NOT NULL REFERENCES categories(id),
    renewal_type TEXT NOT NULL DEFAULT 'manual' CHECK (renewal_type IN ('auto', 'manual')),
    notes TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的订阅数据"
ON subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "用户只能插入自己的订阅数据"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的订阅数据"
ON subscriptions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的订阅数据"
ON subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 支付历史表
-- =====================================================
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed', 'refunded')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的支付历史"
ON payment_history FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "用户只能插入自己的支付历史"
ON payment_history FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的支付历史"
ON payment_history FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的支付历史"
ON payment_history FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 汇率数据表
-- =====================================================
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(15, 8) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

-- 汇率数据是全局共享的，不需要RLS

-- =====================================================
-- 用户设置表
-- =====================================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

-- 启用RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "用户只能查看自己的设置"
ON user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "用户只能插入自己的设置"
ON user_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能更新自己的设置"
ON user_settings FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "用户只能删除自己的设置"
ON user_settings FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 创建索引以优化查询性能
-- =====================================================

-- 用户配置表索引
CREATE INDEX idx_user_profiles_user_id ON user_profiles(id);

-- 用户订阅表索引
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

-- 分类表索引
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_is_default ON categories(is_default);

-- 支付方式表索引
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_is_default ON payment_methods(is_default);

-- 订阅表索引
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_category_id ON subscriptions(category_id);
CREATE INDEX idx_subscriptions_payment_method_id ON subscriptions(payment_method_id);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);

-- 支付历史表索引
CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX idx_payment_history_payment_date ON payment_history(payment_date);
CREATE INDEX idx_payment_history_status ON payment_history(status);

-- 汇率表索引
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date);

-- 用户设置表索引
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_key ON user_settings(setting_key);

-- =====================================================
-- 创建触发器以自动更新时间戳
-- =====================================================

-- 创建更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加触发器
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();