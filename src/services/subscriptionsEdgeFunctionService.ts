import { supabase } from '@/lib/supabase'

export interface SubscriptionsRequest {
  targetCurrency?: string
  includeCategories?: boolean
  includePaymentMethods?: boolean
  filters?: {
    status?: 'all' | 'active' | 'cancelled'
    categories?: string[]
    billingCycles?: string[]
    searchTerm?: string
  }
  sorting?: {
    field?: 'nextBillingDate' | 'name' | 'amount'
    order?: 'asc' | 'desc'
  }
}

export interface SubscriptionData {
  id: string
  name: string
  plan: string
  amount: number
  currency: string
  convertedAmount: number
  billingCycle: string
  nextBillingDate: string
  lastBillingDate: string | null
  status: string
  categoryId: string
  paymentMethodId: string
  startDate: string
  renewalType: string
  notes: string
  website?: string
  category?: {
    id: string
    value: string
    label: string
  }
  paymentMethod?: {
    id: string
    value: string
    label: string
  }
}

export interface CategoryData {
  id: string
  value: string
  label: string
  is_default?: boolean
}

export interface PaymentMethodData {
  id: string
  value: string
  label: string
  is_default?: boolean
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionData[]
  categories?: CategoryData[]
  paymentMethods?: PaymentMethodData[]
  summary: {
    totalSubscriptions: number
    activeSubscriptions: number
    cancelledSubscriptions: number
    totalMonthlySpending: number
    totalYearlySpending: number
  }
  currency: string
  timestamp: string
}

/**
 * Subscriptions Edge Function 服务
 * 统一调用 Supabase Edge Function 获取 subscriptions 数据
 */
export class SubscriptionsEdgeFunctionService {
  private cache: Map<string, { data: SubscriptionsResponse; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 30000 // 30秒缓存
  private pendingRequests: Map<string, Promise<SubscriptionsResponse>> = new Map()

  /**
   * 获取缓存的数据
   */
  private getCachedData(key: string): SubscriptionsResponse | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  /**
   * 设置缓存数据
   */
  private setCachedData(key: string, data: SubscriptionsResponse): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: SubscriptionsRequest): string {
    return JSON.stringify({
      targetCurrency: request.targetCurrency || 'CNY',
      includeCategories: request.includeCategories !== false,
      includePaymentMethods: request.includePaymentMethods !== false,
      filters: request.filters || {},
      sorting: request.sorting || { field: 'nextBillingDate', order: 'asc' }
    })
  }

  /**
   * 防重复请求装饰器
   */
  private async withDeduplication(
    key: string, 
    fn: () => Promise<SubscriptionsResponse>
  ): Promise<SubscriptionsResponse> {
    // 检查缓存
    const cached = this.getCachedData(key)
    if (cached !== null) {
      console.log(`使用缓存数据: subscriptions_${key.substring(0, 50)}...`)
      return cached
    }

    // 检查是否有正在进行的请求
    if (this.pendingRequests.has(key)) {
      console.log(`等待进行中的请求: subscriptions_${key.substring(0, 50)}...`)
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
    console.log('Subscriptions缓存已清除')
  }

  /**
   * 获取完整的 Subscriptions 数据
   */
  async getSubscriptionsData(
    request: SubscriptionsRequest = {}
  ): Promise<SubscriptionsResponse> {
    const cacheKey = this.generateCacheKey(request)

    return this.withDeduplication(cacheKey, async () => {
      try {
        console.log('调用 Subscriptions Edge Function...', request)

        const { data, error } = await supabase.functions.invoke('subscriptions-management', {
          body: request
        })

        if (error) {
          console.error('Subscriptions Edge Function 调用失败:', error)
          throw new Error(`Subscriptions Edge Function error: ${error.message}`)
        }

        if (!data.success) {
          console.error('Subscriptions Edge Function 返回错误:', data.error)
          throw new Error(`Subscriptions management failed: ${data.error}`)
        }

        console.log('Subscriptions Edge Function 调用成功')
        return data.data as SubscriptionsResponse

      } catch (error) {
        console.error('Subscriptions Edge Function 服务错误:', error)
        throw error
      }
    })
  }

  /**
   * 获取基础订阅数据（不包含分类和支付方式）
   */
  async getBasicSubscriptionsData(
    targetCurrency: string = 'CNY',
    filters?: SubscriptionsRequest['filters'],
    sorting?: SubscriptionsRequest['sorting']
  ): Promise<{
    subscriptions: SubscriptionData[]
    summary: SubscriptionsResponse['summary']
  }> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: false,
        includePaymentMethods: false,
        filters,
        sorting
      })

      return {
        subscriptions: data.subscriptions,
        summary: data.summary
      }
    } catch (error) {
      console.error('获取基础订阅数据失败:', error)
      return {
        subscriptions: [],
        summary: {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          cancelledSubscriptions: 0,
          totalMonthlySpending: 0,
          totalYearlySpending: 0
        }
      }
    }
  }

  /**
   * 获取分类数据
   */
  async getCategories(targetCurrency: string = 'CNY'): Promise<CategoryData[]> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: true,
        includePaymentMethods: false,
        filters: { status: 'all' }
      })

      return data.categories || []
    } catch (error) {
      console.error('获取分类数据失败:', error)
      return []
    }
  }

  /**
   * 获取支付方式数据
   */
  async getPaymentMethods(targetCurrency: string = 'CNY'): Promise<PaymentMethodData[]> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: false,
        includePaymentMethods: true,
        filters: { status: 'all' }
      })

      return data.paymentMethods || []
    } catch (error) {
      console.error('获取支付方式数据失败:', error)
      return []
    }
  }

  /**
   * 搜索订阅
   */
  async searchSubscriptions(
    searchTerm: string,
    targetCurrency: string = 'CNY',
    additionalFilters?: Omit<SubscriptionsRequest['filters'], 'searchTerm'>
  ): Promise<SubscriptionData[]> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: true,
        includePaymentMethods: true,
        filters: {
          ...additionalFilters,
          searchTerm
        }
      })

      return data.subscriptions
    } catch (error) {
      console.error('搜索订阅失败:', error)
      return []
    }
  }

  /**
   * 按状态获取订阅
   */
  async getSubscriptionsByStatus(
    status: 'all' | 'active' | 'cancelled',
    targetCurrency: string = 'CNY'
  ): Promise<SubscriptionData[]> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: true,
        includePaymentMethods: true,
        filters: { status }
      })

      return data.subscriptions
    } catch (error) {
      console.error('按状态获取订阅失败:', error)
      return []
    }
  }

  /**
   * 获取订阅统计摘要
   */
  async getSubscriptionsSummary(targetCurrency: string = 'CNY'): Promise<SubscriptionsResponse['summary']> {
    try {
      const data = await this.getSubscriptionsData({
        targetCurrency,
        includeCategories: false,
        includePaymentMethods: false
      })

      return data.summary
    } catch (error) {
      console.error('获取订阅统计摘要失败:', error)
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        cancelledSubscriptions: 0,
        totalMonthlySpending: 0,
        totalYearlySpending: 0
      }
    }
  }
}

// 导出单例实例
export const subscriptionsEdgeFunctionService = new SubscriptionsEdgeFunctionService()