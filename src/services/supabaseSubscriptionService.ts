import { supabase } from '@/lib/supabase'
import { Subscription, BillingCycle, SubscriptionStatus, RenewalType } from '@/store/subscriptionStore'
import { useSettingsStore } from '@/store/settingsStore'
// Supabase数据库字段类型（snake_case）
interface SupabaseSubscription {
  id: string
  user_id: string
  name: string
  plan: string
  billing_cycle: BillingCycle
  next_billing_date: string | null
  last_billing_date: string | null
  amount: number
  currency: string
  converted_amount: number
  payment_method_id: string
  start_date: string | null
  status: SubscriptionStatus
  category_id: string
  renewal_type: RenewalType
  notes: string | null
  website: string | null
  created_at: string
  updated_at: string
  // 关联数据
  categories?: {
    id: string
    value: string
    label: string
  }
  payment_methods?: {
    id: string
    value: string
    label: string
  }
}

// 前端使用的订阅数据类型（camelCase）
interface FrontendSubscription extends Omit<Subscription, 'id' | 'paymentMethodId' | 'categoryId'> {
  id: string
  paymentMethodId: string
  categoryId: string
}

// 创建订阅的输入数据类型
interface CreateSubscriptionInput {
  name: string
  plan: string
  billing_cycle: BillingCycle
  next_billing_date: string
  last_billing_date?: string | null
  amount: number
  currency: string
  payment_method_id: string
  start_date: string
  status: SubscriptionStatus
  category_id: string
  renewal_type: RenewalType
  notes?: string
  website?: string
  user_id?: string
}

/**
 * Supabase订阅管理服务
 * 提供基于Supabase的订阅CRUD操作，支持多租户数据隔离
 */
