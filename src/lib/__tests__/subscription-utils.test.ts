import { describe, it, expect } from 'vitest'
import { validateBillingCycle, shouldUpdateLastBillingDate, shouldUpdateLastBillingDateWithReason } from '../subscription-utils'
import { BillingCycle } from '@/store/subscriptionStore'

describe('subscription-utils', () => {
  describe('validateBillingCycle', () => {
    it('应该验证月度账单周期', () => {
      // 30天的月度周期
      const result = validateBillingCycle(
        '2024-01-01',
        '2024-01-31',
        'monthly' as BillingCycle
      )
      expect(result).toBe(true)
    })

    it('应该验证季度账单周期', () => {
      // 90天的季度周期
      const result = validateBillingCycle(
        '2024-01-01',
        '2024-03-31',
        'quarterly' as BillingCycle
      )
      expect(result).toBe(true)
    })

    it('应该验证年度账单周期', () => {
      // 365天的年度周期
      const result = validateBillingCycle(
        '2024-01-01',
        '2024-12-31',
        'yearly' as BillingCycle
      )
      expect(result).toBe(true)
    })

    it('应该拒绝不匹配的账单周期', () => {
      // 7天的周期不应该匹配月度
      const result = validateBillingCycle(
        '2024-01-01',
        '2024-01-08',
        'monthly' as BillingCycle
      )
      expect(result).toBe(false)
    })
  })

  describe('shouldUpdateLastBillingDate', () => {
    it('应该允许成功支付更新 last_billing_date', () => {
      const result = shouldUpdateLastBillingDate(
        '2024-02-01', // paymentDate
        'success', // paymentStatus
        '2024-01-01', // billingPeriodStart
        '2024-01-31', // billingPeriodEnd
        '2024-01-01', // currentLastBillingDate
        'monthly' as BillingCycle // subscriptionBillingCycle
      )
      expect(result).toBe(true)
    })

    it('应该拒绝失败的支付', () => {
      const result = shouldUpdateLastBillingDate(
        '2024-02-01',
        'failed', // 失败的支付
        '2024-01-01',
        '2024-01-31',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result).toBe(false)
    })

    it('应该拒绝未来日期的支付', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      
      const result = shouldUpdateLastBillingDate(
        futureDate.toISOString().split('T')[0],
        'success',
        '2024-01-01',
        '2024-01-31',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result).toBe(false)
    })

    it('应该拒绝早于当前 last_billing_date 的支付', () => {
      const result = shouldUpdateLastBillingDate(
        '2024-01-15', // 早于当前的 last_billing_date
        'success',
        '2024-01-01',
        '2024-01-31',
        '2024-02-01', // 当前的 last_billing_date 更晚
        'monthly' as BillingCycle
      )
      expect(result).toBe(false)
    })

    it('应该拒绝账单周期不匹配的支付', () => {
      const result = shouldUpdateLastBillingDate(
        '2024-02-01',
        'success',
        '2024-01-01',
        '2024-01-08', // 只有7天，不匹配月度周期
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result).toBe(false)
    })

    it('应该处理 null 的 currentLastBillingDate', () => {
      const result = shouldUpdateLastBillingDate(
        '2024-02-01',
        'success',
        '2024-01-01',
        '2024-01-31',
        null, // 没有当前的 last_billing_date
        'monthly' as BillingCycle
      )
      expect(result).toBe(true)
    })
  })

  describe('shouldUpdateLastBillingDateWithReason', () => {
    it('应该返回成功更新的详细信息', () => {
      const result = shouldUpdateLastBillingDateWithReason(
        '2024-02-01',
        'success',
        '2024-01-01',
        '2024-01-31',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result.shouldUpdate).toBe(true)
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
      expect(result.isHistoricalRecord).toBe(false)
    })

    it('应该返回失败支付的详细原因', () => {
      const result = shouldUpdateLastBillingDateWithReason(
        '2024-02-01',
        'failed',
        '2024-01-01',
        '2024-01-31',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result.shouldUpdate).toBe(false)
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
      expect(result.isHistoricalRecord).toBe(false)
    })

    it('应该返回未来日期支付的详细原因', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      
      const result = shouldUpdateLastBillingDateWithReason(
        futureDate.toISOString().split('T')[0],
        'success',
        '2024-01-01',
        '2024-01-31',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result.shouldUpdate).toBe(false)
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
      expect(result.isHistoricalRecord).toBe(false)
    })

    it('应该返回历史记录的详细原因', () => {
      const result = shouldUpdateLastBillingDateWithReason(
        '2024-01-15',
        'success',
        '2024-01-01',
        '2024-01-31',
        '2024-02-01',
        'monthly' as BillingCycle
      )
      expect(result.shouldUpdate).toBe(false)
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
      expect(result.isHistoricalRecord).toBe(true)
    })

    it('应该返回账单周期不匹配的详细原因', () => {
      const result = shouldUpdateLastBillingDateWithReason(
        '2024-02-01',
        'success',
        '2024-01-01',
        '2024-01-08',
        '2024-01-01',
        'monthly' as BillingCycle
      )
      expect(result.shouldUpdate).toBe(false)
      expect(typeof result.reason).toBe('string')
      expect(result.reason.length).toBeGreaterThan(0)
      expect(result.isHistoricalRecord).toBe(false)
    })
  })
})