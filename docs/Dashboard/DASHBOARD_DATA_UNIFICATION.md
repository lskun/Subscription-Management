# Dashboard数据源统一重构

## 概述

本次重构将Dashboard的所有数据源统一为Edge Function，解决了之前数据来源不一致导致的缓存同步问题。

## 问题背景

### 之前的架构问题

1. **数据来源分离**：
   - Monthly/Yearly Spending 来自 Edge Function
   - 其他数据（即将续费、最近支付、分类支出）来自订阅Store的实时计算

2. **缓存不同步**：
   - Edge Function 有30秒独立缓存
   - 订阅Store 也有30秒独立缓存
   - 两个缓存系统可能出现不同步，导致数据显示不一致

3. **用户体验问题**：
   - 页面刷新时可能出现部分数据显示为0的情况
   - 需要手动点击"Refresh Data"才能获取完整数据

## 解决方案

### 统一数据源架构

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   HomePage      │───▶│  useDashboardData    │───▶│  Edge Function  │
│                 │    │  Hook                │    │  (Single Source)│
└─────────────────┘    └──────────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────────┐
                       │  Unified Cache       │
                       │  (30s TTL)          │
                       └──────────────────────┘
```

### 主要变更

#### 1. 新增 `useDashboardData` Hook

```typescript
// src/hooks/useDashboardData.ts
export function useDashboardData() {
  // 统一管理所有Dashboard数据
  // 单一缓存机制
  // 自动处理货币变化
}
```

#### 2. 简化 HomePage 组件

**之前**：
```typescript
// 多个数据源
const [monthlySpending, setMonthlySpending] = useState(0)
const [yearlySpending, setYearlySpending] = useState(0)
const upcomingRenewals = useMemo(() => getUpcomingRenewals(7), [...])
const recentlyPaid = useMemo(() => getRecentlyPaid(7), [...])
const spendingByCategory = useMemo(() => getSpendingByCategory(), [...])
```

**现在**：
```typescript
// 单一数据源
const { dashboardData, isLoading, refreshData } = useDashboardData()
const { monthlySpending, yearlySpending, upcomingRenewals, ... } = dashboardData
```

#### 3. 数据转换统一化

所有数据都在Edge Function中处理，包括：
- 汇率转换
- 金额计算（月度/年度）
- 分类统计
- 日期过滤

## 技术细节

### Edge Function 增强

```typescript
// supabase/functions/dashboard-analytics/index.ts
export interface DashboardAnalyticsResponse {
  monthlySpending: number
  yearlySpending: number
  activeSubscriptions: number
  upcomingRenewals: Array<{...}>      // 新增
  recentlyPaid: Array<{...}>          // 新增
  categoryBreakdown: Array<{...}>     // 新增
}
```

### 缓存策略

- **单一缓存源**：只有Edge Function服务有缓存
- **缓存时间**：30秒TTL
- **缓存键**：基于用户ID和请求参数
- **缓存清除**：数据变更时自动清除

### 错误处理

```typescript
// 统一错误处理
try {
  const data = await dashboardEdgeFunctionService.getDashboardAnalytics(...)
} catch (error) {
  // 优雅降级，显示默认值
  return defaultDashboardData
}
```

## 性能优化

### 1. 减少网络请求

**之前**：多个独立请求
- 获取支出数据（Edge Function）
- 获取订阅数据（Supabase直连）
- 客户端计算分析数据

**现在**：单个请求
- 一次Edge Function调用获取所有数据
- 服务端完成所有计算
- 客户端只负责展示

### 2. 缓存效率提升

- 避免了多个缓存系统的同步问题
- 减少了重复的数据库查询
- 统一的缓存失效策略

### 3. 用户体验改善

- 页面加载更快（单次请求）
- 数据一致性保证
- 减少了"数据为0"的情况

## 向后兼容性

### 保留的接口

```typescript
// 这些方法仍然可用，但内部使用Edge Function
dashboardDataAdapter.getUpcomingRenewals()
dashboardDataAdapter.getRecentlyPaid()
dashboardDataAdapter.getSpendingByCategory()
```

### 废弃的方法

```typescript
// 订阅Store中的这些方法不再被HomePage使用
// 但仍然保留以供其他组件使用
subscriptionStore.getTotalMonthlySpending()
subscriptionStore.getTotalYearlySpending()
subscriptionStore.getUpcomingRenewals()
subscriptionStore.getRecentlyPaid()
subscriptionStore.getSpendingByCategory()
```

## 测试覆盖

### 新增测试

- `src/hooks/__tests__/useDashboardData.test.ts`
- Edge Function的集成测试
- 缓存机制测试

### 测试场景

1. **正常数据获取**
2. **错误处理**
3. **缓存机制**
4. **货币变化响应**
5. **数据刷新**

## 部署注意事项

### 1. Edge Function 更新

确保 `dashboard-analytics` Edge Function 已部署最新版本：

```bash
npm run deploy:dashboard-function
```

### 2. 数据库权限

确认Edge Function有足够权限访问所有必要的表：
- subscriptions
- categories
- exchange_rates

### 3. 监控指标

关注以下指标：
- Edge Function响应时间
- 缓存命中率
- 错误率

## 未来优化方向

### 1. 实时数据更新

考虑使用Supabase Realtime在数据变更时主动更新缓存：

```typescript
// 未来可能的实现
supabase
  .channel('dashboard-updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, 
    () => dashboardEdgeFunctionService.clearCache()
  )
```

### 2. 更细粒度的缓存

根据数据变更频率，对不同类型的数据使用不同的缓存策略：
- 支出数据：较长缓存（订阅变更不频繁）
- 汇率数据：中等缓存（每日更新）
- 用户偏好：较短缓存（可能频繁变更）

### 3. 离线支持

考虑添加离线数据缓存，在网络不可用时显示最后获取的数据。

## 总结

这次重构解决了Dashboard数据不一致的根本问题，通过统一数据源提升了用户体验和系统可维护性。所有Dashboard数据现在都来自同一个可靠的源头，确保了数据的一致性和准确性。