export class SupabaseSubscriptionService {
  /**
   * 计算上次账单日期
   */
  private calculateLastBillingDate(nextBillingDate: string, billingCycle: BillingCycle): string {
    const nextDate = new Date(nextBillingDate)
    switch (billingCycle) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() - 1)
        break
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() - 1)
        break
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() - 3)
        break
    }
    return nextDate.toISOString().split('T')[0]
  }

  /**
   * 数据转换：从Supabase格式转换为前端格式
   */
  private transformFromSupabase(data: SupabaseSubscription): FrontendSubscription {
    // 如果没有 lastBillingDate，根据 nextBillingDate 和 billingCycle 计算
    //  let lastBillingDate = data.last_billing_date
    //  if (!lastBillingDate && data.next_billing_date) {
    //    lastBillingDate = this.calculateLastBillingDate(data.next_billing_date, data.billing_cycle)
    //  }

    return {
      id: data.id,
      name: data.name,
      plan: data.plan,
      billingCycle: data.billing_cycle,
      nextBillingDate: data.next_billing_date || '',
      lastBillingDate: data.last_billing_date || '',
      amount: data.amount,
      currency: data.currency,
      convertedAmount: data.converted_amount,
      paymentMethodId: data.payment_method_id,
      startDate: data.start_date || '',
      status: data.status,
      categoryId: data.category_id,
      renewalType: data.renewal_type,
      notes: data.notes || '',
      website: data.website || '',
      // 关联数据
      category: data.categories ? {
        id: data.categories.id,
        value: data.categories.value,
        label: data.categories.label
      } : undefined,
      paymentMethod: data.payment_methods ? {
        id: data.payment_methods.id,
        value: data.payment_methods.value,
        label: data.payment_methods.label
      } : undefined
    }
  }

  /**
   * 数据转换：从前端格式转换为Supabase格式
   */
  private transformToSupabase(data: Partial<FrontendSubscription>): Partial<CreateSubscriptionInput> {
    const result: Partial<CreateSubscriptionInput> = {}
    
    if (data.name !== undefined) result.name = data.name
    if (data.plan !== undefined) result.plan = data.plan
    if (data.billingCycle !== undefined) result.billing_cycle = data.billingCycle
    if (data.nextBillingDate !== undefined) result.next_billing_date = data.nextBillingDate
    if (data.lastBillingDate !== undefined) result.last_billing_date = data.lastBillingDate
    if (data.amount !== undefined) result.amount = data.amount
    if (data.currency !== undefined) result.currency = data.currency
    if (data.paymentMethodId !== undefined) result.payment_method_id = data.paymentMethodId
    if (data.startDate !== undefined) result.start_date = data.startDate
    if (data.status !== undefined) result.status = data.status
    if (data.categoryId !== undefined) result.category_id = data.categoryId
    if (data.renewalType !== undefined) result.renewal_type = data.renewalType
    if (data.notes !== undefined) result.notes = data.notes
    if (data.website !== undefined) result.website = data.website
    
    return result
  }

  /**
   * 获取所有订阅（包含关联数据）
   */
  async getAllSubscriptions(): Promise<FrontendSubscription[]> {
    console.log('开始获取订阅数据...')
    
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .order('name', { ascending: true })

    if (error) {
      console.error('获取订阅失败:', error)
      throw new Error(`Failed to fetch subscription list: ${error.message}`)
    }

    console.log(`获取到 ${data?.length || 0} 条订阅数据`)
    const transformedData = (data || []).map(item => this.transformFromSupabase(item))
    console.log('转换后的订阅数据:', transformedData.slice(0, 2)) // 只显示前2条用于调试
    
    return transformedData
  }

  /**
   * 根据ID获取单个订阅
   */
  async getSubscriptionById(id: string): Promise<FrontendSubscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('获取订阅失败:', error)
      throw new Error(`Failed to fetch subscription details: ${error.message}`)
    }

    return data ? this.transformFromSupabase(data) : null
  }

  /**
   * 创建新订阅
   */
  async createSubscription(subscriptionData: Omit<FrontendSubscription, 'id' | 'lastBillingDate'>): Promise<FrontendSubscription> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser()
    if (!user) {
      throw new Error('User not logged in')
    }

    // 转换数据格式
    const supabaseData = this.transformToSupabase(subscriptionData)
    
    console.debug('转换后的订阅数据:', supabaseData)
    // 对于新订阅，last_billing_date 应该为 null，因为还没有发生过计费
    const insertData: CreateSubscriptionInput = {
      ...supabaseData as CreateSubscriptionInput,
      last_billing_date: null, // 新订阅的 last_billing_date 为 null
      user_id: user.id // 自动添加用户ID
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(insertData)
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .single()

    if (error) {
      console.error('创建订阅失败:', error)
      throw new Error(`Failed to create subscription: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * 批量创建订阅
   */
  async bulkCreateSubscriptions(subscriptionsData: Omit<FrontendSubscription, 'id' | 'lastBillingDate'>[]): Promise<FrontendSubscription[]> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser()
    if (!user) {
      throw new Error('User not logged in')
    }

    // 转换数据格式并添加用户ID
    const insertData: CreateSubscriptionInput[] = subscriptionsData.map(sub => {
      const lastBillingDate = this.calculateLastBillingDate(
        sub.nextBillingDate,
        sub.billingCycle
      )
      
      const supabaseData = this.transformToSupabase(sub)
      
      return {
        ...supabaseData as CreateSubscriptionInput,
        last_billing_date: lastBillingDate,
        user_id: user.id
      }
    })

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(insertData)
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)

    if (error) {
      console.error('批量创建订阅失败:', error)
      throw new Error(`Failed to create subscriptions: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 更新订阅
   */
  async updateSubscription(id: string, updateData: Partial<FrontendSubscription>): Promise<FrontendSubscription> {
    // 转换数据格式
    const supabaseData = this.transformToSupabase(updateData)
    
    // 如果更新了计费周期或下次计费日期，重新计算上次计费日期
    if (updateData.billingCycle || updateData.nextBillingDate) {
      // 获取当前订阅数据以获取缺失的字段
      const currentSubscription = await this.getSubscriptionById(id)
      if (!currentSubscription) {
        throw new Error('Subscription not found')
      }
      
      const billingCycle = updateData.billingCycle || currentSubscription.billingCycle
      const nextBillingDate = updateData.nextBillingDate || currentSubscription.nextBillingDate
      
      supabaseData.last_billing_date = this.calculateLastBillingDate(nextBillingDate, billingCycle)
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update(supabaseData)
      .eq('id', id)
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .single()

    if (error) {
      console.error('更新订阅失败:', error)
      throw new Error(`Failed to update subscription: ${error.message}`)
    }

    return this.transformFromSupabase(data)
  }

  /**
   * 删除订阅
   */
  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除订阅失败:', error)
      throw new Error(`Failed to delete subscription: ${error.message}`)
    }
  }

  /**
   * 搜索订阅
   */
  async searchSubscriptions(query: string): Promise<FrontendSubscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .or(`name.ilike.%${query}%,plan.ilike.%${query}%,notes.ilike.%${query}%`)
      .order('name', { ascending: true })

    if (error) {
      console.error('搜索订阅失败:', error)
      throw new Error(`Failed to search subscriptions: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 按状态获取订阅
   */
  async getSubscriptionsByStatus(status: SubscriptionStatus): Promise<FrontendSubscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('status', status)
      .order('name', { ascending: true })

    if (error) {
      console.error('按状态获取订阅失败:', error)
      throw new Error(`Failed to get subscriptions by status: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 按分类获取订阅
   */
  async getSubscriptionsByCategory(categoryId: string): Promise<FrontendSubscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('category_id', categoryId)
      .order('name', { ascending: true })

    if (error) {
      console.error('按分类获取订阅失败:', error)
      throw new Error(`Failed to get subscriptions by category: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 获取即将到期的订阅
   */
  async getUpcomingRenewals(days: number = 7): Promise<FrontendSubscription[]> {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)

    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('status', 'active')
      .gte('next_billing_date', today.toISOString().split('T')[0])
      .lte('next_billing_date', futureDate.toISOString().split('T')[0])
      .order('next_billing_date', { ascending: true })

    if (error) {
      console.error('获取即将到期订阅失败:', error)
      throw new Error(`Failed to get upcoming renewals: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 获取过期的订阅
   */
  async getExpiredSubscriptions(): Promise<FrontendSubscription[]> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        categories (
          id,
          value,
          label
        ),
        payment_methods (
          id,
          value,
          label
        )
      `)
      .eq('status', 'active')
      .lt('next_billing_date', today)
      .order('next_billing_date', { ascending: true })

    if (error) {
      console.error('获取过期订阅失败:', error)
      throw new Error(`Failed to get expired subscriptions: ${error.message}`)
    }

    return (data || []).map(item => this.transformFromSupabase(item))
  }

  /**
   * 获取订阅统计信息
   */
  async getSubscriptionStats(): Promise<{
    total: number
    active: number
    inactive: number
    cancelled: number
    totalActiveAmount: number
    avgActiveAmount: number
  }> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, amount')

    if (error) {
      console.error('获取订阅统计失败:', error)
      throw new Error(`Failed to get subscription stats: ${error.message}`)
    }

    const stats = {
      total: data.length,
      active: 0,
      inactive: 0,
      cancelled: 0,
      totalActiveAmount: 0,
      avgActiveAmount: 0
    }

    let activeAmounts: number[] = []

    data.forEach(sub => {
      switch (sub.status) {
        case 'active':
          stats.active++
          stats.totalActiveAmount += sub.amount
          activeAmounts.push(sub.amount)
          break
        case 'inactive':
          stats.inactive++
          break
        case 'cancelled':
          stats.cancelled++
          break
      }
    })

    stats.avgActiveAmount = activeAmounts.length > 0 
      ? activeAmounts.reduce((sum, amount) => sum + amount, 0) / activeAmounts.length 
      : 0

    return stats
  }

  /**
   * 手动续费订阅
   * 调用数据库函数 process_subscription_renewal 来处理续费逻辑
   */
  async manualRenewSubscription(id: string): Promise<{ error: string | null; renewalData: { newLastBilling: string; newNextBilling: string; } | null; }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'User not authenticated', renewalData: null };
    }

    const { data, error } = await supabase
      .rpc('process_subscription_renewal', {
        p_subscription_id: id,
        p_user_id: user.id
      });

    if (error) {
      console.error('通过RPC续费订阅失败:', error);
      return { error: error.message, renewalData: null };
    }
    
    return { error: null, renewalData: data };
  }

  /**
   * 重置所有订阅数据（仅删除当前用户的数据）
   */
  async resetAllSubscriptions(): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // 删除所有记录（RLS会自动过滤用户数据）

    if (error) {
      console.error('Reset subscriptions failed:', error)
      throw new Error(`Reset subscriptions failed: ${error.message}`)
    }
  }
}

// 导出单例实例
export const supabaseSubscriptionService = new SupabaseSubscriptionService()