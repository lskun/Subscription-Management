-- =====================================================
-- 增强和验证Row Level Security (RLS)策略 - 修复版本
-- =====================================================

-- 确保所有需要RLS的表都已启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 订阅计划表和汇率表是全局共享的，不需要RLS
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 验证和完善用户配置表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户只能查看自己的配置" ON user_profiles;
DROP POLICY IF EXISTS "用户只能插入自己的配置" ON user_profiles;
DROP POLICY IF EXISTS "用户只能更新自己的配置" ON user_profiles;
DROP POLICY IF EXISTS "用户只能删除自己的配置" ON user_profiles;

-- 创建完善的用户配置RLS策略
CREATE POLICY "user_profiles_select_policy"
ON user_profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "user_profiles_insert_policy"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_update_policy"
ON user_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_delete_policy"
ON user_profiles FOR DELETE
TO authenticated
USING (id = auth.uid());

-- =====================================================
-- 验证和完善用户订阅表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户只能查看自己的订阅" ON user_subscriptions;
DROP POLICY IF EXISTS "用户只能插入自己的订阅" ON user_subscriptions;
DROP POLICY IF EXISTS "用户只能更新自己的订阅" ON user_subscriptions;
DROP POLICY IF EXISTS "用户只能删除自己的订阅" ON user_subscriptions;

-- 创建完善的用户订阅RLS策略
CREATE POLICY "user_subscriptions_select_policy"
ON user_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_subscriptions_insert_policy"
ON user_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_subscriptions_update_policy"
ON user_subscriptions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_subscriptions_delete_policy"
ON user_subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 验证和完善分类表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户可以访问默认分类和自己的分类" ON categories;
DROP POLICY IF EXISTS "所有用户可以访问默认分类，认证用户可以访问自己的分类" ON categories;
DROP POLICY IF EXISTS "用户只能插入自己的分类" ON categories;
DROP POLICY IF EXISTS "用户只能更新自己的分类" ON categories;
DROP POLICY IF EXISTS "用户只能删除自己的分类" ON categories;

-- 创建完善的分类RLS策略
-- 允许所有用户（包括匿名用户）访问默认分类，认证用户可以访问自己的分类
CREATE POLICY "categories_select_policy"
ON categories FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 只有认证用户可以创建自己的分类
CREATE POLICY "categories_insert_policy"
ON categories FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只有认证用户可以更新自己的分类（不能更新默认分类）
CREATE POLICY "categories_update_policy"
ON categories FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_default = false)
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只有认证用户可以删除自己的分类（不能删除默认分类）
CREATE POLICY "categories_delete_policy"
ON categories FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_default = false);

-- =====================================================
-- 验证和完善支付方式表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户可以访问默认支付方式和自己的支付方式" ON payment_methods;
DROP POLICY IF EXISTS "所有用户可以访问默认支付方式，认证用户可以访问自己的支付方式" ON payment_methods;
DROP POLICY IF EXISTS "用户只能插入自己的支付方式" ON payment_methods;
DROP POLICY IF EXISTS "用户只能更新自己的支付方式" ON payment_methods;
DROP POLICY IF EXISTS "用户只能删除自己的支付方式" ON payment_methods;

-- 创建完善的支付方式RLS策略
-- 允许所有用户（包括匿名用户）访问默认支付方式，认证用户可以访问自己的支付方式
CREATE POLICY "payment_methods_select_policy"
ON payment_methods FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 只有认证用户可以创建自己的支付方式
CREATE POLICY "payment_methods_insert_policy"
ON payment_methods FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只有认证用户可以更新自己的支付方式（不能更新默认支付方式）
CREATE POLICY "payment_methods_update_policy"
ON payment_methods FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_default = false)
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只有认证用户可以删除自己的支付方式（不能删除默认支付方式）
CREATE POLICY "payment_methods_delete_policy"
ON payment_methods FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_default = false);

-- =====================================================
-- 验证和完善订阅表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户只能查看自己的订阅数据" ON subscriptions;
DROP POLICY IF EXISTS "用户只能插入自己的订阅数据" ON subscriptions;
DROP POLICY IF EXISTS "用户只能更新自己的订阅数据" ON subscriptions;
DROP POLICY IF EXISTS "用户只能删除自己的订阅数据" ON subscriptions;

