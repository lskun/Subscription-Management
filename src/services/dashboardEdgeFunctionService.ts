import { supabase } from '@/lib/supabase'

export interface DashboardAnalyticsRequest {
  targetCurrency?: string
  includeUpcomingRenewals?: boolean
  includeRecentlyPaid?: boolean
  includeCategoryBreakdown?: boolean
  upcomingDays?: number
  recentDays?: number
}

export interface DashboardAnalyticsResponse {
  monthlySpending: number
  yearlySpending: number
  activeSubscriptions: number
  upcomingRenewals?: Array<{
    id: string
    name: string
    amount: number
    currency: string
    next_billing_date: string
    billing_cycle: string
    convertedAmount: number
  }>
  recentlyPaid?: Array<{
    id: string
    name: string
    amount: number
    currency: string
    last_billing_date: string
    billing_cycle: string
    convertedAmount: number
  }>
  categoryBreakdown?: Array<{
    category: string
    label: string
    amount: number
    percentage: number
    subscriptionCount: number
  }>
  currency: string
  timestamp: string
}

/**
 * Dashboard Edge Function 服务
 * 统一调用 Supabase Edge Function 获取 dashboard 数据
 */
export class DashboardEdgeFunctionService {
  private cache: Map<string, { data: DashboardAnalyticsResponse; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 30000 // 30秒缓存
  private pendingRequests: Map<string, Promise<DashboardAnalyticsResponse>> = new Map()

  /**
   * 获取缓存的数据
   */
  private getCachedData(key: string): DashboardAnalyticsResponse | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(key: string, data: DashboardAnalyticsResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * 防重复请求装饰器
   */
  private async withDeduplication(
    key: string, 
    fn: () => Promise<DashboardAnalyticsResponse>
  ): Promise<DashboardAnalyticsResponse> {
    // 检查缓存
    const cached = this.getCachedData(key)
    if (cached !== null) {
      console.log(`使用缓存数据: ${key}`)
      return cached
    }

    // 检查是否有正在进行的请求
    if (this.pendingRequests.has(key)) {
      console.log(`等待进行中的请求: ${key}`)
      return this.pendingRequests.get(key)!
    }

    // 创建新请求
    const promise = fn().then(result => {
      this.setCachedData(key, result)
      this.pendingRequests.delete(key)
      return result
    }).catch(error => {
      this.pendingRequests.delete(key)
      throw error
    })

    this.pendingRequests.set(key, promise)
    return promise
  }

  /**
   * 清除缓存
   */
  public clearCache(pattern?: string): void {
    if (pattern) {
      // 清除匹配模式的缓存
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear()
    }
    // 清除待处理的请求
    this.pendingRequests.clear()
    console.log('Dashboard缓存已清除')
  }

  /**
   * 获取完整的 Dashboard 分析数据
   */
  async getDashboardAnalytics(
    request: DashboardAnalyticsRequest = {}
  ): Promise<DashboardAnalyticsResponse> {
    const {
      targetCurrency = 'CNY',
      includeUpcomingRenewals = true,
      includeRecentlyPaid = true,
      includeCategoryBreakdown = true,
      upcomingDays = 7,
      recentDays = 7
    } = request

    const cacheKey = `dashboard_${targetCurrency}_${includeUpcomingRenewals}_${includeRecentlyPaid}_${includeCategoryBreakdown}_${upcomingDays}_${recentDays}`

    return this.withDeduplication(cacheKey, async () => {
      try {
        console.log('调用 Dashboard Edge Function...')

        const { data, error } = await supabase.functions.invoke('dashboard-analytics', {
          body: {
            targetCurrency,
            includeUpcomingRenewals,
            includeRecentlyPaid,
            includeCategoryBreakdown,
            upcomingDays,
            recentDays
          }
        })

        if (error) {
          console.error('Dashboard Edge Function 调用失败:', error)
          throw new Error(`Dashboard Edge Function error: ${error.message}`)
        }

        if (!data.success) {
          console.error('Dashboard Edge Function 返回错误:', data.error)
          throw new Error(`Dashboard analytics failed: ${data.error}`)
        }

        console.log('Dashboard Edge Function 调用成功')
        return data.data as DashboardAnalyticsResponse

      } catch (error) {
        console.error('Dashboard Edge Function 服务错误:', error)
        throw error
      }
    })
  }

  /**
   * 获取基础支出数据（月度和年度）
   */
  async getBasicSpendingData(targetCurrency: string = 'CNY'): Promise<{
    monthlySpending: number
    yearlySpending: number
    activeSubscriptions: number
  }> {
    try {
      const data = await this.getDashboardAnalytics({
        targetCurrency,
        includeUpcomingRenewals: false,
        includeRecentlyPaid: false,
        includeCategoryBreakdown: false
      })

      return {
        monthlySpending: data.monthlySpending,
        yearlySpending: data.yearlySpending,
        activeSubscriptions: data.activeSubscriptions
      }
    } catch (error) {
      console.error('获取基础支出数据失败:', error)
      return {
        monthlySpending: 0,
        yearlySpending: 0,
        activeSubscriptions: 0
      }
    }
  }

  /**
   * 获取即将续费的订阅
   */
  async getUpcomingRenewals(
    targetCurrency: string = 'CNY',
    days: number = 7
  ): Promise<DashboardAnalyticsResponse['upcomingRenewals']> {
    try {
      const data = await this.getDashboardAnalytics({
        targetCurrency,
        includeUpcomingRenewals: true,
        includeRecentlyPaid: false,
        includeCategoryBreakdown: false,
        upcomingDays: days
      })

      return data.upcomingRenewals || []
    } catch (error) {
      console.error('获取即将续费订阅失败:', error)
      return []
    }
  }

  /**
   * 获取最近支付的订阅
   */
  async getRecentlyPaid(
    targetCurrency: string = 'CNY',
    days: number = 7
  ): Promise<DashboardAnalyticsResponse['recentlyPaid']> {
    try {
      const data = await this.getDashboardAnalytics({
        targetCurrency,
        includeUpcomingRenewals: false,
        includeRecentlyPaid: true,
        includeCategoryBreakdown: false,
        recentDays: days
      })

      return data.recentlyPaid || []
    } catch (error) {
      console.error('获取最近支付订阅失败:', error)
      return []
    }
  }

  /**
   * 获取分类支出统计
   */
  async getCategoryBreakdown(
    targetCurrency: string = 'CNY'
  ): Promise<DashboardAnalyticsResponse['categoryBreakdown']> {
    try {
      const data = await this.getDashboardAnalytics({
        targetCurrency,
        includeUpcomingRenewals: false,
        includeRecentlyPaid: false,
        includeCategoryBreakdown: true
      })

      return data.categoryBreakdown || []
    } catch (error) {
      console.error('获取分类支出统计失败:', error)
      return []
    }
  }

  /**
   * 获取当月支出（兼容旧接口）
   */
  async getCurrentMonthSpending(targetCurrency: string = 'CNY'): Promise<number> {
    try {
      const data = await this.getBasicSpendingData(targetCurrency)
      return data.monthlySpending
    } catch (error) {
      console.error('获取当月支出失败:', error)
      return 0
    }
  }

  /**
   * 获取当年支出（兼容旧接口）
   */
  async getCurrentYearSpending(targetCurrency: string = 'CNY'): Promise<number> {
    try {
      const data = await this.getBasicSpendingData(targetCurrency)
      return data.yearlySpending
    } catch (error) {
      console.error('获取当年支出失败:', error)
      return 0
    }
  }

  /**
   * 获取活跃订阅数量（兼容旧接口）
   */
  async getActiveSubscriptionCount(): Promise<number> {
    try {
      const data = await this.getBasicSpendingData()
      return data.activeSubscriptions
    } catch (error) {
      console.error('获取活跃订阅数量失败:', error)
      return 0
    }
  }
}

// 导出单例实例
export const dashboardEdgeFunctionService = new DashboardEdgeFunctionService()