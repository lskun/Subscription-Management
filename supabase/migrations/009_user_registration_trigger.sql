-- =====================================================
-- 用户注册触发器 - 自动初始化新用户
-- =====================================================

-- 创建处理新用户注册的函数
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- 调用Edge Function处理新用户初始化
  -- 使用pg_net扩展发送HTTP请求
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/handle-new-user',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'users',
        'record', jsonb_build_object(
          'id', NEW.id,
          'email', NEW.email,
          'created_at', NEW.created_at,
          'user_metadata', NEW.raw_user_meta_data,
          'app_metadata', NEW.raw_app_meta_data
        ),
        'schema', 'auth'
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器，当新用户插入到auth.users表时触发
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_registration();

-- 注意：由于我们无法直接在auth.users表上创建触发器（权限限制），
-- 我们需要使用Supabase的Database Webhooks功能来实现这个功能。
-- 
-- 请在Supabase Dashboard中配置Database Webhook：
-- 1. 进入 Database > Webhooks
-- 2. 创建新的Webhook
-- 3. 设置以下参数：
--    - Name: handle-new-user
--    - Table: auth.users
--    - Events: Insert
--    - Type: HTTP Request
--    - HTTP URL: https://your-project.supabase.co/functions/v1/handle-new-user
--    - HTTP Method: POST
--    - HTTP Headers: 
--      Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--      Content-Type: application/json

-- 或者，我们可以创建一个RPC函数来手动初始化用户数据
CREATE OR REPLACE FUNCTION initialize_user_data(user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  default_plan_id UUID;
  user_email TEXT;
BEGIN
  -- 获取用户邮箱
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  
  IF user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- 1. 创建用户配置（如果不存在）
  INSERT INTO user_profiles (id, display_name, timezone, language)
  VALUES (
    user_id,
    COALESCE(split_part(user_email, '@', 1), '新用户'),
    'Asia/Shanghai',
    'zh-CN'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. 获取默认免费订阅计划
  SELECT id INTO default_plan_id 
  FROM subscription_plans 
  WHERE is_default = true 
  LIMIT 1;

  IF default_plan_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Default plan not found');
  END IF;

  -- 3. 为用户分配免费订阅计划（如果不存在）
  INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start)
  VALUES (
    user_id,
    default_plan_id,
    'active',
    NOW()
  )
  ON CONFLICT (user_id, plan_id) DO NOTHING;

  -- 4. 初始化用户默认设置
  INSERT INTO user_settings (user_id, setting_key, setting_value)
  VALUES 
    (user_id, 'theme', '{"value": "system"}'::jsonb),
    (user_id, 'currency', '{"value": "CNY"}'::jsonb),
    (user_id, 'notifications', '{"email": true, "renewal_reminders": true, "payment_notifications": true}'::jsonb)
  ON CONFLICT (user_id, setting_key) DO NOTHING;

  -- 返回成功结果
  result := json_build_object(
    'success', true,
    'message', '用户数据初始化完成',
    'user_id', user_id,
    'email', user_email,
    'timestamp', NOW()
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- 返回错误信息
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'user_id', user_id,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予authenticated用户执行权限
GRANT EXECUTE ON FUNCTION initialize_user_data(UUID) TO authenticated;

-- 创建一个简化版本，供客户端调用（不需要参数，自动使用当前用户）
CREATE OR REPLACE FUNCTION initialize_current_user_data()
RETURNS JSON AS $$
BEGIN
  RETURN initialize_user_data(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予authenticated用户执行权限
GRANT EXECUTE ON FUNCTION initialize_current_user_data() TO authenticated;