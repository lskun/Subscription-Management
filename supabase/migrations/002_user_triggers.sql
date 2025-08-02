-- =====================================================
-- 用户注册触发器配置
-- =====================================================

-- 创建处理新用户注册的函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 调用Edge Function处理新用户初始化
  PERFORM
    net.http_post(
      url := 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/handle-new-user',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW)
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器，当新用户在auth.users表中创建时触发
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 注意：由于我们无法直接在auth.users表上创建触发器（这是Supabase管理的表），
-- 我们需要使用Supabase的Webhooks功能来处理新用户注册事件。
-- 
-- 请在Supabase Dashboard中配置Webhook：
-- 1. 进入 Database > Webhooks
-- 2. 创建新的Webhook
-- 3. 设置以下参数：
--    - Name: handle-new-user
--    - Table: auth.users
--    - Events: INSERT
--    - Type: HTTP Request
--    - HTTP Request URL: https://your-project-id.supabase.co/functions/v1/handle-new-user
--    - HTTP Headers: 
--      Content-Type: application/json
--      Authorization: Bearer YOUR_SERVICE_ROLE_KEY

-- 或者，我们可以使用Supabase Auth的钩子功能
-- 这需要在Supabase Dashboard的Auth设置中配置