import { dashboardEdgeFunctionService } from './dashboardEdgeFunctionService'
import { useSettingsStore } from '@/store/settingsStore'

/**
 * Dashboard 数据适配器
 * 统一使用Edge Function作为数据源，提供兼容的接口
 * @deprecated 建议直接使用 useDashboardData hook 或 dashboardEdgeFunctionService
 */
export class DashboardDataAdapter {
  /**
   * 获取即将续费的订阅（适配 subscription store 格式）
   */
  async getUpcomingRenewals(days: number = 7) {
    try {
      const { currency: userCurrency } = useSettingsStore.getState()
      const renewals = await dashboardEdgeFunctionService.getUpcomingRenewals(
        userCurrency || 'CNY', 
        days
      )

      // 转换为 subscription store 期望的格式
      return renewals?.map(renewal => ({
        id: renewal.id,
        name: renewal.name,
        amount: renewal.amount,
        currency: renewal.currency,
        nextBillingDate: renewal.next_billing_date,
        billingCycle: renewal.billing_cycle,
        status: 'active' as const
      })) || []
    } catch (error) {
      console.error('获取即将续费订阅失败:', error)
      return []
    }
  }

  /**
   * 获取最近支付的订阅（适配 subscription store 格式）
   */
  async getRecentlyPaid(days: number = 7) {
    try {
      const { currency: userCurrency } = useSettingsStore.getState()
      const recentPaid = await dashboardEdgeFunctionService.getRecentlyPaid(
        userCurrency || 'CNY', 
        days
      )

      // 转换为 subscription store 期望的格式
      return recentPaid?.map(payment => ({
        id: payment.id,
        name: payment.name,
        amount: payment.amount,
        currency: payment.currency,
        lastBillingDate: payment.last_billing_date,
        billingCycle: payment.billing_cycle,
        status: 'active' as const
      })) || []
    } catch (error) {
      console.error('获取最近支付订阅失败:', error)
      return []
    }
  }

  /**
   * 获取分类支出统计（适配 subscription store 格式）
   */
  async getSpendingByCategory() {
    try {
      const { currency: userCurrency } = useSettingsStore.getState()
      const categoryData = await dashboardEdgeFunctionService.getCategoryBreakdown(
        userCurrency || 'CNY'
      )

      // 转换为 subscription store 期望的格式
      const result: Record<string, number> = {}
      categoryData?.forEach(category => {
        result[category.category] = category.amount
      })

      return result
    } catch (error) {
      console.error('获取分类支出统计失败:', error)
      return {}
    }
  }

  /**
   * 获取完整的 Dashboard 数据
   */
  async getDashboardData(targetCurrency?: string) {
    try {
      const currency = targetCurrency || useSettingsStore.getState().currency || 'CNY'
      
      const data = await dashboardEdgeFunctionService.getDashboardAnalytics({
        targetCurrency: currency,
        includeUpcomingRenewals: true,
        includeRecentlyPaid: true,
        includeCategoryBreakdown: true
      })

      return {
        monthlySpending: data.monthlySpending,
        yearlySpending: data.yearlySpending,
        activeSubscriptions: data.activeSubscriptions,
        upcomingRenewals: data.upcomingRenewals?.map(renewal => ({
          id: renewal.id,
          name: renewal.name,
          amount: renewal.amount,
          currency: renewal.currency,
          nextBillingDate: renewal.next_billing_date,
          billingCycle: renewal.billing_cycle,
          status: 'active' as const
        })) || [],
        recentlyPaid: data.recentlyPaid?.map(payment => ({
          id: payment.id,
          name: payment.name,
          amount: payment.amount,
          currency: payment.currency,
          lastBillingDate: payment.last_billing_date,
          billingCycle: payment.billing_cycle,
          status: 'active' as const
        })) || [],
        categoryBreakdown: data.categoryBreakdown || [],
        currency: data.currency,
        timestamp: data.timestamp
      }
    } catch (error) {
      console.error('获取 Dashboard 数据失败:', error)
      throw error
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    dashboardEdgeFunctionService.clearCache()
  }
}

// 导出单例实例
export const dashboardDataAdapter = new DashboardDataAdapter()