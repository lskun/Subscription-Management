# 数据库 Schema 快照（自动生成）

说明：本快照根据当前 Supabase 实时 schema 生成，涵盖表清单、RLS 状态、列类型/默认值/可空性、主键与外键、部分 check 约束。用于排查接口/权限/联表问题及与文档的差异比对。

---

## 公共 schema: public

### user_profiles
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - display_name: varchar, nullable
  - avatar_url: text, nullable
  - timezone: text, default 'UTC', nullable
  - language: text, default 'zh-CN', nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
  - last_login_time: timestamptz, nullable — 用户最后登录时间
  - is_blocked: boolean, default false, not null — 用户是否被锁定
  - email: varchar, nullable
- 外键
  - id → auth.users.id

### subscription_plans
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - name: text, not null
  - description: text, nullable
  - price_monthly: numeric, default 0, nullable
  - price_yearly: numeric, default 0, nullable
  - features: jsonb, default '{}', not null
  - limits: jsonb, default '{}', not null
  - stripe_price_id_monthly: text, nullable
  - stripe_price_id_yearly: text, nullable
  - is_active: boolean, default true, nullable
  - is_default: boolean, default false, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### user_subscriptions
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - plan_id: uuid, not null
  - stripe_subscription_id: text, nullable
  - status: text, default 'active', not null, check in ['active','canceled','past_due','unpaid']
  - current_period_start: timestamptz, default now(), nullable
  - current_period_end: timestamptz, nullable
  - cancel_at_period_end: boolean, default false, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id
  - plan_id → public.subscription_plans.id

### categories
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, nullable
  - value: text, not null
  - label: text, nullable
  - is_default: boolean, default false, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id

### payment_methods
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, nullable
  - value: text, not null
  - label: text, nullable
  - is_default: boolean, default false, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id

### subscriptions
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - name: text, not null
  - plan: text, not null
  - billing_cycle: text, not null, check in ['monthly','yearly','quarterly']
  - next_billing_date: date, nullable
  - last_billing_date: date, nullable
  - amount: numeric, not null
  - currency: text, default 'CNY', not null
  - payment_method_id: uuid, not null
  - start_date: date, nullable
  - status: text, default 'active', not null, check in ['active','trial','cancelled']
  - category_id: uuid, not null
  - renewal_type: text, default 'manual', not null, check in ['auto','manual']
  - notes: text, nullable
  - website: text, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id
  - payment_method_id → public.payment_methods.id
  - category_id → public.categories.id

### payment_history
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - subscription_id: uuid, not null
  - payment_date: date, not null
  - amount_paid: numeric, not null
  - currency: text, not null
  - billing_period_start: date, not null
  - billing_period_end: date, not null
  - status: text, default 'success', not null, check in ['success','failed','pending']
  - notes: text, nullable
  - created_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id
  - subscription_id → public.subscriptions.id

### exchange_rates
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - from_currency: text, not null
  - to_currency: text, not null
  - rate: numeric, not null
  - date: date, default CURRENT_DATE, not null
  - created_at: timestamptz, default now(), nullable
  - source: text, default 'api', nullable, check in ['api','manual','system','mock']
  - updated_at: timestamptz, default now(), nullable

### exchange_rate_history
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - from_currency: text, not null
  - to_currency: text, not null
  - rate: numeric, not null
  - date: date, not null
  - source: text, default 'api', nullable, check in ['api','manual','system','mock']
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### exchange_rate_update_logs
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - update_type: text, not null, check in ['scheduled','manual','api']
  - status: text, not null, check in ['success','failed','partial']
  - rates_updated: int4, default 0, nullable
  - error_message: text, nullable
  - source: text, default 'system', nullable
  - started_at: timestamptz, default now(), nullable
  - completed_at: timestamptz, nullable
  - created_at: timestamptz, default now(), nullable