-- 创建完善的订阅RLS策略
CREATE POLICY "subscriptions_select_policy"
ON subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "subscriptions_insert_policy"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_update_policy"
ON subscriptions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_delete_policy"
ON subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 验证和完善支付历史表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户只能查看自己的支付历史" ON payment_history;
DROP POLICY IF EXISTS "用户只能插入自己的支付历史" ON payment_history;
DROP POLICY IF EXISTS "用户只能更新自己的支付历史" ON payment_history;
DROP POLICY IF EXISTS "用户只能删除自己的支付历史" ON payment_history;

-- 创建完善的支付历史RLS策略
CREATE POLICY "payment_history_select_policy"
ON payment_history FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "payment_history_insert_policy"
ON payment_history FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_history_update_policy"
ON payment_history FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_history_delete_policy"
ON payment_history FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 验证和完善用户设置表的RLS策略
-- =====================================================

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "用户只能查看自己的设置" ON user_settings;
DROP POLICY IF EXISTS "用户只能插入自己的设置" ON user_settings;
DROP POLICY IF EXISTS "用户只能更新自己的设置" ON user_settings;
DROP POLICY IF EXISTS "用户只能删除自己的设置" ON user_settings;

-- 创建完善的用户设置RLS策略
CREATE POLICY "user_settings_select_policy"
ON user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_settings_insert_policy"
ON user_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings_update_policy"
ON user_settings FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_settings_delete_policy"
ON user_settings FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 创建RLS策略测试函数 - 修复版本
-- =====================================================

-- 创建测试RLS策略有效性的函数
CREATE OR REPLACE FUNCTION test_rls_policies()
RETURNS TABLE(
    table_name TEXT,
    policy_count INTEGER,
    rls_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT,
        COUNT(p.policyname)::INTEGER as policy_count,
        t.rowsecurity as rls_enabled
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename IN (
        'user_profiles', 'user_subscriptions', 'categories', 
        'payment_methods', 'subscriptions', 'payment_history', 'user_settings'
    )
    GROUP BY t.tablename, t.rowsecurity
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 创建数据隔离验证函数 - 修复版本
-- =====================================================

-- 创建验证数据隔离的函数
CREATE OR REPLACE FUNCTION verify_data_isolation(test_user_id UUID)
RETURNS TABLE(
    test_name TEXT,
    result BOOLEAN,
    message TEXT
) AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- 获取当前用户ID
    current_user_id := auth.uid();
    
    -- 测试1: 验证用户只能看到自己的订阅
    RETURN QUERY
    SELECT 
        'subscription_isolation'::TEXT,
        (SELECT COUNT(*) FROM subscriptions WHERE user_id != current_user_id) = 0,
        '用户只能访问自己的订阅数据'::TEXT;
    
    -- 测试2: 验证用户只能看到自己的支付历史
    RETURN QUERY
    SELECT 
        'payment_history_isolation'::TEXT,
        (SELECT COUNT(*) FROM payment_history WHERE user_id != current_user_id) = 0,
        '用户只能访问自己的支付历史'::TEXT;
    
    -- 测试3: 验证用户可以访问默认分类
    RETURN QUERY
    SELECT 
        'default_categories_access'::TEXT,
        (SELECT COUNT(*) FROM categories WHERE is_default = true) > 0,
        '用户可以访问默认分类'::TEXT;
    
    -- 测试4: 验证用户可以访问默认支付方式
    RETURN QUERY
    SELECT 
        'default_payment_methods_access'::TEXT,
        (SELECT COUNT(*) FROM payment_methods WHERE is_default = true) > 0,
        '用户可以访问默认支付方式'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 添加性能优化索引
-- =====================================================

-- 为RLS策略添加性能优化索引
CREATE INDEX IF NOT EXISTS idx_categories_user_id_default ON categories(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id_default ON payment_methods(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id_date ON payment_history(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id_key ON user_settings(user_id, setting_key);

-- =====================================================
-- 创建RLS策略监控视图
-- =====================================================

-- 创建监控RLS策略的视图
CREATE OR REPLACE VIEW rls_policy_status AS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    COUNT(policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY schemaname, tablename, rowsecurity
ORDER BY tablename;

-- 授予认证用户查看权限
GRANT SELECT ON rls_policy_status TO authenticated;