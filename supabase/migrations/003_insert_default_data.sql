-- =====================================================
-- 插入默认数据
-- =====================================================

-- 插入默认订阅计划（如果不存在）
INSERT INTO subscription_plans (name, description, features, limits, is_default) 
SELECT '免费版', '完整功能，免费使用', 
       '{"all_current_features": true, "email_support": true}',
       '{"max_subscriptions": -1, "api_calls_per_hour": 1000}',
       true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE is_default = true);

-- 插入默认分类（如果不存在）
INSERT INTO categories (value, label, is_default) 
SELECT * FROM (VALUES
  ('streaming', '流媒体', true),
  ('software', '软件工具', true),
  ('cloud', '云服务', true),
  ('gaming', '游戏娱乐', true),
  ('productivity', '生产力工具', true),
  ('news', '新闻资讯', true),
  ('music', '音乐', true),
  ('fitness', '健身运动', true),
  ('education', '教育学习', true),
  ('other', '其他', true)
) AS v(value, label, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE categories.value = v.value AND categories.is_default = true
);

-- 插入默认支付方式（如果不存在）
INSERT INTO payment_methods (value, label, is_default) 
SELECT * FROM (VALUES
  ('credit_card', '信用卡', true),
  ('debit_card', '借记卡', true),
  ('alipay', '支付宝', true),
  ('wechat_pay', '微信支付', true),
  ('paypal', 'PayPal', true),
  ('bank_transfer', '银行转账', true),
  ('apple_pay', 'Apple Pay', true),
  ('google_pay', 'Google Pay', true)
) AS v(value, label, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods 
  WHERE payment_methods.value = v.value AND payment_methods.is_default = true
);