# Supabase 数据库架构完整文档

## 概览

本文档详细描述了订阅管理系统的完整数据库架构，包括所有表结构、关系、触发器、函数和安全策略。

## 数据库结构概览

### 核心模块

1. **用户认证和授权** (`auth` schema)
2. **用户资料管理** (`user_profiles`, `user_settings`)
3. **订阅管理** (`subscriptions`, `categories`, `payment_methods`)
4. **支付历史** (`payment_history`)
5. **汇率管理** (`exchange_rates`, `exchange_rate_history`)
6. **通知系统** (`user_notifications`, `notification_templates`)
7. **邮件系统** (`email_logs`, `email_templates`, `email_queue`)
8. **管理员系统** (`admin_users`, `admin_roles`, `admin_sessions`)
9. **系统监控** (`system_health`, `system_stats`, `system_logs`)
10. **用户设置** (`user_settings`, `user_email_preferences`)

## 已安装的扩展

### 核心扩展
- `uuid-ossp`: UUID 生成
- `pgcrypto`: 加密函数
- `pg_stat_statements`: SQL 统计
- `pg_net`: HTTP 客户端
- `pg_graphql`: GraphQL 支持
- `supabase_vault`: Supabase Vault

## 表结构详解

### 认证相关表 (auth schema)

#### auth.users
- **用途**: 用户基础信息表，由 Supabase 自动管理
- **主要字段**: id, email, encrypted_password, email_confirmed_at, created_at, updated_at
- **关系**: 一对一关联 user_profiles

#### auth.sessions
- **用途**: 用户会话表，存储用户登录会话信息
- **主要字段**: id, user_id, created_at, updated_at, not_after
- **关系**: 多对一关联 auth.users

#### auth.refresh_tokens
- **用途**: 刷新令牌表，存储 JWT 刷新令牌
- **主要字段**: id, token, user_id, revoked, created_at, updated_at
- **关系**: 多对一关联 auth.sessions

#### auth.identities
- **用途**: 身份认证表，存储用户的身份认证信息
- **主要字段**: id, user_id, provider, provider_id, identity_data
- **关系**: 多对一关联 auth.users

### 用户相关表

#### user_profiles
- **用途**: 用户资料表，存储用户的详细资料信息
- **主要字段**: id, display_name, avatar_url, timezone, language, last_login_time, is_blocked, email
- **关系**: 一对一关联 auth.users
- **索引**: idx_user_profiles_user_id, idx_user_profiles_email, idx_user_profiles_last_login

#### user_settings
- **用途**: 用户设置表，存储用户的个性化设置
- **主要字段**: id, user_id, setting_key, setting_value, created_at, updated_at
- **关系**: 多对一关联 auth.users
- **约束**: UNIQUE(user_id, setting_key)
- **索引**: idx_user_settings_user_id, idx_user_settings_key

### 订阅管理相关表

#### subscription_plans
- **用途**: 订阅计划表，存储系统的订阅计划信息
- **主要字段**: id, name, description, price_monthly, price_yearly, features, limits, stripe_price_id_monthly, stripe_price_id_yearly, is_active, is_default
- **关系**: 一对多关联 user_subscriptions

#### categories
- **用途**: 分类表，存储订阅服务的分类信息
- **主要字段**: id, user_id, value, label, is_default, created_at, updated_at
- **关系**: 多对一关联 auth.users，一对多关联 subscriptions

#### payment_methods
- **用途**: 支付方式表，存储用户的支付方式信息
- **主要字段**: id, user_id, value, label, is_default, created_at, updated_at
- **关系**: 多对一关联 auth.users，一对多关联 subscriptions

#### subscriptions
- **用途**: 订阅表，存储用户的具体订阅信息
- **主要字段**: id, user_id, name, plan, billing_cycle, next_billing_date, amount, currency, payment_method_id, status, category_id, renewal_type
- **关系**: 多对一关联 auth.users, categories, payment_methods
- **约束**: billing_cycle IN ('monthly', 'yearly', 'quarterly'), status IN ('active', 'inactive', 'cancelled')
- **索引**: idx_subscriptions_user_id, idx_subscriptions_status, idx_subscriptions_next_billing

#### payment_history
- **用途**: 支付历史表，存储用户的支付记录
- **主要字段**: id, user_id, subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status
- **关系**: 多对一关联 auth.users, subscriptions
- **约束**: status IN ('succeeded', 'failed', 'refunded')
- **索引**: idx_payment_history_user_id, idx_payment_history_subscription_id, idx_payment_history_date

### 汇率管理相关表

#### exchange_rates
- **用途**: 汇率表，存储当前汇率信息
- **主要字段**: id, from_currency, to_currency, rate, date, source, created_at, updated_at
- **约束**: UNIQUE(from_currency, to_currency, date), source IN ('api', 'manual', 'system', 'mock')
- **索引**: idx_exchange_rates_currencies, idx_exchange_rates_date

