import { useMemo } from 'react'
import { useSubscriptionStore } from './subscriptionStore'
import { useSettingsStore } from './settingsStore'
import { convertCurrency } from '../utils/currency'

/**
 * 订阅统计数据Hook - 计算总月度和年度支出以及活跃订阅数量
 * @returns 包含总月度支出、总年度支出和活跃订阅数量的统计数据
 */
export const useSubscriptionStats = () => {
  const { subscriptions } = useSubscriptionStore()
  const { currency: userCurrency } = useSettingsStore()

  return useMemo(() => {
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active')

    const totalMonthlySpending = activeSubscriptions.reduce((total, sub) => {
      const convertedAmount = convertCurrency(sub.amount, sub.currency, userCurrency)

      switch (sub.billingCycle) {
        case 'monthly':
          return total + convertedAmount
        case 'yearly':
          return total + (convertedAmount / 12)
        case 'quarterly':
          return total + (convertedAmount / 3)
        default:
          return total
      }
    }, 0)

    const totalYearlySpending = activeSubscriptions.reduce((total, sub) => {
      const convertedAmount = convertCurrency(sub.amount, sub.currency, userCurrency)

      switch (sub.billingCycle) {
        case 'monthly':
          return total + (convertedAmount * 12)
        case 'yearly':
          return total + convertedAmount
        case 'quarterly':
          return total + (convertedAmount * 4)
        default:
          return total
      }
    }, 0)

    const activeCount = activeSubscriptions.length

    return {
      totalMonthlySpending,
      totalYearlySpending,
      activeCount
    }
  }, [subscriptions, userCurrency])
}

/**
 * 按分类统计支出Hook - 计算每个分类的月度支出
 * @returns 按分类分组的月度支出数据
 */
export const useSpendingByCategory = () => {
  const { subscriptions, categories } = useSubscriptionStore()
  const { currency: userCurrency } = useSettingsStore()
  
  return useMemo(() => {
    const uniqueCategoryIds = [...new Set(subscriptions.map(sub => sub.categoryId).filter(id => id != null))]
    
    return uniqueCategoryIds.reduce((acc, categoryId) => {
      const category = categories.find(cat => cat.id === categoryId)
      const categoryValue = category?.value || 'other'
      
      const categoryTotal = subscriptions
        .filter(sub => sub.status === 'active' && sub.categoryId === categoryId)
        .reduce((total, sub) => {
          const convertedAmount = convertCurrency(sub.amount, sub.currency, userCurrency)
          
          switch (sub.billingCycle) {
            case 'monthly':
              return total + (convertedAmount * 12)
            case 'yearly':
              return total + convertedAmount
            case 'quarterly':
              return total + (convertedAmount * 4)
            default:
              return total
          }
        }, 0)
      
      acc[categoryValue] = categoryTotal
      return acc
    }, {} as Record<string, number>)
  }, [subscriptions, categories, userCurrency])
}

/**
 * 即将续费订阅Hook - 获取指定天数内即将续费的订阅
 * @param days 天数，默认30天
 * @returns 即将续费的订阅列表
 */
export const useUpcomingRenewals = (days: number = 30) => {
  const { subscriptions } = useSubscriptionStore()
  
  return useMemo(() => {
    const today = new Date()
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() + days)
    
    return subscriptions.filter(sub => {
      if (sub.status !== 'active') return false
      const nextBilling = new Date(sub.nextBillingDate)
      return nextBilling >= today && nextBilling <= cutoffDate
    }).sort((a, b) => {
      return new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()
    })
  }, [subscriptions, days])
}

/**
 * 最近付费订阅Hook - 获取指定天数内最近付费的订阅
 * @param days 天数，默认7天
 * @returns 最近付费的订阅列表
 */
export const useRecentlyPaid = (days: number = 7) => {
  const { subscriptions } = useSubscriptionStore()
  
  return useMemo(() => {
    const today = new Date()
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    return subscriptions.filter(sub => {
      if (!sub.lastBillingDate) return false
      const lastBilling = new Date(sub.lastBillingDate)
      return lastBilling >= cutoffDate && lastBilling <= today
    }).sort((a, b) => {
      return new Date(b.lastBillingDate!).getTime() - new Date(a.lastBillingDate!).getTime()
    })
  }, [subscriptions, days])
}

// Selector functions for optimized state access
export const selectActiveSubscriptions = (state: any) =>
  state.subscriptions.filter((sub: any) => sub.status === 'active')

export const selectSubscriptionById = (id: string) => (state: any) =>
  state.subscriptions.find((sub: any) => sub.id === id)

export const selectSubscriptionsByCategory = (categoryId: string) => (state: any) =>
  state.subscriptions.filter((sub: any) => sub.categoryId === categoryId)