import { supabase } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import { DuplicatePaymentDetectionService, DuplicatePaymentDetectionResult, PaymentToCheck } from './duplicatePaymentDetectionService'
// Supabase database field types (snake_case)
interface SupabasePaymentHistory {
  id: string
  user_id: string
  subscription_id: string
  payment_date: string
  amount_paid: number
  currency: string
  billing_period_start: string
  billing_period_end: string
  status: 'success' | 'failed' | 'pending'
  notes: string | null
  created_at: string
  // Associated data
  subscriptions?: {
    id: string
    name: string
  }
}

// Payment history data types used by frontend (camelCase)
export interface PaymentHistoryRecord {
  id: string
  userId: string
  subscriptionId: string
  paymentDate: string
  amountPaid: number
  currency: string
  billingPeriodStart: string
  billingPeriodEnd: string
  status: 'success' | 'failed' | 'pending'
  notes: string | null
  createdAt: string
  // Associated data
  subscription?: {
    id: string
    name: string
  }
}

// Input data type for creating payment records
export interface CreatePaymentHistoryInput {
  subscription_id: string
  payment_date: string
  amount_paid: number
  currency: string
  billing_period_start: string
  billing_period_end: string
  status: 'success' | 'failed' | 'pending'
  notes?: string
  user_id?: string
}

// Payment history statistics data type
export interface PaymentHistoryStats {
  totalPayments: number
  totalAmount: number
  successfulPayments: number
  failedPayments: number
  pendingPayments: number
  averageAmount: number
  lastPaymentDate: string | null
}

/**
 * Supabase Payment History Management Service
 * Provides Supabase-based payment history CRUD operations with multi-tenant data isolation
 */