#### exchange_rate_history
- **用途**: 汇率历史表，存储历史汇率数据
- **主要字段**: id, from_currency, to_currency, rate, date, source, created_at, updated_at
- **约束**: source IN ('api', 'manual', 'system', 'mock')
- **索引**: idx_exchange_rate_history_currencies, idx_exchange_rate_history_date

#### exchange_rate_update_logs
- **用途**: 汇率更新日志表，记录汇率更新操作的日志
- **主要字段**: id, update_type, status, rates_updated, error_message, source, started_at, completed_at
- **约束**: update_type IN ('scheduled', 'manual', 'api'), status IN ('success', 'failed', 'partial')

### 通知系统相关表

#### notification_templates
- **用途**: 通知模板表，存储系统通知模板
- **主要字段**: id, template_key, name, description, title_template, message_template, type, priority, action_url_template, action_label, variables, is_active
- **约束**: UNIQUE(template_key)

#### user_notifications
- **用途**: 用户通知表，存储应用内通知
- **主要字段**: id, user_id, title, message, type, priority, is_read, is_archived, action_url, action_label, metadata, expires_at
- **关系**: 多对一关联 auth.users
- **约束**: type IN ('info', 'success', 'warning', 'error', 'subscription', 'payment', 'system', 'security'), priority IN ('low', 'normal', 'high', 'urgent')
- **索引**: idx_user_notifications_user_id, idx_user_notifications_type, idx_user_notifications_created_at, idx_user_notifications_is_read

#### user_notification_preferences
- **用途**: 用户通知偏好设置表
- **主要字段**: id, user_id, notification_type, enabled, push_enabled, email_enabled, in_app_enabled
- **关系**: 多对一关联 auth.users
- **约束**: UNIQUE(user_id, notification_type)

### 邮件系统相关表

#### email_templates
- **用途**: 邮件模板表，存储系统邮件模板
- **主要字段**: id, template_key, name, description, subject_template, html_template, text_template, variables, is_active
- **约束**: UNIQUE(template_key)

#### email_logs
- **用途**: 邮件发送日志表，记录所有邮件发送状态
- **主要字段**: id, user_id, email_address, email_type, status, error_message, external_email_id, metadata, sent_at, updated_at
- **关系**: 多对一关联 auth.users
- **约束**: email_type IN ('welcome', 'subscription_expiry', 'payment_failed', 'payment_success', 'quota_warning', 'security_alert', 'system_update', 'password_reset'), status IN ('pending', 'sent', 'failed', 'delivered', 'bounced', 'complained')
- **索引**: idx_email_logs_user_id, idx_email_logs_type, idx_email_logs_status

#### email_queue
- **用途**: 邮件队列表，用于批量发送和重试机制
- **主要字段**: id, user_id, email_address, email_type, template_data, priority, scheduled_at, attempts, max_attempts, status, error_message
- **关系**: 多对一关联 auth.users
- **约束**: priority >= 1 AND priority <= 10, status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')
- **索引**: idx_email_queue_status, idx_email_queue_scheduled_at

#### user_email_preferences
- **用途**: 用户邮件偏好设置表
- **主要字段**: id, user_id, email_type, enabled, frequency
- **关系**: 多对一关联 auth.users
- **约束**: UNIQUE(user_id, email_type), frequency IN ('immediate', 'daily', 'weekly', 'never')

### 管理员系统相关表

#### admin_roles
- **用途**: 管理员角色表
- **主要字段**: id, name, description, permissions, is_active
- **约束**: UNIQUE(name)

#### admin_users
- **用途**: 管理员用户表
- **主要字段**: id, user_id, role_id, is_active, created_by
- **关系**: 多对一关联 auth.users, admin_roles
- **约束**: UNIQUE(user_id)
- **索引**: idx_admin_users_user_id, idx_admin_users_role_id

#### admin_sessions
- **用途**: 管理员会话表
- **主要字段**: id, admin_user_id, session_token, expires_at, ip_address, user_agent, is_active
- **关系**: 多对一关联 admin_users
- **约束**: UNIQUE(session_token)

#### admin_operation_logs
- **用途**: 管理员操作日志表
- **主要字段**: id, admin_user_id, operation_type, target_type, target_id, operation_details, ip_address, user_agent
- **关系**: 多对一关联 admin_users
- **索引**: idx_admin_operation_logs_admin_user_id, idx_admin_operation_logs_created_at

### 系统监控相关表

#### system_settings
- **用途**: 系统设置表
- **主要字段**: id, setting_key, setting_value, description, is_public
- **约束**: UNIQUE(setting_key)

#### system_health
- **用途**: 系统健康状态表
- **主要字段**: id, service_name, status, response_time, error_message, metadata, checked_at
- **约束**: status IN ('healthy', 'warning', 'error')
- **索引**: idx_system_health_service_name, idx_system_health_status

#### system_stats
- **用途**: 系统统计表
- **主要字段**: id, stat_type, stat_value, metadata, recorded_at
- **索引**: idx_system_stats_type, idx_system_stats_recorded_at

#### system_logs
- **用途**: 系统日志表
- **主要字段**: id, log_type, message, metadata, created_at

