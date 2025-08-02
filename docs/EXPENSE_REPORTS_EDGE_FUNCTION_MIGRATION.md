# Expense Reports Edge Function 迁移文档

## 概述

本文档记录了将 Expense Reports 页面的数据获取从多个独立的 API 调用迁移到统一的 Supabase Edge Function 的过程。这次迁移旨在减少不必要的网络请求，提高页面性能，并统一数据获取逻辑。

## 迁移背景

### 原有实现问题

在迁移前，`ExpenseReportsPage` 存在以下问题：

1. **多个独立的 API 调用**：页面使用多个 `useEffect` 分别调用不同的服务方法
2. **重复的网络请求**：每个数据类型都需要单独的请求
3. **复杂的状态管理**：需要管理多个加载状态和错误状态
4. **性能问题**：多个并发请求可能导致性能瓶颈

### 原有数据获取方式

```typescript
// 多个独立的 useEffect 调用
useEffect(() => {
  // 获取月度费用数据
  supabaseAnalyticsService.getMonthlyExpenses(...)
}, [currentDateRange, userCurrency])

useEffect(() => {
  // 获取年度费用数据
  supabaseAnalyticsService.getYearlyExpenses(...)
}, [currentYearlyDateRange, userCurrency])

useEffect(() => {
  // 获取分类费用数据
  supabaseAnalyticsService.getCategoryExpenses(...)
}, [currentDateRange, userCurrency])

// ... 更多独立的 API 调用
```

## 迁移方案

### 1. 创建 Edge Function

创建了 `supabase/functions/expense-reports/index.ts`，统一处理所有费用报告相关的数据获取：

**功能特性：**
- 统一的数据获取接口
- 支持货币转换
- 灵活的参数配置
- 统一的错误处理
- 性能优化的数据处理

**支持的数据类型：**
- 月度费用数据 (`monthlyExpenses`)
- 年度费用数据 (`yearlyExpenses`)
- 分类费用数据 (`categoryExpenses`)
- 费用信息数据 (`expenseInfo`) - 用于 ExpenseInfoCards

### 2. 创建服务层

创建了 `src/services/expenseReportsEdgeFunctionService.ts`：

```typescript
class ExpenseReportsEdgeFunctionService {
  // 统一的数据获取方法
  async getExpenseReports(request: ExpenseReportsRequest): Promise<ExpenseReportsResponse>
  
  // 便捷方法
  async getMonthlyExpenses(startDate: Date, endDate: Date, currency: string)
  async getYearlyExpenses(startDate: Date, endDate: Date, currency: string)
  async getCategoryExpenses(startDate: Date, endDate: Date, currency: string)
  async getExpenseInfo(currency: string)
  async getFullExpenseReports(...)
}
```

### 3. 创建 React Hook

创建了 `src/hooks/useExpenseReportsData.ts`：

```typescript
// 主要 hook
export function useExpenseReportsData(options: UseExpenseReportsDataOptions)

// 便捷 hooks
export function useMonthlyExpenses(startDate: Date, endDate: Date, currency: string)
export function useYearlyExpenses(startDate: Date, endDate: Date, currency: string)
export function useCategoryExpenses(startDate: Date, endDate: Date, currency: string)
export function useExpenseInfo(currency: string)
```

### 4. 更新页面组件

更新了 `src/pages/ExpenseReportsPage.tsx`：

**迁移前：**
```typescript
// 多个状态和 useEffect
const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([])
const [yearlyExpenses, setYearlyExpenses] = useState<YearlyExpense[]>([])
const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
const [isLoadingYearlyExpenses, setIsLoadingYearlyExpenses] = useState(false)
// ... 更多状态

useEffect(() => { /* 获取月度数据 */ }, [])
useEffect(() => { /* 获取年度数据 */ }, [])
useEffect(() => { /* 获取分类数据 */ }, [])
// ... 更多 useEffect
```

