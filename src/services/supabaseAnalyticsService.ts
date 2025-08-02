import { supabase } from '@/lib/supabase'
import { convertCurrency } from '@/utils/currency'

// 分析数据类型定义
export interface MonthlyExpense {
  monthKey: string
  month: string
  year: number
  amount: number
  subscriptionCount: number
}

export interface YearlyExpense {
  year: number
  amount: number
  subscriptionCount: number
}

export interface CategoryExpense {
  category: string
  amount: number
  percentage: number
  subscriptionCount: number
}

export interface ExpenseMetrics {
  totalSpent: number
  averageMonthly: number
  averagePerSubscription: number
  highestMonth: MonthlyExpense | null
  lowestMonth: MonthlyExpense | null
  growthRate: number
}

export interface ExpenseTrend {
  period: string
  amount: number
  change: number
  changePercentage: number
}

/**
 * Supabase分析服务
 * 提供基于Supabase的订阅统计和分析功能
 */
export class SupabaseAnalyticsService {
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
   * 格式化月份显示
   */
  private formatMonth(year: number, month: number): string {
    const date = new Date(year, month - 1)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    })
  }

  /**
   * 获取月度费用统计
   */
  async getMonthlyExpenses(
    startDate: Date,
    endDate: Date,
    targetCurrency: string = 'CNY'
  ): Promise<MonthlyExpense[]> {
    // 获取指定时间范围内的活跃订阅
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        name,
        amount,
        currency,
        billing_cycle,
        start_date,
        next_billing_date,
        status,
        categories (
          value,
          label
        )
      `)
      .eq('status', 'active')
      .gte('start_date', startDate.toISOString().split('T')[0])
      .lte('start_date', endDate.toISOString().split('T')[0])

    if (error) {
      console.error('Error fetching subscriptions for monthly expenses:', error)
      throw new Error(`获取月度费用数据失败: ${error.message}`)
    }

    // 按月份分组计算费用
    const monthlyMap = new Map<string, { amount: number; subscriptions: Set<string> }>()

    subscriptions?.forEach(subscription => {
      const startDate = new Date(subscription.start_date)
      const monthlyAmount = this.calculateMonthlyAmount(subscription.amount, subscription.billing_cycle)
      const convertedAmount = convertCurrency(monthlyAmount, subscription.currency, targetCurrency)

      // 从开始月份到当前月份，每个月都计入费用
      let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      const now = new Date()
      const endMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      while (currentMonth <= endMonth) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { amount: 0, subscriptions: new Set() })
        }

        const monthData = monthlyMap.get(monthKey)!
        monthData.amount += convertedAmount
        monthData.subscriptions.add(subscription.id)

        // 移动到下个月
        currentMonth.setMonth(currentMonth.getMonth() + 1)
      }
    })

    // 转换为结果格式
    return Array.from(monthlyMap.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-').map(Number)
        return {
          monthKey,
          month: this.formatMonth(year, month),
          year,
          amount: Math.round(data.amount * 100) / 100,
          subscriptionCount: data.subscriptions.size
        }
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }

  /**
   * 获取年度费用统计
   */
  async getYearlyExpenses(
    startDate: Date,
    endDate: Date,
    targetCurrency: string = 'CNY'
  ): Promise<YearlyExpense[]> {
    const monthlyExpenses = await this.getMonthlyExpenses(startDate, endDate, targetCurrency)
    
    // 从月度数据聚合年度数据
    const yearlyMap = new Map<number, { amount: number; subscriptions: Set<string> }>()

    monthlyExpenses.forEach(expense => {
      if (!yearlyMap.has(expense.year)) {
        yearlyMap.set(expense.year, { amount: 0, subscriptions: new Set() })
      }

      const yearData = yearlyMap.get(expense.year)!
      yearData.amount += expense.amount
      // 注意：这里无法准确统计年度唯一订阅数，使用近似值
    })

    return Array.from(yearlyMap.entries())
      .map(([year, data]) => ({
        year,
        amount: Math.round(data.amount * 100) / 100,
        subscriptionCount: data.subscriptions.size
      }))
      .sort((a, b) => a.year - b.year)
  }

  /**
   * 获取分类费用统计
   */
  async getCategoryExpenses(
    startDate: Date,
    endDate: Date,
    targetCurrency: string = 'CNY'
  ): Promise<CategoryExpense[]> {
    // 获取活跃订阅及其分类信息
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        name,
        amount,
        currency,
        billing_cycle,
        status,
        category_id,
        categories!inner (
          value,
          label
        )
      `)
      .eq('status', 'active')

    if (error) {
      console.error('Error fetching subscriptions for category expenses:', error)
      throw new Error(`获取分类费用数据失败: ${error.message}`)
    }

    // 按分类计算年度费用
    const categoryMap = new Map<string, { amount: number; subscriptions: Set<string> }>()
    let totalAmount = 0

    subscriptions?.forEach(subscription => {
      const yearlyAmount = subscription.billing_cycle === 'monthly' 
        ? subscription.amount * 12
        : subscription.billing_cycle === 'quarterly'
        ? subscription.amount * 4
        : subscription.amount

      const convertedAmount = convertCurrency(yearlyAmount, subscription.currency, targetCurrency)
      const categoryValue = (subscription as any).categories?.value || 'other'

      if (!categoryMap.has(categoryValue)) {
        categoryMap.set(categoryValue, { amount: 0, subscriptions: new Set() })
      }

      const categoryData = categoryMap.get(categoryValue)!
      categoryData.amount += convertedAmount
      categoryData.subscriptions.add(subscription.id)
      totalAmount += convertedAmount
    })

    // 转换为结果格式并计算百分比
    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100 * 100) / 100 : 0,
        subscriptionCount: data.subscriptions.size
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  /**
   * 获取费用指标统计
   */
  async getExpenseMetrics(
    startDate: Date,
    endDate: Date,
    targetCurrency: string = 'CNY'
  ): Promise<ExpenseMetrics> {
    const monthlyExpenses = await this.getMonthlyExpenses(startDate, endDate, targetCurrency)

    if (monthlyExpenses.length === 0) {
      return {
        totalSpent: 0,
        averageMonthly: 0,
        averagePerSubscription: 0,
        highestMonth: null,
        lowestMonth: null,
        growthRate: 0
      }
    }

    const totalSpent = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const averageMonthly = totalSpent / monthlyExpenses.length
    
    // 计算平均每个订阅的费用
    const totalSubscriptions = monthlyExpenses.reduce((sum, expense) => sum + expense.subscriptionCount, 0)
    const averagePerSubscription = totalSubscriptions > 0 ? totalSpent / totalSubscriptions : 0

    // 找出最高和最低月份
    const sortedByAmount = [...monthlyExpenses].sort((a, b) => a.amount - b.amount)
    const lowestMonth = sortedByAmount[0]
    const highestMonth = sortedByAmount[sortedByAmount.length - 1]

    // 计算增长率（最后一个月相比第一个月）
    let growthRate = 0
    if (monthlyExpenses.length >= 2) {
      const firstMonth = monthlyExpenses[0]
      const lastMonth = monthlyExpenses[monthlyExpenses.length - 1]
      if (firstMonth.amount > 0) {
        growthRate = ((lastMonth.amount - firstMonth.amount) / firstMonth.amount) * 100
      }
    }

    return {
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageMonthly: Math.round(averageMonthly * 100) / 100,
      averagePerSubscription: Math.round(averagePerSubscription * 100) / 100,
      highestMonth,
      lowestMonth,
      growthRate: Math.round(growthRate * 100) / 100
    }
  }

  /**
   * 获取费用趋势数据
   */
  async getExpenseTrends(
    startDate: Date,
    endDate: Date,
    targetCurrency: string = 'CNY'
  ): Promise<ExpenseTrend[]> {
    const monthlyExpenses = await this.getMonthlyExpenses(startDate, endDate, targetCurrency)

    return monthlyExpenses.map((expense, index) => {
      let change = 0
      let changePercentage = 0

      if (index > 0) {
        const previousExpense = monthlyExpenses[index - 1]
        change = expense.amount - previousExpense.amount
        if (previousExpense.amount > 0) {
          changePercentage = (change / previousExpense.amount) * 100
        }
      }

      return {
        period: expense.month,
        amount: expense.amount,
        change: Math.round(change * 100) / 100,
        changePercentage: Math.round(changePercentage * 100) / 100
      }
    })
  }

  /**
   * 获取当月支出
   */
  async getCurrentMonthSpending(targetCurrency: string = 'CNY'): Promise<number> {
    try {
      // 直接计算当前活跃订阅的月度费用
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('amount, currency, billing_cycle')
        .eq('status', 'active')

      if (error) {
        console.error('Failed to get current month spending:', error)
        throw new Error(`获取当月支出失败: ${error.message}`)
      }

      let totalMonthlySpending = 0

      subscriptions?.forEach(subscription => {
        const monthlyAmount = this.calculateMonthlyAmount(subscription.amount, subscription.billing_cycle)
        const convertedAmount = convertCurrency(monthlyAmount, subscription.currency, targetCurrency)
        totalMonthlySpending += convertedAmount
      })

      return Math.round(totalMonthlySpending * 100) / 100
    } catch (error) {
      console.error('Failed to get current month spending:', error)
      return 0
    }
  }

  /**
   * 获取当年总支出
   */
  async getCurrentYearSpending(targetCurrency: string = 'CNY'): Promise<number> {
    try {
      // 直接计算当前活跃订阅的年度费用
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('amount, currency, billing_cycle')
        .eq('status', 'active')

      if (error) {
        console.error('Failed to get current year spending:', error)
        throw new Error(`获取当年支出失败: ${error.message}`)
      }

      let totalYearlySpending = 0

      subscriptions?.forEach(subscription => {
        let yearlyAmount = subscription.amount
        
        // 转换为年度金额
        switch (subscription.billing_cycle) {
          case 'monthly':
            yearlyAmount = subscription.amount * 12
            break
          case 'quarterly':
            yearlyAmount = subscription.amount * 4
            break
          case 'yearly':
            yearlyAmount = subscription.amount
            break
        }

        const convertedAmount = convertCurrency(yearlyAmount, subscription.currency, targetCurrency)
        totalYearlySpending += convertedAmount
      })

      return Math.round(totalYearlySpending * 100) / 100
    } catch (error) {
      console.error('Failed to get current year spending:', error)
      return 0
    }
  }

  /**
   * 获取即将到期的订阅统计
   */
  async getUpcomingRenewalsStats(days: number = 30): Promise<{
    count: number
    totalAmount: number
    avgAmount: number
  }> {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('amount, currency')
      .eq('status', 'active')
      .gte('next_billing_date', today.toISOString().split('T')[0])
      .lte('next_billing_date', futureDate.toISOString().split('T')[0])

    if (error) {
      console.error('Error fetching upcoming renewals stats:', error)
      throw new Error(`获取即将到期订阅统计失败: ${error.message}`)
    }

    const count = subscriptions?.length || 0
    const totalAmount = subscriptions?.reduce((sum, sub) => {
      return sum + convertCurrency(sub.amount, sub.currency, 'CNY')
    }, 0) || 0

    return {
      count,
      totalAmount: Math.round(totalAmount * 100) / 100,
      avgAmount: count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0
    }
  }

  /**
   * 获取订阅状态统计
   */
  async getSubscriptionStatusStats(): Promise<{
    active: number
    inactive: number
    cancelled: number
    total: number
  }> {
    const { data: stats, error } = await supabase
      .from('subscriptions')
      .select('status')

    if (error) {
      console.error('Error fetching subscription status stats:', error)
      throw new Error(`获取订阅状态统计失败: ${error.message}`)
    }

    const statusCounts = {
      active: 0,
      inactive: 0,
      cancelled: 0,
      total: stats?.length || 0
    }

    stats?.forEach(sub => {
      switch (sub.status) {
        case 'active':
          statusCounts.active++
          break
        case 'inactive':
          statusCounts.inactive++
          break
        case 'cancelled':
          statusCounts.cancelled++
          break
      }
    })

    return statusCounts
  }
}

// 导出单例实例
export const supabaseAnalyticsService = new SupabaseAnalyticsService()