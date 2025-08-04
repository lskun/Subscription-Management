# API请求映射文档

本文档记录了订阅管理应用中各个API请求与对应处理代码文件的映射关系。

## 概述

应用采用混合架构：
- **Supabase Edge Functions**: 处理复杂的业务逻辑和数据聚合
- **Supabase REST API**: 处理简单的CRUD操作
- **Supabase Auth API**: 处理用户认证

## API请求映射表

### 1. 认证相关API

| API请求 | 处理文件 | 说明 |
|---------|----------|------|
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/auth/v1/user` | `src/services/authService.ts` | 获取当前用户信息 |

**相关代码文件:**
- `src/contexts/AuthContext.tsx` - 认证上下文管理
- `src/services/sessionService.ts` - 会话管理
- `src/services/userInitializationService.ts` - 用户初始化

### 2. 用户配置相关API

| API请求 | 处理文件 | 说明 |
|---------|----------|------|
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/user_profiles?select=*&id=eq.{user_id}` | `src/services/userProfileService.ts` | 获取用户配置信息 |
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/user_profiles?select=id&id=eq.{user_id}` | `src/services/userProfileService.ts` | 检查用户配置是否存在 |
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/user_settings?select=setting_key%2Csetting_value&user_id=eq.{user_id}` | `src/services/supabaseUserSettingsService.ts` | 获取用户设置 |

**相关代码文件:**
- `src/components/user/UserProfileForm.tsx` - 用户配置表单
- `src/components/user/UserPreferencesForm.tsx` - 用户偏好设置表单
- `src/types/userProfile.ts` - 用户配置类型定义

### 3. 订阅管理相关API

#### 3.1 Edge Function API

| API请求 | 处理文件 | Edge Function | 说明 |
|---------|----------|---------------|------|
| `POST https://fbngjaewlcwnwrfqwygk.supabase.co/functions/v1/subscriptions-management` | `src/services/subscriptionsEdgeFunctionService.ts` | `supabase/functions/subscriptions-management/index.ts` | 获取订阅数据（包含分类、支付方式等） |

#### 3.2 直接数据库API

| API请求 | 处理文件 | 说明 |
|---------|----------|------|
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/user_subscriptions?select=id&user_id=eq.{user_id}` | `src/services/supabaseSubscriptionService.ts` | 获取用户订阅列表 |
| `GET https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/categories?select=id%2Cvalue%2Clabel%2Cis_default&order=is_default.desc%2Clabel.asc` | `src/services/supabaseCategoriesService.ts` | 获取订阅分类 |

**相关代码文件:**
- `src/pages/SubscriptionsPage.tsx` - 订阅管理页面
- `src/components/subscription/SubscriptionCard.tsx` - 订阅卡片组件
- `src/components/subscription/SubscriptionForm.tsx` - 订阅表单组件
- `src/hooks/useSubscriptionsData.ts` - 订阅数据Hook

### 4. 仪表板相关API

| API请求 | 处理文件 | Edge Function | 说明 |
|---------|----------|---------------|------|
| `POST https://fbngjaewlcwnwrfqwygk.supabase.co/functions/v1/dashboard-analytics` | `src/services/dashboardEdgeFunctionService.ts` | `supabase/functions/dashboard-analytics/index.ts` | 获取仪表板分析数据 |

**相关代码文件:**
- `src/pages/HomePage.tsx` - 仪表板页面
- `src/hooks/useDashboardData.ts` - 仪表板数据Hook
- `src/components/dashboard/StatCard.tsx` - 统计卡片组件
- `src/components/dashboard/UpcomingRenewals.tsx` - 即将续费组件
- `src/components/dashboard/RecentlyPaid.tsx` - 最近支付组件
- `src/components/dashboard/CategoryBreakdown.tsx` - 分类统计组件

### 5. 费用报告相关API

| API请求 | 处理文件 | Edge Function | 说明 |
|---------|----------|---------------|------|
| `POST https://fbngjaewlcwnwrfqwygk.supabase.co/functions/v1/expense-reports` | `src/services/expenseReportsEdgeFunctionService.ts` | `supabase/functions/expense-reports/index.ts` | 获取费用报告数据 |