## 触发器和函数

### 核心函数

#### update_updated_at_column()
- **用途**: 更新时间戳触发器函数
- **触发器**: 应用于所有需要自动更新 updated_at 字段的表

#### initialize_user_data()
- **用途**: 用户初始化函数，在用户注册时自动创建相关数据
- **触发器**: on_auth_user_created (auth.users 表的 AFTER INSERT 触发器)
- **功能**: 
  - 创建用户资料
  - 创建默认分类
  - 创建默认支付方式
  - 创建默认邮件偏好设置
  - 创建默认通知偏好设置

#### archive_exchange_rate()
- **用途**: 汇率历史记录函数，在汇率更新时将旧值存入历史表
- **触发器**: archive_exchange_rate_trigger (exchange_rates 表的 BEFORE UPDATE 触发器)

### 业务函数

#### get_user_subscription_stats(user_uuid UUID)
- **用途**: 获取用户订阅统计信息
- **返回**: JSON 格式的统计数据
- **权限**: SECURITY DEFINER

#### cleanup_expired_notifications()
- **用途**: 清理过期通知
- **返回**: 删除的记录数量
- **权限**: SECURITY DEFINER

#### update_system_stats()
- **用途**: 更新系统统计数据
- **权限**: SECURITY DEFINER

## 行级安全策略 (RLS)

### 用户数据访问策略
- 用户只能访问自己的数据
- 汇率数据对所有认证用户可见
- 管理员可以访问管理相关数据

### 主要策略
- `Users can view own profile`: 用户可以查看自己的资料
- `Users can update own profile`: 用户可以更新自己的资料
- `Users can view own settings`: 用户可以查看自己的设置
- `Users can view own subscriptions`: 用户可以查看自己的订阅
- `Authenticated users can view exchange rates`: 认证用户可以查看汇率

## 视图定义

### user_stats
- **用途**: 用户统计视图
- **包含**: 用户基本信息、订阅数量、总费用、支付次数等

### subscription_stats
- **用途**: 订阅统计视图
- **包含**: 订阅详情、分类、支付方式、账单状态等

### system_health_summary
- **用途**: 系统健康状态汇总视图
- **包含**: 服务状态、平均响应时间、检查次数等

## 默认数据

### 订阅计划
- 免费版：基础功能，适合个人用户
- 专业版：完整功能，适合专业用户
- 企业版：企业级功能和支持

### 管理员角色
- 超级管理员：拥有所有权限
- 用户管理员：负责用户管理
- 系统监控员：负责系统监控

### 邮件模板
- 欢迎邮件
- 订阅到期提醒
- 支付失败通知
- 支付成功通知

### 通知模板
- 订阅到期提醒
- 支付失败
- 支付成功
- 配额警告
- 安全警告

### 系统设置
- 应用程序名称和版本
- 维护模式开关
- 各种功能开关和限制

## 性能优化

### 索引策略
- 为所有外键创建索引
- 为常用查询字段创建索引
- 为时间字段创建索引以支持时间范围查询

### 查询优化
- 使用视图简化复杂查询
- 合理使用 JSONB 字段存储非结构化数据
- 定期分析查询性能

## 安全措施

### 访问控制
- 启用行级安全策略 (RLS)
- 最小权限原则
- 定期审查权限设置

### 数据保护
- 敏感数据加密存储
- 审计日志记录
- 定期备份和恢复测试

## 维护建议

### 定期任务
- 清理过期通知
- 更新系统统计
- 清理旧日志数据
- 备份重要数据

### 监控指标
- 数据库性能指标
- 业务指标监控
- 系统健康状态
- 用户活跃度

### 扩展性考虑
- 分区大表以提高性能
- 考虑读写分离
- 监控存储空间使用
- 规划容量增长

## 迁移历史

系统已执行的迁移文件：
1. `006_enhance_rls_policies_simplified`
2. `007_fix_rls_anonymous_access_simplified`
3. `enhance_exchange_rates`
4. `exchange_rate_triggers_functions`
5. `exchange_rate_rls_policies`
6. `exchange_rate_helper_functions`
7. `exchange_rate_permissions`
8. `allow_anon_exchange_rates`
9. `fix_exchange_rate_source_constraint`
10. `email_notification_system_fixed`
11. `user_notifications_system`
12. `admin_system`
13. `create_user_initialization_functions`
14. `recreate_initialize_user_data_function`
15. `fix_user_subscriptions_constraints_and_function`
16. `add_test_data_for_dashboard_validation`
17. `add_corrected_subscription_test_data`
18. `add_corrected_payment_history_test_data`
19. `create_system_settings_table`
20. `create_system_monitoring_tables`
21. `add_user_activity_fields`

## 总结

本数据库架构为订阅管理系统提供了完整的数据存储和管理解决方案，包含了用户管理、订阅管理、支付处理、通知系统、邮件系统、管理员系统和系统监控等核心功能。通过合理的表结构设计、索引优化、安全策略和维护机制，确保系统的高性能、高可用性和数据安全性。