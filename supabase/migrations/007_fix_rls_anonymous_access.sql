-- =====================================================
-- 修复RLS策略 - 确保匿名用户无法访问受保护的表
-- =====================================================

-- 确保所有需要认证的表都启用RLS并且只允许认证用户访问
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 删除所有现有的策略，重新创建更严格的策略
-- =====================================================
-- 用户配置表 - 只允许认证用户访问自己的数据
-- =====================================================
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;

CREATE POLICY "user_profiles_authenticated_only"
ON user_profiles FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- =====================================================
-- 用户订阅表 - 只允许认证用户访问自己的数据
-- =====================================================
DROP POLICY IF EXISTS "user_subscriptions_select_policy" ON user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_insert_policy" ON user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_update_policy" ON user_subscriptions;
DROP POLICY IF EXISTS "user_subscriptions_delete_policy" ON user_subscriptions;

CREATE POLICY "user_subscriptions_authenticated_only"
ON user_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 订阅表 - 只允许认证用户访问自己的数据
-- =====================================================
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_policy" ON subscriptions;

CREATE POLICY "subscriptions_authenticated_only"
ON subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 支付历史表 - 只允许认证用户访问自己的数据
-- =====================================================
DROP POLICY IF EXISTS "payment_history_select_policy" ON payment_history;
DROP POLICY IF EXISTS "payment_history_insert_policy" ON payment_history;
DROP POLICY IF EXISTS "payment_history_update_policy" ON payment_history;
DROP POLICY IF EXISTS "payment_history_delete_policy" ON payment_history;

CREATE POLICY "payment_history_authenticated_only"
ON payment_history FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 用户设置表 - 只允许认证用户访问自己的数据
-- =====================================================
DROP POLICY IF EXISTS "user_settings_select_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_update_policy" ON user_settings;
DROP POLICY IF EXISTS "user_settings_delete_policy" ON user_settings;

CREATE POLICY "user_settings_authenticated_only"
ON user_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 分类表 - 允许所有用户访问默认分类，只允许认证用户管理自己的分类
-- =====================================================
DROP POLICY IF EXISTS "categories_select_policy" ON categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON categories;
DROP POLICY IF EXISTS "categories_update_policy" ON categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON categories;

-- 允许所有用户查看默认分类，认证用户可以查看自己的分类
CREATE POLICY "categories_select_policy"
ON categories FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 只允许认证用户创建自己的分类
CREATE POLICY "categories_insert_policy"
ON categories FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只允许认证用户更新自己的分类（不能更新默认分类）
CREATE POLICY "categories_update_policy"
ON categories FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_default = false)
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只允许认证用户删除自己的分类（不能删除默认分类）
CREATE POLICY "categories_delete_policy"
ON categories FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_default = false);

-- =====================================================
-- 支付方式表 - 允许所有用户访问默认支付方式，只允许认证用户管理自己的支付方式
-- =====================================================
DROP POLICY IF EXISTS "payment_methods_select_policy" ON payment_methods;
DROP POLICY IF EXISTS "payment_methods_insert_policy" ON payment_methods;
DROP POLICY IF EXISTS "payment_methods_update_policy" ON payment_methods;
DROP POLICY IF EXISTS "payment_methods_delete_policy" ON payment_methods;

-- 允许所有用户查看默认支付方式，认证用户可以查看自己的支付方式
CREATE POLICY "payment_methods_select_policy"
ON payment_methods FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 只允许认证用户创建自己的支付方式
CREATE POLICY "payment_methods_insert_policy"
ON payment_methods FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只允许认证用户更新自己的支付方式（不能更新默认支付方式）
CREATE POLICY "payment_methods_update_policy"
ON payment_methods FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND is_default = false)
WITH CHECK (user_id = auth.uid() AND is_default = false);

-- 只允许认证用户删除自己的支付方式（不能删除默认支付方式）
CREATE POLICY "payment_methods_delete_policy"
ON payment_methods FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND is_default = false);

-- =====================================================
-- 验证RLS策略的函数
-- =====================================================

-- 创建验证RLS策略的函数
CREATE OR REPLACE FUNCTION verify_rls_security()
RETURNS TABLE(
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count INTEGER,
    security_status TEXT
) AS $$
DECLARE
    rec RECORD;
    policy_count INTEGER;
BEGIN
    -- 检查每个表的RLS状态和策略数量
    FOR rec IN 
        SELECT t.tablename, t.rowsecurity
        FROM pg_tables t
        WHERE t.schemaname = 'public'
        AND t.tablename IN (
            'user_profiles', 'user_subscriptions', 'categories', 
            'payment_methods', 'subscriptions', 'payment_history', 'user_settings'
        )
    LOOP
        -- 计算策略数量
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies p
        WHERE p.tablename = rec.tablename;
        
        -- 返回结果
        table_name := rec.tablename;
        rls_enabled := rec.rowsecurity;
        policy_count := policy_count;
        
        -- 确定安全状态
        IF rec.rowsecurity AND policy_count > 0 THEN
            security_status := '✅ 安全';
        ELSIF rec.rowsecurity AND policy_count = 0 THEN
            security_status := '⚠️ RLS已启用但无策略';
        ELSE
            security_status := '❌ RLS未启用';
        END IF;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 授予认证用户执行权限
GRANT EXECUTE ON FUNCTION verify_rls_security() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_rls_security() TO anon;