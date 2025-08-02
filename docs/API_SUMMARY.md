# API接口总结

## 概述

本项目基于Supabase构建，提供完整的RESTful API和实时功能。所有API都通过Supabase的统一接口访问，支持行级安全(RLS)和实时订阅。

**基础URL**: `https://your-project.supabase.co`

## 认证方式

### Supabase Auth
- **登录**: `POST /auth/v1/token` - Google OAuth登录
- **登出**: `POST /auth/v1/logout`
- **刷新令牌**: `POST /auth/v1/token?grant_type=refresh_token`
- **用户信息**: `GET /auth/v1/user`

## 核心API接口

### 1. 用户管理

#### 用户配置
```http
GET    /rest/v1/user_profiles          # 获取用户配置
POST   /rest/v1/user_profiles          # 创建用户配置
PATCH  /rest/v1/user_profiles?id=eq.{id} # 更新用户配置
DELETE /rest/v1/user_profiles?id=eq.{id} # 删除用户配置
```

#### 用户权限
```http
GET    /rest/v1/user_permissions       # 获取用户权限
POST   /rest/v1/user_permissions       # 分配权限
DELETE /rest/v1/user_permissions?id=eq.{id} # 撤销权限
```

#### 用户配额
```http
GET    /rest/v1/user_quota_usage       # 获取配额使用情况
POST   /rest/v1/user_quota_usage       # 创建配额记录
PATCH  /rest/v1/user_quota_usage?id=eq.{id} # 更新配额
```

### 2. 订阅管理

#### 订阅CRUD
```http
GET    /rest/v1/subscriptions          # 获取订阅列表
POST   /rest/v1/subscriptions          # 创建订阅
PATCH  /rest/v1/subscriptions?id=eq.{id} # 更新订阅
DELETE /rest/v1/subscriptions?id=eq.{id} # 删除订阅
```

#### 订阅统计
```http
GET    /rest/v1/rpc/get_subscription_stats # 获取订阅统计
GET    /rest/v1/rpc/get_upcoming_renewals  # 获取即将续费订阅
GET    /rest/v1/rpc/get_expired_subscriptions # 获取过期订阅
```

#### 分类管理
```http
GET    /rest/v1/categories             # 获取分类列表
POST   /rest/v1/categories             # 创建分类
PATCH  /rest/v1/categories?id=eq.{id}  # 更新分类
DELETE /rest/v1/categories?id=eq.{id}  # 删除分类
```

#### 支付方式
```http
GET    /rest/v1/payment_methods        # 获取支付方式
POST   /rest/v1/payment_methods        # 创建支付方式
PATCH  /rest/v1/payment_methods?id=eq.{id} # 更新支付方式
DELETE /rest/v1/payment_methods?id=eq.{id} # 删除支付方式
```

### 3. 财务分析

#### 支付历史
```http
GET    /rest/v1/payment_history        # 获取支付历史
POST   /rest/v1/payment_history        # 创建支付记录
PATCH  /rest/v1/payment_history?id=eq.{id} # 更新支付记录
DELETE /rest/v1/payment_history?id=eq.{id} # 删除支付记录
```

#### 费用统计
```http
GET    /rest/v1/rpc/get_monthly_expenses    # 月度费用统计
GET    /rest/v1/rpc/get_yearly_expenses     # 年度费用统计
GET    /rest/v1/rpc/get_category_breakdown  # 分类费用分析
```

#### 汇率管理
```http
GET    /rest/v1/exchange_rates         # 获取汇率数据
POST   /rest/v1/exchange_rates         # 更新汇率
PATCH  /rest/v1/exchange_rates?id=eq.{id} # 更新特定汇率
GET    /rest/v1/rpc/convert_currency   # 货币转换
```

#### 月度汇总
```http
GET    /rest/v1/monthly_category_summary # 获取月度分类汇总
POST   /rest/v1/monthly_category_summary # 创建月度汇总
PATCH  /rest/v1/monthly_category_summary?id=eq.{id} # 更新汇总
```

### 4. 通知系统

#### 通知管理
```http
GET    /rest/v1/notifications          # 获取通知列表
POST   /rest/v1/notifications          # 创建通知
PATCH  /rest/v1/notifications?id=eq.{id} # 标记通知已读
DELETE /rest/v1/notifications?id=eq.{id} # 删除通知
```

#### 邮件日志
```http
GET    /rest/v1/email_logs             # 获取邮件日志
POST   /rest/v1/email_logs             # 创建邮件日志
```

#### 邮件偏好
```http
GET    /rest/v1/email_preferences      # 获取邮件偏好
POST   /rest/v1/email_preferences      # 设置邮件偏好
PATCH  /rest/v1/email_preferences?user_id=eq.{id} # 更新偏好
```

### 5. 管理员系统