export class SupabasePaymentHistoryService {
  /**
   * Data transformation: Convert from Supabase format to frontend format
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
   * Data transformation: Convert from frontend format to Supabase format
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
   * Get all payment history records (including associated subscription information)
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
      throw new Error(`Failed to get payment history: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Get payment history by subscription ID
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
      throw new Error(`Failed to get subscription payment history: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Get single payment record by ID
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
        return null // Record does not exist
      }
      console.error('Error fetching payment history:', error)
      throw new Error(`Failed to get payment record details: ${error.message}`)
    }

    return data ? this.transformFromSupabase(data) : null
  }

  /**
   * Create new payment record
   */
  async createPaymentHistory(paymentData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>): Promise<PaymentHistoryRecord> {
    // Get current user ID
    const user = await useSettingsStore.getState().getCurrentUser()
    if (!user) {
      throw new Error('User not logged in')
    }

    // Convert data format
    const supabaseData = this.transformToSupabase(paymentData)
    
    const insertData: CreatePaymentHistoryInput = {
      ...supabaseData as CreatePaymentHistoryInput,
      user_id: user.id // Automatically add user ID
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
      
      // 检测是否为唯一约束错误 (idx_unique_successful_payment_per_billing_period)
      if (error.code === '23505' && error.message.includes('idx_unique_successful_payment_per_billing_period')) {
        // 复用现有的重复支付检测提示信息
        throw new Error('Detected 1 successful payment records in the same billing period. Typically, only one successful payment record should exist in the same billing period. Please verify if this is a duplicate.')
      }
      
      throw new Error(`Failed to create payment record: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * 检测重复支付
   * @param paymentData 待检测的支付记录数据
   * @returns 重复支付检测结果
   */
  async checkDuplicatePayment(
    paymentData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>
  ): Promise<DuplicatePaymentDetectionResult> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser()
    if (!user) {
      throw new Error('User not logged in')
    }

    // 构造待检测的支付记录
    const paymentToCheck: PaymentToCheck = {
      subscription_id: paymentData.subscriptionId,
      payment_date: paymentData.paymentDate,
      amount_paid: paymentData.amountPaid,
      billing_period_start: paymentData.billingPeriodStart,
      billing_period_end: paymentData.billingPeriodEnd,
      status: paymentData.status
    }

    // 获取该订阅的所有现有支付记录
    const existingPayments = await this.getPaymentHistoryBySubscription(paymentData.subscriptionId)

    // 执行重复支付检测
    return await DuplicatePaymentDetectionService.detectDuplicatePayment(
      paymentToCheck,
      existingPayments
    )
  }

  /**
   * 创建支付记录（带重复检测）
   * @param paymentData 支付记录数据
   * @param skipDuplicateCheck 是否跳过重复检测
   * @returns 创建的支付记录和检测结果
   */
  async createPaymentHistoryWithDuplicateCheck(
    paymentData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>,
    skipDuplicateCheck: boolean = false
  ): Promise<{
    paymentRecord: PaymentHistoryRecord;
    duplicateCheckResult: DuplicatePaymentDetectionResult | null;
  }> {
    let duplicateCheckResult: DuplicatePaymentDetectionResult | null = null

    // 如果不跳过重复检测，先进行检测
    if (!skipDuplicateCheck) {
      duplicateCheckResult = await this.checkDuplicatePayment(paymentData)
      
      // 如果检测到高严重程度的重复且不允许强制添加，抛出错误
      if (duplicateCheckResult.isDuplicate && 
          duplicateCheckResult.severity === 'high' && 
          !duplicateCheckResult.allowForceAdd) {
        throw new Error(`Duplicate payment detection failed: ${duplicateCheckResult.message}`)
      }
    }

    // 创建支付记录
    const paymentRecord = await this.createPaymentHistory(paymentData)

    return {
      paymentRecord,
      duplicateCheckResult
    }
  }

  /**
   * Update payment record
   */
  async updatePaymentHistory(id: string, updateData: Partial<PaymentHistoryRecord>): Promise<PaymentHistoryRecord> {
    // Convert data format
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
      throw new Error(`Failed to update payment record: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * Delete payment record
   */
  async deletePaymentHistory(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_history')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting payment history:', error)
      throw new Error(`Failed to delete payment record: ${error.message}`)
    }
  }

  /**
   * Get payment history statistics
   * @param subscriptionId Optional subscription ID, if provided, only statistics for that subscription's payment history
   */
  async getPaymentHistoryStats(subscriptionId?: string): Promise<PaymentHistoryStats> {
    let query = supabase
      .from('payment_history')
      .select('amount_paid, currency, status, payment_date')
    
    // If subscription ID is provided, only query payment history for that subscription
    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching payment history stats:', error)
      throw new Error(`Failed to get payment history statistics: ${error.message}`)
    }

    const stats = {
      totalPayments: data.length,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      averageAmount: 0,
      lastPaymentDate: null as string | null
    }

    // Import exchange rate conversion function and exchange rate data
    const { convertCurrency } = await import('@/utils/currency')
    const { currency, exchangeRates } = useSettingsStore.getState()
    
    console.debug('获取到的汇率数据:', exchangeRates)
    
    let totalAmount = 0
    let latestDate: Date | null = null

    data.forEach(payment => {
      // Calculate total amount (only count successful payments)
      if (payment.status === 'success') {
        // Convert payment amount to base currency (CNY) using default exchange rates
        const convertedAmount = convertCurrency(
          payment.amount_paid,
          payment.currency,
          currency,
          exchangeRates
        )
        totalAmount += convertedAmount
      }

      // Count payments by status
      switch (payment.status) {
        case 'success':
          stats.successfulPayments++
          break
        case 'failed':
          stats.failedPayments++
          break
        case 'pending':
          stats.pendingPayments++
          break
      }

      // Find the latest payment date
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
   * Get payment history by date range
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
      throw new Error(`Failed to get payment history by date range: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Get payment history by status
   */
  async getPaymentHistoryByStatus(
    status: 'success' | 'failed' | 'pending'
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
      throw new Error(`Failed to get payment history by status: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Search payment history
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
      throw new Error(`Failed to search payment history: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Bulk create payment records (for data migration or bulk import)
   */
  async bulkCreatePaymentHistory(
    paymentsData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>[]
  ): Promise<PaymentHistoryRecord[]> {
    // Get current user ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser()
    if (!user) {
      throw new Error('User not logged in')
    }

    // Convert data format and add user ID
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
      throw new Error(`Failed to bulk create payment records: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * Get monthly payment statistics
   */
  async getMonthlyPaymentStats(year: number, month: number): Promise<{
    totalPayments: number
    totalAmount: number
    successRate: number
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // End of month date

    const { data, error } = await supabase
      .from('payment_history')
      .select('amount_paid, status')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)

    if (error) {
      console.error('Error fetching monthly payment stats:', error)
      throw new Error(`Failed to get monthly payment statistics: ${error.message}`)
    }

    const totalPayments = data.length
    const successfulPayments = data.filter(p => p.status === 'success').length
    const totalAmount = data
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + p.amount_paid, 0)

    return {
      totalPayments,
      totalAmount: Math.round(totalAmount * 100) / 100,
      successRate: totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100 * 100) / 100 : 0
    }
  }
}

// Export singleton instance
export const supabasePaymentHistoryService = new SupabasePaymentHistoryService()