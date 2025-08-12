import { describe, it, expect } from 'vitest'
import { calculateNextBillingDateForNewSubscription, calculateNextBillingDateFromStart, isSubscriptionDue } from '../subscription-utils'

describe('auto-renewal date helpers', () => {
  it('新订阅：next = start + 1 month', () => {
    const next = calculateNextBillingDateForNewSubscription(new Date('2024-01-15'), 'monthly')
    expect(next).toBe('2024-02-15')
  })

  it('既有订阅：从 start 推到今天之后的下一个周期', () => {
    const next = calculateNextBillingDateFromStart(new Date('2024-01-15'), new Date('2024-03-01'), 'monthly')
    // 递增：01-15 → 02-15 → 03-15 (> 03-01)
    expect(next).toBe('2024-03-15')
  })

  it('到期判断：billingDate <= today 为到期', () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    expect(isSubscriptionDue(todayStr)).toBe(true)
  })
})


