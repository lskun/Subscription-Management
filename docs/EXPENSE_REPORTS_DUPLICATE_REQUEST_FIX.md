# 费用报告页面重复请求修复总结

## 问题描述

在 `http://localhost:5173/expense-reports` 页面发现了严重的重复请求问题：
- `expense-reports` Edge Function 被调用了 13+ 次
- 导致页面加载缓慢和服务器资源浪费

## 问题根因分析

通过使用 Playwright MCP 工具检查网络请求，发现问题出现在 `src/hooks/useExpenseReportsData.ts` 文件中：

### 根本原因

在 `useExpenseReportsData` hook 的 `fetchData` 函数依赖数组中，错误地包含了 `currentRequest` 状态：

```typescript
// 问题代码
const fetchData = useCallback(async () => {
  // ... 函数实现
}, [
  monthlyStartDate,
  monthlyEndDate,
  yearlyStartDate,
  yearlyEndDate,
  currency,
  includeMonthlyExpenses,
  includeYearlyExpenses,
  includeCategoryExpenses,
  includeExpenseInfo,
  currentRequest  // ❌ 这里导致了无限循环
])
```

### 无限循环机制

1. `fetchData` 被调用时设置 `currentRequest` 状态
2. `currentRequest` 的变化触发 `fetchData` 重新创建（因为它在依赖数组中）
3. `fetchData` 重新创建触发 `useEffect` 再次调用 `fetchData`
4. 循环往复，导致无限请求

## 修复方案

### 修复内容

从 `fetchData` 函数的依赖数组中移除 `currentRequest`：

```typescript
// 修复后的代码
const fetchData = useCallback(async () => {
  // ... 函数实现保持不变
}, [
  monthlyStartDate,
  monthlyEndDate,
  yearlyStartDate,
  yearlyEndDate,
  currency,
  includeMonthlyExpenses,
  includeYearlyExpenses,
  includeCategoryExpenses,
  includeExpenseInfo
  // 注意：不要将 currentRequest 包含在依赖数组中，这会导致无限循环
])
```

### 修复原理

- `currentRequest` 是用于请求去重的内部状态，不应该影响 `fetchData` 函数的重新创建
- 移除后，`fetchData` 只会在真正需要的参数变化时重新创建
- 保持了请求去重机制的完整性，同时避免了无限循环

## 修复效果

### 第一次修复
修复后，`expense-reports` Edge Function 的调用次数从 13+ 次减少到 4 次。

### 第二次修复（最终修复）
发现仍有 4 次请求的问题，进一步分析发现 `ExpenseReportsPage` 中存在额外的 `useEffect`：

```typescript
// 问题代码：额外的 useEffect 导致重复请求
const dateRangeDeps = useMemo(() => ({
  monthlyStart: currentDateRange.startDate?.getTime(),
  monthlyEnd: currentDateRange.endDate?.getTime(),
  yearlyStart: currentYearlyDateRange.startDate?.getTime(),
  yearlyEnd: currentYearlyDateRange.endDate?.getTime(),
  currency: userCurrency
}), [currentDateRange, currentYearlyDateRange, userCurrency])

useEffect(() => {
  if (dateRangeDeps.monthlyStart && dateRangeDeps.monthlyEnd && 
      dateRangeDeps.yearlyStart && dateRangeDeps.yearlyEnd) {
    refetch() // 这里导致了额外的请求
  }
}, [dateRangeDeps, refetch])
```

移除这个重复的 `useEffect` 后，`expense-reports` Edge Function 的调用次数最终减少到 2 次，这是在 React 严格模式下的正确行为。

### 修复前
- `expense-reports` Edge Function 被调用 13+ 次
- 页面加载缓慢
- 服务器资源浪费严重

### 修复后
- `expense-reports` Edge Function 被调用 2 次（React 严格模式下的正确行为）
- 页面加载速度显著提升
- 服务器资源使用优化

## 验证方法

使用 Playwright MCP 工具进行验证：

1. 导航到 `http://localhost:5173/expense-reports`
2. 检查网络请求记录
3. 确认 `expense-reports` Edge Function 调用次数在合理范围内
4. 验证页面功能正常

## 经验教训

1. **依赖数组管理**：在 `useCallback` 和 `useEffect` 中要谨慎管理依赖数组，避免包含会导致循环的状态

2. **请求去重机制**：实现请求去重时，去重状态本身不应该成为触发新请求的条件

3. **性能监控**：定期使用工具检查网络请求，及时发现性能问题

4. **测试工具**：Playwright MCP 是检查前端性能问题的有效工具

## 相关文件

- `src/hooks/useExpenseReportsData.ts` - 修复的主要文件
- `src/pages/ExpenseReportsPage.tsx` - 使用该 hook 的页面组件
- `src/services/expenseReportsEdgeFunctionService.ts` - Edge Function 服务

## 修复时间

- 发现时间：2025-01-01
- 修复时间：2025-01-01
- 验证时间：2025-01-01