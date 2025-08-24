-- 统一通知系统重构 - 第二阶段：简化的定时任务调度
-- 创建日期: 2025-08-21
-- 描述: 复用现有scheduler_jobs表和模板，添加通知调度任务

BEGIN;

-- 在现有scheduler_jobs表中添加通知调度任务
INSERT INTO scheduler_jobs (
  job_name,
  job_type,
  cron_spec,
  timezone,
  is_enabled,
  payload
) VALUES
-- 订阅到期提醒检查 - 每天上午9点运行
(
  'subscription_expiry_notifications',
  'edge_function',
  '0 9 * * *',
  'Asia/Shanghai',
  true,
  '{
    "function_name": "notification-scheduler",
    "notification_types": ["subscription_expiry_7_days", "subscription_expiry_3_days", "subscription_expiry_1_day"],
    "check_user_settings": true,
    "batch_size": 100
  }'::jsonb
),
-- 订阅已过期通知 - 每天上午10点运行
(
  'subscription_expired_notifications',
  'edge_function', 
  '0 10 * * *',
  'Asia/Shanghai',
  true,
  '{
    "function_name": "notification-scheduler",
    "notification_types": ["subscription_expired"],
    "check_user_settings": true,
    "max_days_after_expiry": 30
  }'::jsonb
),
-- 支付失败重试提醒 - 每天下午2点运行
(
  'payment_failed_notifications',
  'edge_function',
  '0 14 * * *', 
  'Asia/Shanghai',
  true,
  '{
    "function_name": "notification-scheduler",
    "notification_types": ["payment_failed_retry"],
    "check_user_settings": true,
    "max_retry_days": 7
  }'::jsonb
)
ON CONFLICT (job_name) DO UPDATE SET
  payload = EXCLUDED.payload,
  updated_at = NOW();

-- 插入通知规则到现有的notification_rules表
INSERT INTO notification_rules (
  name,
  notification_type,
  conditions,
  actions,
  priority,
  is_active
) VALUES
-- 订阅到期提醒规则
(
  'Subscription Expiry Notification Rule',
  'subscription_expiry',
  '{
    "user_settings_check": {
      "table": "user_settings",
      "key": "notifications",
      "field": "subscription_expiry_reminders",
      "required_value": true
    },
    "subscription_status": ["active", "trial"],
    "exclude_auto_renew": false,
    "quiet_hours": {
      "respect_user_timezone": true,
      "default_start": "22:00",
      "default_end": "08:00"
    }
  }'::jsonb,
  '{
    "channels": ["email", "in_app"],
    "batch_size": 100,
    "rate_limit": {
      "max_per_hour": 1000,
      "max_per_user_per_day": 3
    },
    "retry_policy": {
      "max_retries": 3,
      "backoff_minutes": [5, 15, 60]
    }
  }'::jsonb,
  100,
  true
),
-- 支付失败通知规则
(
  'Payment Failed Notification Rule',
  'payment_failed',
  '{
    "user_settings_check": {
      "table": "user_settings",
      "key": "notifications", 
      "field": "payment_notifications",
      "required_value": true
    },
    "payment_status": ["failed", "declined", "insufficient_funds"],
    "max_notification_frequency": "daily",
    "exclude_resolved": true
  }'::jsonb,
  '{
    "channels": ["email", "in_app"],
    "immediate_send": true,
    "priority": "high",
    "rate_limit": {
      "max_per_user_per_day": 5
    }
  }'::jsonb,
  200,
  true
);

COMMIT;