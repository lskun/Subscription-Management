import { supabase } from '@/lib/supabase'
import { UserCacheService } from './userCacheService'

// Supabase数据库字段类型（snake_case）
interface SupabasePaymentHistory {
  id: string
  user_id: string
  subscription_id: string
  payment_date: string
  amount_paid: number
  currency: string
  billing_period_start: string
  billing_period_end: string
  status: 'succeeded' | 'failed' | 'refunded'
  notes: string | null
  created_at: string
  // 关联数据
  subscriptions?: {
    id: string
    name: string
  }
}

// 前端使用的支付历史数据类型（camelCase）
export interface PaymentHistoryRecord {
  id: string
  userId: string
  subscriptionId: string
  paymentDate: string
  amountPaid: number
  currency: string
  billingPeriodStart: string
  billingPeriodEnd: string
  status: 'succeeded' | 'failed' | 'refunded'
  notes: string | null
  createdAt: string
  // 关联数据
  subscription?: {
    id: string
    name: string
  }
}

// 创建支付记录的输入数据类型
export interface CreatePaymentHistoryInput {
  subscription_id: string
  payment_date: string
  amount_paid: number
  currency: string
  billing_period_start: string
  billing_period_end: string
  status: 'succeeded' | 'failed' | 'refunded'
  notes?: string
  user_id?: string
}

// 支付历史统计数据类型
export interface PaymentHistoryStats {
  totalPayments: number
  totalAmount: number
  successfulPayments: number
  failedPayments: number
  refundedPayments: number
  averageAmount: number
  lastPaymentDate: string | null
}

/**
 * Supabase支付历史管理服务
 * 提供基于Supabase的支付历史CRUD操作，支持多租户数据隔离
 */
export class SupabasePaymentHistoryService {
  /**
   * 数据转换：从Supabase格式转换为前端格式
   */
  private transformFromSupabase(data: SupabasePaymentHistory): PaymentHistoryRecord {
    return {
      id: data.id,
      userId: data.user_id,
      subscriptionId: data.subscription_id,
      paymentDate: data.payment_date,
      amountPaid: data.amount_paid,
      currency: data.currency,
      billingPeriodStart: data.billing_period_start,
      billingPeriodEnd: data.billing_period_end,
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      subscription: data.subscriptions ? {
        id: data.subscriptions.id,
        name: data.subscriptions.name
      } : undefined
    }
  }

  /**
   * 数据转换：从前端格式转换为Supabase格式
   */
  private transformToSupabase(data: Partial<PaymentHistoryRecord>): Partial<CreatePaymentHistoryInput> {
    const result: Partial<CreatePaymentHistoryInput> = {}
    
    if (data.subscriptionId !== undefined) result.subscription_id = data.subscriptionId
    if (data.paymentDate !== undefined) result.payment_date = data.paymentDate
    if (data.amountPaid !== undefined) result.amount_paid = data.amountPaid
    if (data.currency !== undefined) result.currency = data.currency
    if (data.billingPeriodStart !== undefined) result.billing_period_start = data.billingPeriodStart
    if (data.billingPeriodEnd !== undefined) result.billing_period_end = data.billingPeriodEnd
    if (data.status !== undefined) result.status = data.status
    if (data.notes !== undefined) result.notes = data.notes
    
    return result
  }

  /**
   * 获取所有支付历史记录（包含关联的订阅信息）
   */
  async getAllPaymentHistory(): Promise<PaymentHistoryRecord[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error fetching payment history:', error)
      throw new Error(`获取支付历史失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 根据订阅ID获取支付历史
   */
  async getPaymentHistoryBySubscription(subscriptionId: string): Promise<PaymentHistoryRecord[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .eq('subscription_id', subscriptionId)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error fetching payment history by subscription:', error)
      throw new Error(`获取订阅支付历史失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 根据ID获取单个支付记录
   */
  async getPaymentHistoryById(id: string): Promise<PaymentHistoryRecord | null> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('Error fetching payment history:', error)
      throw new Error(`获取支付记录详情失败: ${error.message}`)
    }

    return data ? this.transformFromSupabase(data) : null
  }

  /**
   * 创建新的支付记录
   */
  async createPaymentHistory(paymentData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>): Promise<PaymentHistoryRecord> {
    // 获取当前用户ID
    const user = await UserCacheService.getCurrentUser()
    if (!user) {
      throw new Error('用户未登录')
    }

    // 转换数据格式
    const supabaseData = this.transformToSupabase(paymentData)
    
    const insertData: CreatePaymentHistoryInput = {
      ...supabaseData as CreatePaymentHistoryInput,
      user_id: user.id // 自动添加用户ID
    }

    const { data, error } = await supabase
      .from('payment_history')
      .insert(insertData)
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error creating payment history:', error)
      throw new Error(`创建支付记录失败: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * 更新支付记录
   */
  async updatePaymentHistory(id: string, updateData: Partial<PaymentHistoryRecord>): Promise<PaymentHistoryRecord> {
    // 转换数据格式
    const supabaseData = this.transformToSupabase(updateData)

    const { data, error } = await supabase
      .from('payment_history')
      .update(supabaseData)
      .eq('id', id)
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating payment history:', error)
      throw new Error(`更新支付记录失败: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * 删除支付记录
   */
  async deletePaymentHistory(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_history')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting payment history:', error)
      throw new Error(`删除支付记录失败: ${error.message}`)
    }
  }