#### 管理员用户
```http
GET    /rest/v1/admin_users            # 获取管理员列表
POST   /rest/v1/admin_users            # 创建管理员
PATCH  /rest/v1/admin_users?id=eq.{id} # 更新管理员信息
DELETE /rest/v1/admin_users?id=eq.{id} # 删除管理员
```

#### 管理员角色
```http
GET    /rest/v1/admin_roles            # 获取角色列表
POST   /rest/v1/admin_roles            # 创建角色
PATCH  /rest/v1/admin_roles?id=eq.{id} # 更新角色
DELETE /rest/v1/admin_roles?id=eq.{id} # 删除角色
```

#### 操作日志
```http
GET    /rest/v1/admin_operation_logs   # 获取操作日志
POST   /rest/v1/admin_operation_logs   # 记录操作日志
```

#### 管理员会话
```http
GET    /rest/v1/admin_sessions         # 获取会话列表
POST   /rest/v1/admin_sessions         # 创建会话
PATCH  /rest/v1/admin_sessions?id=eq.{id} # 更新会话状态
```

## Edge Functions

### 邮件服务
```http
POST   /functions/v1/send-notification-email # 发送通知邮件
POST   /functions/v1/send-welcome-email      # 发送欢迎邮件
```

### 汇率服务
```http
POST   /functions/v1/update-exchange-rates   # 更新汇率数据
```

### 用户服务
```http
POST   /functions/v1/handle-new-user         # 处理新用户注册
```

## 实时订阅

### Realtime Channels
```javascript
// 订阅订阅数据变化
supabase
  .channel('subscriptions')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'subscriptions' },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe()

// 订阅通知变化
supabase
  .channel('notifications')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    (payload) => console.log('New notification!', payload)
  )
  .subscribe()
```

## 查询参数

### 过滤参数
```http
# 等于
GET /rest/v1/subscriptions?status=eq.active

# 不等于
GET /rest/v1/subscriptions?status=neq.cancelled

# 大于
GET /rest/v1/subscriptions?amount=gt.10

# 小于
GET /rest/v1/subscriptions?amount=lt.100

# 包含
GET /rest/v1/subscriptions?name=ilike.*netflix*

# 在范围内
GET /rest/v1/subscriptions?created_at=gte.2024-01-01&created_at=lte.2024-12-31
```

### 排序和分页
```http
# 排序
GET /rest/v1/subscriptions?order=created_at.desc

# 分页
GET /rest/v1/subscriptions?limit=10&offset=20

# 选择字段
GET /rest/v1/subscriptions?select=id,name,amount
```

### 关联查询
```http
# 包含关联数据
GET /rest/v1/subscriptions?select=*,categories(*),payment_methods(*)

# 过滤关联数据
GET /rest/v1/subscriptions?select=*,categories!inner(*)&categories.name=eq.Entertainment
```

## 错误处理

### HTTP状态码
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `403` - 禁止访问
- `404` - 资源不存在
- `409` - 冲突
- `422` - 验证失败
- `500` - 服务器内部错误

### 错误响应格式
```json
{
  "code": "PGRST116",
  "details": "The result contains 0 rows",
  "hint": null,
  "message": "JSON object requested, multiple (or no) rows returned"
}
```

## 认证头部

### 必需的请求头
```http
Authorization: Bearer <jwt_token>
apikey: <anon_key>
Content-Type: application/json
Prefer: return=representation  # 返回完整数据
```

## 使用示例

### 创建订阅
```javascript
const { data, error } = await supabase
  .from('subscriptions')
  .insert({
    name: 'Netflix',
    plan: 'Premium',
    amount: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active'
  })
  .select()
```

### 获取用户订阅
```javascript
const { data, error } = await supabase
  .from('subscriptions')
  .select(`
    *,
    categories(*),
    payment_methods(*)
  `)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

### 实时监听
```javascript
const subscription = supabase
  .channel('public:subscriptions')
  .on('postgres_changes', 
    { 
      event: '*', 
      schema: 'public', 
      table: 'subscriptions',
      filter: `user_id=eq.${user.id}`
    },
    (payload) => {
      console.log('Subscription changed:', payload)
    }
  )
  .subscribe()
```

## 安全性

### Row Level Security (RLS)
所有表都启用了RLS策略，确保用户只能访问自己的数据：

```sql
-- 用户只能查看自己的订阅
CREATE POLICY "用户只能查看自己的订阅"
ON subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 用户只能创建自己的订阅
CREATE POLICY "用户只能创建自己的订阅"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

### API密钥管理
- **匿名密钥**: 用于公开访问，受RLS策略限制
- **服务密钥**: 用于服务端操作，绕过RLS策略
- **JWT令牌**: 用于用户认证，包含用户身份信息

---

**注意**: 本文档基于Supabase v2.x版本。具体API可能因版本而异，请参考最新的Supabase文档。