**迁移后：**
```typescript
// 单一 hook 调用
const {
  monthlyExpenses,
  yearlyExpenses,
  categoryExpenses,
  yearlyCategoryExpenses,
  expenseInfo: expenseInfoData,
  isLoading,
  error,
  refetch
} = useExpenseReportsData({
  monthlyStartDate: currentDateRange.startDate,
  monthlyEndDate: currentDateRange.endDate,
  yearlyStartDate: currentYearlyDateRange.startDate,
  yearlyEndDate: currentYearlyDateRange.endDate,
  currency: userCurrency,
  includeMonthlyExpenses: true,
  includeYearlyExpenses: true,
  includeCategoryExpenses: true,
  includeExpenseInfo: true,
  autoFetch: true
})
```

## 技术实现细节

### Edge Function 架构

```typescript
interface ExpenseReportsRequest {
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

interface ExpenseReportsResponse {
  monthlyExpenses?: MonthlyExpense[]
  yearlyExpenses?: YearlyExpense[]
  categoryExpenses?: CategoryExpense[]
  yearlyCategoryExpenses?: CategoryExpense[]
  expenseInfo?: {
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }
  currency: string
  timestamp: string
}
```

### 数据处理逻辑

1. **货币转换**：支持多币种转换，使用汇率表进行实时转换
2. **费用计算**：根据计费周期计算月度和年度费用
3. **分类统计**：按订阅分类进行费用统计
4. **时间范围处理**：支持灵活的时间范围查询

### 性能优化

1. **单次请求**：将多个数据获取合并为单次 Edge Function 调用
2. **按需获取**：通过参数控制只获取需要的数据
3. **数据缓存**：在 hook 层面提供数据缓存和重新获取机制
4. **错误处理**：统一的错误处理和重试机制

## 部署指南

### 1. 部署 Edge Function

```bash
# 使用部署脚本
npm run deploy:expense-reports

# 或手动部署
supabase functions deploy expense-reports
```

### 2. 验证部署

```bash
# 检查函数状态
supabase functions list

# 测试函数调用
curl -X POST 'https://your-project.supabase.co/functions/v1/expense-reports' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"targetCurrency": "CNY", "includeExpenseInfo": true}'
```

## 迁移效果

### 性能提升

1. **请求数量减少**：从 6+ 个独立请求减少到 1 个统一请求
2. **加载时间优化**：减少了网络往返时间
3. **状态管理简化**：从多个加载状态简化为单一状态

### 代码质量提升

1. **代码复用**：统一的数据获取逻辑
2. **维护性提升**：集中的错误处理和状态管理
3. **类型安全**：完整的 TypeScript 类型定义

### 用户体验改善

1. **加载体验**：统一的加载状态，避免页面闪烁
2. **错误处理**：更好的错误提示和重试机制
3. **响应速度**：更快的数据加载速度

## 相关文件

### 新增文件

- `supabase/functions/expense-reports/index.ts` - Edge Function 实现
- `src/services/expenseReportsEdgeFunctionService.ts` - 服务层
- `src/hooks/useExpenseReportsData.ts` - React Hook
- `scripts/deploy-expense-reports-function.ts` - 部署脚本

### 修改文件

- `src/pages/ExpenseReportsPage.tsx` - 页面组件更新

### 配置文件

- `package.json` - 添加部署脚本

## 测试建议

### 功能测试

1. **数据完整性**：验证所有数据类型都能正确获取
2. **货币转换**：测试不同货币的转换功能
3. **时间范围**：测试不同时间范围的数据获取
4. **错误处理**：测试网络错误和数据错误的处理

### 性能测试

1. **加载时间**：对比迁移前后的页面加载时间
2. **网络请求**：验证请求数量的减少
3. **内存使用**：检查内存使用情况

## 注意事项

1. **向后兼容**：保持了与现有组件的兼容性
2. **错误处理**：需要处理 Edge Function 的各种错误情况
3. **数据一致性**：确保 Edge Function 返回的数据格式与原有 API 一致
4. **权限控制**：Edge Function 需要正确的用户身份验证

## 后续优化

1. **缓存策略**：可以考虑添加客户端缓存
2. **实时更新**：可以考虑添加实时数据更新
3. **分页支持**：对于大量数据可以添加分页支持
4. **数据预加载**：可以考虑预加载常用数据

## 总结

这次迁移成功地将 Expense Reports 页面从多个独立的 API 调用迁移到了统一的 Edge Function 架构。这不仅提高了性能，还改善了代码的可维护性和用户体验。迁移过程保持了向后兼容性，确保了平滑的过渡。