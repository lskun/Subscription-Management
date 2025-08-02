-- =====================================================
-- 清理有问题的触发器和函数
-- =====================================================

-- 删除有问题的触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 删除有问题的函数
DROP FUNCTION IF EXISTS handle_new_user();

-- 注意：我们将使用以下方法之一来处理新用户注册：
-- 1. Database Webhooks（推荐）
-- 2. 客户端调用 initialize_user_data 函数
-- 3. Auth Hooks

-- initialize_user_data 函数已经在 002_user_triggers.sql 中创建，可以直接使用