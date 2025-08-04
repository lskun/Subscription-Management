# Design Document

## Overview

本设计文档描述了 expense-reports Edge Function 的性能优化方案。主要目标是将当前的多次数据库查询优化为单次查询，并通过内存中的数据处理来提高性能。

## Architecture

### Current Architecture Issues

当前的实现存在以下性能问题：

1. **多次数据库查询**：在 `includeExpenseInfo` 逻辑中，分别为每个月、季度、年执行独立的支付记录查询
2. **重复查询逻辑**：相同的查询逻辑在不同的时间段计算中重复执行
3. **数据库连接开销**：每次查询都需要建立和维护数据库连接

```typescript
// 当前问题代码示例
for(let i = 0; i < 4; i++){
  // 每个月都执行一次查询
  const { data: payments } = await supabaseClient
    .from('payment_history')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'succeeded')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEndStr);
}
```

### New Architecture Design

新的架构将采用以下设计：

1. **单次数据查询**：一次性获取最近3年的所有支付记录
2. **内存中数据分组**：根据支付日期将记录分配到不同的时间段
3. **统一的日期处理逻辑**：使用通用的日期分类函数

```typescript
// 新架构伪代码
const allPayments = await fetchAllPaymentsOnce(user.id, startDate, endDate);
const groupedPayments = groupPaymentsByPeriod(allPayments);
const statistics = calculateStatistics(groupedPayments);
```

## Components and Interfaces

### 1. Exchange Rate Fetcher

**职责**：获取最新的汇率数据（优化：只查询最新日期的汇率）

```typescript
async function fetchLatestExchangeRates(
  supabaseClient: any
): Promise<Record<string, number>> {
  // 先获取最新日期
  const { data: latestDate, error: dateError } = await supabaseClient
    .from('exchange_rates')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (dateError) {
    console.error('Error fetching latest exchange rate date:', dateError);
    return {};
  }

  // 根据最新日期获取汇率数据
  const { data: exchangeRateData, error: exchangeRateError } = await supabaseClient
    .from('exchange_rates')
    .select('from_currency, to_currency, rate')
    .eq('date', latestDate?.date)
    .order('from_currency', { ascending: true });

  if (exchangeRateError) {
    console.error('Error fetching exchange rates:', exchangeRateError);
    return {};
  }

  // 构建汇率映射 - 支持双向转换
  const exchangeRates: Record<string, number> = {};
  if (exchangeRateData) {
    exchangeRateData.forEach(rate => {
      const fromCurrency = rate.from_currency;
      const toCurrency = rate.to_currency;
      const rateValue = parseFloat(rate.rate);

      // 存储正向汇率 (from -> to)
      const forwardKey = `${fromCurrency}_${toCurrency}`;
      exchangeRates[forwardKey] = rateValue;

      // 存储反向汇率 (to -> from)
      const reverseKey = `${toCurrency}_${fromCurrency}`;
      exchangeRates[reverseKey] = 1 / rateValue;
    });
  }

  return exchangeRates;
}
```

### 2. Payment Data Fetcher

**职责**：一次性获取所有需要的支付记录

```typescript
interface PaymentRecord {
  id: string;
  payment_date: string;
  amount_paid: string;
  currency: string;
  status: string;
}

async function fetchAllPayments(
  supabaseClient: any,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<PaymentRecord[]>
```

### 3. Payment Grouper

**职责**：根据日期将支付记录分组到不同时间段

```typescript
interface GroupedPayments {
  monthly: Map<string, PaymentRecord[]>;    // key: "2025-01"
  quarterly: Map<string, PaymentRecord[]>;  // key: "2025-Q1"
  yearly: Map<string, PaymentRecord[]>;     // key: "2025"
}

function groupPaymentsByPeriod(
  payments: PaymentRecord[]
): GroupedPayments
```

### 4. Statistics Calculator

**职责**：基于分组的支付记录计算统计信息

```typescript
interface PeriodStatistics {
  period: string;
  amount: number;
  change: number;
  currency: string;
  paymentCount: number;
}

function calculatePeriodStatistics(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: any,
  targetCurrency: string
): {
  monthly: PeriodStatistics[];
  quarterly: PeriodStatistics[];
  yearly: PeriodStatistics[];
}
```

## Data Models