**相关代码文件:**
- `src/pages/ExpenseReportsPage.tsx` - 费用报告页面
- `src/hooks/useExpenseReportsData.ts` - 费用报告数据Hook
- `src/components/charts/ExpenseTrendChart.tsx` - 费用趋势图表
- `src/components/charts/CategoryPieChart.tsx` - 分类饼图
- `src/components/charts/ExpenseInfoCards.tsx` - 费用信息卡片

## Edge Functions详细说明

### 1. dashboard-analytics

**文件位置:** `supabase/functions/dashboard-analytics/index.ts`

**功能:** 
- 计算月度和年度支出
- 获取活跃订阅数量
- 获取即将续费的订阅
- 获取最近支付的订阅
- 计算分类支出统计

**请求参数:**
```typescript
{
  targetCurrency?: string
  includeUpcomingRenewals?: boolean
  includeRecentlyPaid?: boolean
  includeCategoryBreakdown?: boolean
  upcomingDays?: number
  recentDays?: number
}
```

### 2. subscriptions-management

**文件位置:** `supabase/functions/subscriptions-management/index.ts`

**功能:**
- 获取用户所有订阅
- 包含分类和支付方式信息
- 支持筛选和排序
- 货币转换

**请求参数:**
```typescript
{
  targetCurrency?: string
  includeCategories?: boolean
  includePaymentMethods?: boolean
  filters?: {
    status?: 'all' | 'active' | 'cancelled'
    categories?: string[]
    billingCycles?: string[]
    searchTerm?: string
  }
  sorting?: {
    field?: 'nextBillingDate' | 'name' | 'amount'
    order?: 'asc' | 'desc'
  }
}
```

### 3. expense-reports

**文件位置:** `supabase/functions/expense-reports/index.ts`

**功能:**
- 生成月度费用报告
- 生成年度费用报告
- 分类费用统计
- 费用趋势分析

**请求参数:**
```typescript
{
  targetCurrency?: string
  monthlyStartDate?: string
  monthlyEndDate?: string
  yearlyStartDate?: string
  yearlyEndDate?: string
  includeMonthlyExpenses?: boolean
  includeYearlyExpenses?: boolean
  includeCategoryExpenses?: boolean
  includeExpenseInfo?: boolean
}
```

## 数据库表结构

### 主要表

1. **user_profiles** - 用户配置信息
2. **user_settings** - 用户设置
3. **user_subscriptions** - 用户订阅（实际表名为subscriptions）
4. **categories** - 订阅分类
5. **payment_methods** - 支付方式
6. **payment_history** - 支付历史

### RLS (Row Level Security) 策略

所有表都启用了RLS策略，确保用户只能访问自己的数据：
- 用户只能查看、创建、更新、删除自己的记录
- 通过`user_id`字段进行数据隔离

## 缓存策略

### 1. 前端缓存

**GlobalCacheService** (`src/services/globalCacheService.ts`)
- 用户配置缓存
- 用户偏好设置缓存
- 请求去重机制

**Edge Function缓存**
- Dashboard数据缓存（30秒）
- Subscriptions数据缓存（30秒）
- 支持缓存清除和模式匹配

### 2. 数据库缓存

- Supabase内置查询缓存
- 连接池优化

## 错误处理

### 1. 网络错误
- 自动重试机制
- 降级处理
- 用户友好的错误提示

### 2. 认证错误
- 自动重定向到登录页
- Token刷新机制
- 会话超时处理

### 3. 数据验证错误
- 前端表单验证
- 后端数据验证
- 详细错误信息返回

## 性能优化

### 1. 请求优化
- 请求去重
- 批量操作
- 分页加载

### 2. 数据优化
- 选择性字段查询
- 关联数据预加载
- 索引优化

### 3. 缓存优化
- 多层缓存策略
- 智能缓存失效
- 预加载机制

## 安全措施

### 1. 认证授权
- JWT Token验证
- RLS策略保护
- API密钥管理

### 2. 数据保护
- 输入验证
- SQL注入防护
- XSS防护

### 3. 隐私保护
- 数据加密传输
- 敏感信息脱敏
- 用户数据隔离

---

**更新时间:** 2025年8月3日  
**版本:** v1.0  
**维护者:** 开发团队