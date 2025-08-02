import { supabase } from '@/lib/supabase'
import { convertCurrency } from '@/utils/currency'

/**
 * Dashboard分析服务
 * 专门为Dashboard页面提供简化的数据分析功能
 */
export class DashboardAnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 30000 // 30秒缓存
  private pendingRequests: Map<string, Promise<any>> = new Map()

  /**
   * 获取缓存的数据
   */
  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  /**
   * 设置缓存数据
   */
  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * 防重复请求装饰器
   */
  private async withDeduplication<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 检查缓存
    const cached = this.getCachedData<T>(key)
    if (cached !== null) {
      return cached
    }

    // 检查是否有正在进行的请求
    if (this.pendingRequests.has(key)) {
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
  }
  /**
   * 计算订阅的月度费用
   */
  private calculateMonthlyAmount(amount: number, billingCycle: string): number {
    switch (billingCycle) {
      case 'monthly':
        return amount
      case 'yearly':
        return amount / 12
      case 'quarterly':
        return amount / 3
      default:
        return amount
    }
  }

  /**
   * 获取当月支出
   */
  async getCurrentMonthSpending(targetCurrency: string = 'CNY'): Promise<number> {
    const cacheKey = `monthly_spending_${targetCurrency}`
    
    return this.withDeduplication(cacheKey, async () => {
      try {
        console.log('获取当月支出...')
        
        // 获取当前用户的活跃订阅
        const { data: subscriptions, error } = await supabase
          .from('subscriptions')
          .select('amount, currency, billing_cycle')
          .eq('status', 'active')

        if (error) {
          console.error('获取订阅数据失败:', error)
          return 0
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log('没有找到活跃订阅')
          return 0
        }

        let totalMonthlySpending = 0

        subscriptions.forEach(subscription => {
          // Ensure amount is a number
          const amount = typeof subscription.amount === 'number' ? subscription.amount : parseFloat(subscription.amount) || 0
          const monthlyAmount = this.calculateMonthlyAmount(amount, subscription.billing_cycle)
          
          // Ensure currencies are strings
          const fromCurrency = typeof subscription.currency === 'string' ? subscription.currency : 'CNY'
          const toCurrency = typeof targetCurrency === 'string' ? targetCurrency : 'CNY'
          
          const convertedAmount = convertCurrency(monthlyAmount, fromCurrency, toCurrency)
          totalMonthlySpending += convertedAmount
        })

        const result = Math.round(totalMonthlySpending * 100) / 100
        console.log(`当月支出计算完成: ${result} ${targetCurrency}`)
        return result
      } catch (error) {
        console.error('获取当月支出时出错:', error)
        return 0
      }
    })
  }

  /**
   * 获取当年总支出
   */
  async getCurrentYearSpending(targetCurrency: string = 'CNY'): Promise<number> {
    const cacheKey = `yearly_spending_${targetCurrency}`
    
    return this.withDeduplication(cacheKey, async () => {
      try {
        console.log('获取当年支出...')
        
        // 获取当前用户的活跃订阅
        const { data: subscriptions, error } = await supabase
          .from('subscriptions')
          .select('amount, currency, billing_cycle')
          .eq('status', 'active')

        if (error) {
          console.error('获取订阅数据失败:', error)
          return 0
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log('没有找到活跃订阅')
          return 0
        }

        let totalYearlySpending = 0

        subscriptions.forEach(subscription => {
          // Ensure amount is a number
          const amount = typeof subscription.amount === 'number' ? subscription.amount : parseFloat(subscription.amount) || 0
          let yearlyAmount = amount
          
          // 转换为年度金额
          switch (subscription.billing_cycle) {
            case 'monthly':
              yearlyAmount = amount * 12
              break
            case 'quarterly':
              yearlyAmount = amount * 4
              break
            case 'yearly':
              yearlyAmount = amount
              break
          }

          // Ensure currencies are strings
          const fromCurrency = typeof subscription.currency === 'string' ? subscription.currency : 'CNY'
          const toCurrency = typeof targetCurrency === 'string' ? targetCurrency : 'CNY'

          const convertedAmount = convertCurrency(yearlyAmount, fromCurrency, toCurrency)
          totalYearlySpending += convertedAmount
        })

        const result = Math.round(totalYearlySpending * 100) / 100
        console.log(`当年支出计算完成: ${result} ${targetCurrency}`)
        return result
      } catch (error) {
        console.error('获取当年支出时出错:', error)
        return 0
      }
    })
  }

  /**
   * 获取活跃订阅数量
   */
  async getActiveSubscriptionCount(): Promise<number> {
    try {
      console.log('获取活跃订阅数量...')
      
      const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (error) {
        console.error('获取订阅数量失败:', error)
        return 0
      }

      const result = count || 0
      console.log(`活跃订阅数量: ${result}`)
      return result
    } catch (error) {
      console.error('获取活跃订阅数量时出错:', error)
      return 0
    }
  }

  /**
   * 获取即将续费的订阅
   */
  async getUpcomingRenewals(days: number = 7): Promise<any[]> {
    try {
      console.log(`获取未来${days}天的即将续费订阅...`)
      
      const today = new Date()
      const futureDate = new Date()
      futureDate.setDate(today.getDate() + days)

      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          name,
          amount,
          currency,
          next_billing_date,
          billing_cycle
        `)
        .eq('status', 'active')
        .gte('next_billing_date', today.toISOString().split('T')[0])
        .lte('next_billing_date', futureDate.toISOString().split('T')[0])
        .order('next_billing_date', { ascending: true })

      if (error) {
        console.error('获取即将续费订阅失败:', error)
        return []
      }

      const result = subscriptions || []
      console.log(`找到${result.length}个即将续费的订阅`)
      return result
    } catch (error) {
      console.error('获取即将续费订阅时出错:', error)
      return []
    }
  }

  /**
   * 获取最近支付的订阅
   */
  async getRecentlyPaid(days: number = 7): Promise<any[]> {
    try {
      console.log(`获取最近${days}天的已支付订阅...`)
      
      const today = new Date()
      const pastDate = new Date()
      pastDate.setDate(today.getDate() - days)

      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          name,
          amount,
          currency,
          last_billing_date,
          billing_cycle
        `)
        .eq('status', 'active')
        .gte('last_billing_date', pastDate.toISOString().split('T')[0])
        .lte('last_billing_date', today.toISOString().split('T')[0])
        .order('last_billing_date', { ascending: false })

      if (error) {
        console.error('获取最近支付订阅失败:', error)
        return []
      }

      const result = subscriptions || []
      console.log(`找到${result.length}个最近支付的订阅`)
      return result
    } catch (error) {
      console.error('获取最近支付订阅时出错:', error)
      return []
    }
  }

  /**
   * 获取分类支出统计
   */
  async getCategoryBreakdown(targetCurrency: string = 'CNY'): Promise<any[]> {
    try {
      console.log('获取分类支出统计...')
      
      // 获取活跃订阅及其分类信息
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          name,
          amount,
          currency,
          billing_cycle,
          category_id,
          categories (
            value,
            label
          )
        `)
        .eq('status', 'active')

      if (error) {
        console.error('获取分类支出数据失败:', error)
        return []
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('没有找到活跃订阅')
        return []
      }

      // 按分类计算年度费用
      const categoryMap = new Map<string, { 
        label: string
        amount: number
        subscriptions: Set<string> 
      }>()
      let totalAmount = 0

      subscriptions.forEach(subscription => {
        // Ensure amount is a number
        const amount = typeof subscription.amount === 'number' ? subscription.amount : parseFloat(subscription.amount) || 0
        let yearlyAmount = amount
        
        // 转换为年度金额
        switch (subscription.billing_cycle) {
          case 'monthly':
            yearlyAmount = amount * 12
            break
          case 'quarterly':
            yearlyAmount = amount * 4
            break
          case 'yearly':
            yearlyAmount = amount
            break
        }

        // Ensure currencies are strings
        const fromCurrency = typeof subscription.currency === 'string' ? subscription.currency : 'CNY'
        const toCurrency = typeof targetCurrency === 'string' ? targetCurrency : 'CNY'

        const convertedAmount = convertCurrency(yearlyAmount, fromCurrency, toCurrency)
        const categoryValue = (subscription as any).categories?.value || 'other'
        const categoryLabel = (subscription as any).categories?.label || '其他'

        if (!categoryMap.has(categoryValue)) {
          categoryMap.set(categoryValue, { 
            label: categoryLabel,
            amount: 0, 
            subscriptions: new Set() 
          })
        }

        const categoryData = categoryMap.get(categoryValue)!
        categoryData.amount += convertedAmount
        categoryData.subscriptions.add(subscription.id)
        totalAmount += convertedAmount
      })

      // 转换为结果格式并计算百分比
      const result = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          label: data.label,
          amount: Math.round(data.amount * 100) / 100,
          percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100 * 100) / 100 : 0,
          subscriptionCount: data.subscriptions.size
        }))
        .sort((a, b) => b.amount - a.amount)

      console.log(`分类支出统计完成，共${result.length}个分类`)
      return result
    } catch (error) {
      console.error('获取分类支出统计时出错:', error)
      return []
    }
  }

  /**
   * 获取Dashboard概览数据
   */
  async getDashboardOverview(targetCurrency: string = 'CNY'): Promise<{
    monthlySpending: number
    yearlySpending: number
    activeSubscriptions: number
    upcomingRenewals: any[]
    recentlyPaid: any[]
    categoryBreakdown: any[]
  }> {
    try {
      console.log('获取Dashboard概览数据...')
      
      const [
        monthlySpending,
        yearlySpending,
        activeSubscriptions,
        upcomingRenewals,
        recentlyPaid,
        categoryBreakdown
      ] = await Promise.all([
        this.getCurrentMonthSpending(targetCurrency),
        this.getCurrentYearSpending(targetCurrency),
        this.getActiveSubscriptionCount(),
        this.getUpcomingRenewals(7),
        this.getRecentlyPaid(7),
        this.getCategoryBreakdown(targetCurrency)
      ])

      const result = {
        monthlySpending,
        yearlySpending,
        activeSubscriptions,
        upcomingRenewals,
        recentlyPaid,
        categoryBreakdown
      }

      console.log('Dashboard概览数据获取完成:', result)
      return result
    } catch (error) {
      console.error('获取Dashboard概览数据时出错:', error)
      return {
        monthlySpending: 0,
        yearlySpending: 0,
        activeSubscriptions: 0,
        upcomingRenewals: [],
        recentlyPaid: [],
        categoryBreakdown: []
      }
    }
  }
}

// 导出单例实例
export const dashboardAnalyticsService = new DashboardAnalyticsService()