### Payment Query Range

```typescript
interface QueryRange {
  startDate: Date;  // 3年前的1月1日
  endDate: Date;    // 当前日期
}

function calculateQueryRange(): QueryRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear() - 3, 0, 1);
  return { startDate, endDate: now };
}
```

### Period Classification

```typescript
interface PeriodClassifier {
  getMonthKey(date: Date): string;     // "2025-01"
  getQuarterKey(date: Date): string;   // "2025-Q1"
  getYearKey(date: Date): string;      // "2025"
}

class DatePeriodClassifier implements PeriodClassifier {
  getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  getQuarterKey(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }
  
  getYearKey(date: Date): string {
    return date.getFullYear().toString();
  }
}
```

## Error Handling

### Database Query Failures

```typescript
async function fetchAllPaymentsWithFallback(
  supabaseClient: any,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<PaymentRecord[]> {
  try {
    const { data, error } = await supabaseClient
      .from('payment_history')
      .select('id, payment_date, amount_paid, currency, status')
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .gte('payment_date', startDate.toISOString().split('T')[0])
      .lte('payment_date', endDate.toISOString().split('T')[0]);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch payment records:', error);
    return []; // 返回空数组，让系统继续运行
  }
}
```

### Data Processing Errors

```typescript
function safeGroupPayments(payments: PaymentRecord[]): GroupedPayments {
  const result: GroupedPayments = {
    monthly: new Map(),
    quarterly: new Map(),
    yearly: new Map()
  };
  
  const classifier = new DatePeriodClassifier();
  
  for (const payment of payments) {
    try {
      const paymentDate = new Date(payment.payment_date);
      
      // 验证日期有效性
      if (isNaN(paymentDate.getTime())) {
        console.warn(`Invalid payment date: ${payment.payment_date}`);
        continue;
      }
      
      // 分组到不同时间段
      const monthKey = classifier.getMonthKey(paymentDate);
      const quarterKey = classifier.getQuarterKey(paymentDate);
      const yearKey = classifier.getYearKey(paymentDate);
      
      // 添加到对应的分组中
      addToGroup(result.monthly, monthKey, payment);
      addToGroup(result.quarterly, quarterKey, payment);
      addToGroup(result.yearly, yearKey, payment);
      
    } catch (error) {
      console.error(`Error processing payment ${payment.id}:`, error);
    }
  }
  
  return result;
}
```

## Testing Strategy

### Unit Tests

1. **Payment Grouper Tests**
   - 测试日期分类逻辑的正确性
   - 测试边界情况（月末、季末、年末）
   - 测试无效日期的处理

2. **Statistics Calculator Tests**
   - 测试支付次数计算的准确性
   - 测试金额汇总的正确性
   - 测试空数据的处理

### Integration Tests

1. **Database Query Tests**
   - 测试单次查询返回正确的数据
   - 测试查询性能是否有改善
   - 测试查询错误的处理

2. **End-to-End Tests**
   - 测试完整的 API 响应格式
   - 测试与前端组件的兼容性
   - 测试不同时间范围的数据准确性

### Performance Tests

```typescript
// 性能测试示例
async function performanceTest() {
  const startTime = Date.now();
  
  // 执行优化后的查询
  const result = await optimizedExpenseReports(testUserId);
  
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  console.log(`Execution time: ${executionTime}ms`);
  
  // 验证结果正确性
  assert(result.success === true);
  assert(result.data.expenseInfo.monthly.length === 4);
}
```

## Implementation Plan

### Phase 1: Core Refactoring
1. 实现单次支付记录查询
2. 实现支付记录分组逻辑
3. 重构统计计算逻辑

### Phase 2: Integration
1. 集成新逻辑到现有的 Edge Function
2. 保持 API 接口兼容性
3. 添加错误处理和日志

### Phase 3: Testing & Optimization
1. 编写单元测试和集成测试
2. 性能测试和调优
3. 部署和监控

## Migration Strategy

为了确保平滑迁移，将采用以下策略：

1. **向后兼容**：新实现必须返回与旧版本完全相同的数据结构
2. **渐进式部署**：先在测试环境验证，再部署到生产环境
3. **回滚计划**：保留旧版本代码，以便必要时快速回滚
4. **监控指标**：部署后监控响应时间和错误率的变化