  /**
   * 获取支付历史统计信息
   * @param subscriptionId 可选的订阅ID，如果提供则只统计该订阅的支付历史
   */
  async getPaymentHistoryStats(subscriptionId?: string): Promise<PaymentHistoryStats> {
    let query = supabase
      .from('payment_history')
      .select('amount_paid, currency, status, payment_date')
    
    // 如果提供了订阅ID，则只查询该订阅的支付历史
    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching payment history stats:', error)
      throw new Error(`获取支付历史统计失败: ${error.message}`)
    }

    const stats = {
      totalPayments: data.length,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      averageAmount: 0,
      lastPaymentDate: null as string | null
    }

    // 导入汇率转换函数和汇率数据
    const { convertCurrency } = await import('@/utils/currency')
    const { BASE_CURRENCY, DEFAULT_EXCHANGE_RATES } = await import('@/config/currency')
    
    let totalAmount = 0
    let latestDate: Date | null = null

    data.forEach(payment => {
      // 统计总金额（只计算成功的支付）
      if (payment.status === 'succeeded') {
        // 将支付金额转换为基础货币（CNY），使用默认汇率
        const convertedAmount = convertCurrency(
          payment.amount_paid,
          payment.currency,
          BASE_CURRENCY,
          DEFAULT_EXCHANGE_RATES
        )
        totalAmount += convertedAmount
      }

      // 统计各种状态的支付
      switch (payment.status) {
        case 'succeeded':
          stats.successfulPayments++
          break
        case 'failed':
          stats.failedPayments++
          break
        case 'refunded':
          stats.refundedPayments++
          break
      }

      // 找出最新的支付日期
      const paymentDate = new Date(payment.payment_date)
      if (!latestDate || paymentDate > latestDate) {
        latestDate = paymentDate
      }
    })

    stats.totalAmount = Math.round(totalAmount * 100) / 100
    stats.averageAmount = stats.successfulPayments > 0 
      ? Math.round((totalAmount / stats.successfulPayments) * 100) / 100 
      : 0
    stats.lastPaymentDate = latestDate ? latestDate.toISOString().split('T')[0] : null

    return stats
  }

  /**
   * 按日期范围获取支付历史
   */
  async getPaymentHistoryByDateRange(
    startDate: string,
    endDate: string
  ): Promise<PaymentHistoryRecord[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error fetching payment history by date range:', error)
      throw new Error(`按日期范围获取支付历史失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 按状态获取支付历史
   */
  async getPaymentHistoryByStatus(
    status: 'succeeded' | 'failed' | 'refunded'
  ): Promise<PaymentHistoryRecord[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .eq('status', status)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error fetching payment history by status:', error)
      throw new Error(`按状态获取支付历史失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 搜索支付历史
   */
  async searchPaymentHistory(query: string): Promise<PaymentHistoryRecord[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      .or(`notes.ilike.%${query}%,subscriptions.name.ilike.%${query}%`)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error searching payment history:', error)
      throw new Error(`搜索支付历史失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 批量创建支付记录（用于数据迁移或批量导入）
   */
  async bulkCreatePaymentHistory(
    paymentsData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>[]
  ): Promise<PaymentHistoryRecord[]> {
    // 获取当前用户ID
    const user = await UserCacheService.getCurrentUser()
    if (!user) {
      throw new Error('用户未登录')
    }

    // 转换数据格式并添加用户ID
    const insertData: CreatePaymentHistoryInput[] = paymentsData.map(payment => {
      const supabaseData = this.transformToSupabase(payment)
      return {
        ...supabaseData as CreatePaymentHistoryInput,
        user_id: user.id
      }
    })

    const { data, error } = await supabase
      .from('payment_history')
      .insert(insertData)
      .select(`
        *,
        subscriptions (
          id,
          name
        )
      `)

    if (error) {
      console.error('Error bulk creating payment history:', error)
      throw new Error(`批量创建支付记录失败: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 获取月度支付统计
   */
  async getMonthlyPaymentStats(year: number, month: number): Promise<{
    totalPayments: number
    totalAmount: number
    successRate: number
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // 月末日期

    const { data, error } = await supabase
      .from('payment_history')
      .select('amount_paid, status')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)

    if (error) {
      console.error('Error fetching monthly payment stats:', error)
      throw new Error(`获取月度支付统计失败: ${error.message}`)
    }

    const totalPayments = data.length
    const successfulPayments = data.filter(p => p.status === 'succeeded').length
    const totalAmount = data
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount_paid, 0)

    return {
      totalPayments,
      totalAmount: Math.round(totalAmount * 100) / 100,
      successRate: totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100 * 100) / 100 : 0
    }
  }
}

// 导出单例实例
export const supabasePaymentHistoryService = new SupabasePaymentHistoryService()