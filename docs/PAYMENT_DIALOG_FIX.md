# 支付详情弹窗修复文档

## 问题描述

在费用报告页面 (`http://localhost:5173/expense-reports`) 点击 "View Details" 弹出的对话框中，显示 "Unknown Subscription" 和 "Unknown Plan"，而不是正确的订阅名称和计划。

## 问题原因

1. **数据结构不匹配**: Supabase 查询返回的数据结构是嵌套的：
   ```json
   {
     "id": "...",
     "subscriptions": {
       "name": "Adobe Creative Cloud",
       "plan": "摄影计划"
     }
   }
   ```

2. **转换函数期望扁平结构**: `transformPaymentsFromApi` 函数期望的数据结构是扁平的：
   ```json
   {
     "id": "...",
     "subscription_name": "Adobe Creative Cloud",
     "subscription_plan": "摄影计划"
   }
   ```

## 解决方案

在 `src/components/charts/ExpenseDetailDialog.tsx` 中，在调用 `transformPaymentsFromApi` 之前，先将嵌套的数据结构扁平化：

```typescript
// 转换数据结构，将嵌套的 subscriptions 对象扁平化
const transformedData = (data || []).map(item => ({
  ...item,
  subscription_name: item.subscriptions?.name || 'Unknown Subscription',
  subscription_plan: item.subscriptions?.plan || 'Unknown Plan'
}))

allPaymentDetails = transformPaymentsFromApi(transformedData)
```

## 修改的文件

- `src/components/charts/ExpenseDetailDialog.tsx`
  - 修改了月度数据查询的数据转换逻辑
  - 修改了季度/年度数据查询的数据转换逻辑

## 测试验证

创建了测试脚本 `scripts/test-payment-data-transform.ts` 来验证数据转换逻辑的正确性。

## 预期结果

修复后，在费用报告页面点击 "View Details" 时，弹窗中应该正确显示：
- 订阅名称：如 "Adobe Creative Cloud"、"Netflix"、"Spotify" 等
- 订阅计划：如 "摄影计划"、"标准版"、"Premium" 等

而不是显示 "Unknown Subscription" 和 "Unknown Plan"。

## 相关 API 请求

修复涉及的 API 请求格式：
```
https://fbngjaewlcwnwrfqwygk.supabase.co/rest/v1/payment_history?select=*%2Csubscriptions%21inner%28name%2Cplan%29&payment_date=gte.2025-06-01&payment_date=lte.2025-06-30&status=eq.success
```

这个请求返回的 JSON 数据中包含嵌套的 `subscriptions` 对象，现在已经正确处理。