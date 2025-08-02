# 费用报告页面请求优化

## 问题描述

在费用报告页面 (`http://localhost:5173/expense-reports`) 中发现了重复请求的问题：
- `expense-reports` Edge Function 被调用了 4 次
- `rest/v1/user_settings` 被调用了 4 次

## 根本原因分析

1. **多个 useEffect 触发相同请求**
   - 页面组件中有多个 useEffect 调用相同的数据获取函数
   - 依赖数组不稳定导致重复触发

2. **Store 缓存机制不够完善**
   - 虽然有缓存机制，但在快速连续调用时仍可能产生重复请求
   - 缺乏有效的请求去重机制

3. **组件重新渲染导致的连锁反应**
   - 不稳定的函数引用导致 useEffect 重复执行
   - 状态更新触发额外的数据获取

## 优化措施

### 1. ExpenseReportsPage 组件优化

#### 优化前：
```typescript
const { categories, fetchCategories } = useSubscriptionStore()
const { currency: userCurrency, fetchSettings } = useSettingsStore()

useEffect(() => {
  const initializeData = async () => {
    await fetchCategories()
    await fetchSettings()
  }
  initializeData()
}, []) // 空依赖数组可能导致问题

useEffect(() => {
  refetch()
}, [currentDateRange, currentYearlyDateRange, userCurrency, refetch])
```

#### 优化后：
```typescript
// 使用 useCallback 稳定函数引用
const fetchCategories = useSubscriptionStore(useCallback((state) => state.fetchCategories, []))
const fetchSettings = useSettingsStore(useCallback((state) => state.fetchSettings, []))
const userCurrency = useSettingsStore(useCallback((state) => state.currency, []))

// 并行获取数据，避免顺序依赖
useEffect(() => {
  const initializeData = async () => {
    await Promise.all([
      fetchCategories(),
      fetchSettings()
    ])
  }
  initializeData()
}, [fetchCategories, fetchSettings])

// 使用 useMemo 稳定依赖对象
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
    refetch()
  }
}, [dateRangeDeps, refetch])
```

### 2. useExpenseReportsData Hook 优化

#### 添加请求去重机制：
```typescript
// 请求去重机制
const [currentRequest, setCurrentRequest] = useState<Promise<void> | null>(null)

const fetchData = useCallback(async () => {
  // 如果已有正在进行的请求，等待它完成
  if (currentRequest) {
    console.log('Request already in progress, waiting for completion...')
    return currentRequest
  }

  const requestPromise = (async () => {
    // ... 实际的请求逻辑
  })()

  setCurrentRequest(requestPromise)
  return requestPromise
}, [/* dependencies */])
```

### 3. Settings Store 优化

#### 添加缓存和请求去重：
```typescript
interface SettingsState {
  // ... 其他属性
  _fetchPromise: Promise<void> | null
  _lastFetchTime: number | null
}

fetchSettings: async () => {
  const state = get()
  const now = Date.now()
  const CACHE_DURATION = 30000 // 30 seconds cache

  // 检查缓存
  if (state._lastFetchTime && (now - state._lastFetchTime) < CACHE_DURATION) {
    console.log('跳过设置数据获取，使用缓存数据')
    return
  }

  // 检查正在进行的请求
  if (state._fetchPromise) {
    console.log('等待现有的设置数据获取请求')
    return state._fetchPromise
  }

  // 创建新的请求
  const fetchPromise = (async () => {
    // ... 实际的获取逻辑
  })()

  set({ _fetchPromise: fetchPromise })
  return fetchPromise
}
```

## 优化效果

### 预期结果：
- `expense-reports` 请求：从 4 次减少到 1 次
- `user_settings` 请求：从 4 次减少到 1 次
- 页面加载速度提升
- 减少服务器负载
- 改善用户体验

### 验证方法：

1. **浏览器开发者工具**：
   ```bash
   # 启动开发服务器
   npm run dev
   
   # 访问页面
   http://localhost:5173/expense-reports
   
   # 打开开发者工具 -> Network 面板
   # 刷新页面，观察请求数量
   ```

2. **使用测试脚本**：
   ```bash
   # 运行测试脚本
   npx tsx scripts/test-request-optimization.ts
   ```

## 最佳实践

### 1. 请求去重
- 在 Hook 和 Store 中实现请求去重机制
- 使用 Promise 缓存避免重复请求
- 设置合理的缓存时间

### 2. 依赖管理
- 使用 `useCallback` 稳定函数引用
- 使用 `useMemo` 稳定对象引用
- 避免在 useEffect 依赖数组中使用不稳定的引用

### 3. 数据获取策略
- 优先使用并行请求而不是顺序请求
- 在组件挂载时一次性获取所需数据
- 避免在多个地方重复获取相同数据

### 4. 状态管理
- 在 Store 中实现有效的缓存机制
- 使用请求状态标记避免重复请求
- 合理设置缓存过期时间

## 监控和维护

1. **定期检查**：
   - 使用浏览器开发者工具监控网络请求
   - 关注页面加载性能指标
   - 检查控制台是否有重复请求的警告

2. **性能测试**：
   - 在不同网络条件下测试页面加载
   - 使用性能分析工具检查渲染性能
   - 监控 API 调用频率和响应时间

3. **代码审查**：
   - 审查新增的 useEffect 和数据获取逻辑
   - 确保遵循请求去重的最佳实践
   - 检查依赖数组的稳定性

## 相关文件

- `src/pages/ExpenseReportsPage.tsx` - 主页面组件
- `src/hooks/useExpenseReportsData.ts` - 数据获取 Hook
- `src/store/settingsStore.ts` - 设置状态管理
- `src/store/subscriptionStore.ts` - 订阅状态管理
- `scripts/test-request-optimization.ts` - 测试脚本