### email_templates
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - template_key: text, unique, not null
  - name: text, not null
  - description: text, nullable
  - subject_template: text, not null
  - html_template: text, not null
  - text_template: text, not null
  - variables: jsonb, default '[]', nullable
  - is_active: boolean, default true, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### email_logs
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - email_address: text, not null
  - email_type: text, not null, check in ['welcome','subscription_expiry','payment_failed','payment_success','quota_warning','security_alert','system_update','password_reset']
  - status: text, default 'pending', not null, check in ['pending','sent','failed','delivered','bounced','complained']
  - error_message: text, nullable
  - external_email_id: text, nullable
  - metadata: jsonb, default '{}', nullable
  - sent_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id

### email_queue
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - email_address: text, not null
  - email_type: text, not null
  - template_data: jsonb, default '{}', nullable
  - priority: int4, default 5, nullable, check 1..10
  - scheduled_at: timestamptz, default now(), nullable
  - attempts: int4, default 0, nullable
  - max_attempts: int4, default 3, nullable
  - status: text, default 'pending', nullable, check in ['pending','processing','sent','failed','cancelled']
  - error_message: text, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id

### user_notifications
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, not null
  - title: text, not null
  - message: text, not null
  - type: text, not null, check in ['info','success','warning','error','subscription','payment','system','security']
  - priority: text, default 'normal', not null, check in ['low','normal','high','urgent']
  - is_read: boolean, default false, nullable
  - is_archived: boolean, default false, nullable
  - action_url: text, nullable
  - action_label: text, nullable
  - metadata: jsonb, default '{}', nullable
  - expires_at: timestamptz, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id

### notification_templates
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - template_key: text, unique, not null
  - name: text, not null
  - description: text, nullable
  - title_template: text, not null
  - message_template: text, not null
  - type: text, not null
  - priority: text, default 'normal', not null
  - action_url_template: text, nullable
  - action_label: text, nullable
  - variables: jsonb, default '[]', nullable
  - is_active: boolean, default true, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### admin_roles
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - name: text, unique, not null
  - description: text, nullable
  - permissions: jsonb, default '{}', not null
  - is_active: boolean, default true, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### admin_users
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - user_id: uuid, unique, not null
  - role_id: uuid, not null
  - is_active: boolean, default true, nullable
  - created_by: uuid, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable
- 外键
  - user_id → auth.users.id
  - role_id → public.admin_roles.id
  - created_by → auth.users.id

### admin_operation_logs
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - admin_user_id: uuid, not null
  - operation_type: text, not null
  - target_type: text, not null
  - target_id: text, nullable
  - operation_details: jsonb, default '{}', not null
  - ip_address: inet, nullable
  - user_agent: text, nullable
  - created_at: timestamptz, default now(), nullable
- 外键
  - admin_user_id → public.admin_users.id

### admin_sessions
- RLS: enabled
- 主键: id
- 列
  - id: uuid, not null
  - admin_user_id: uuid, not null
  - session_token: text, unique, not null
  - expires_at: timestamptz, not null
  - ip_address: inet, nullable
  - user_agent: text, nullable
  - is_active: boolean, default true, nullable
  - created_at: timestamptz, default now(), nullable
- 外键
  - admin_user_id → public.admin_users.id

### system_settings
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - setting_key: text, unique, not null
  - setting_value: jsonb, default '{}', not null
  - description: text, nullable
  - is_public: boolean, default false, nullable
  - created_at: timestamptz, default now(), nullable
  - updated_at: timestamptz, default now(), nullable

### system_health
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - service_name: text, not null
  - status: text, not null, check in ['healthy','warning','error']
  - response_time: int4, nullable
  - error_message: text, nullable
  - metadata: jsonb, default '{}', nullable
  - checked_at: timestamptz, default now(), nullable
  - created_at: timestamptz, default now(), nullable

### system_stats
- RLS: disabled
- 主键: id
- 列
  - id: uuid, not null
  - stat_type: text, not null
  - stat_value: int8, not null
  - metadata: jsonb, default '{}', nullable
  - recorded_at: timestamptz, default now(), nullable

---

生成时间：基于当前连接 Supabase 的实时查询结果。如有新迁移或表结构变更，请重新生成快照。
