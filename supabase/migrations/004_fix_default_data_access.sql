-- =====================================================
-- 修复默认数据访问权限
-- =====================================================

-- 删除现有的分类SELECT策略
DROP POLICY IF EXISTS "用户可以访问默认分类和自己的分类" ON categories;

-- 创建新的分类SELECT策略，允许匿名用户访问默认分类
CREATE POLICY "所有用户可以访问默认分类，认证用户可以访问自己的分类"
ON categories FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 删除现有的支付方式SELECT策略
DROP POLICY IF EXISTS "用户可以访问默认支付方式和自己的支付方式" ON payment_methods;

-- 创建新的支付方式SELECT策略，允许匿名用户访问默认支付方式
CREATE POLICY "所有用户可以访问默认支付方式，认证用户可以访问自己的支付方式"
ON payment_methods FOR SELECT
TO public
USING (is_default = true OR (auth.uid() IS NOT NULL AND user_id = auth.uid()));

-- 订阅计划表不需要RLS，因为它是全局共享的
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;