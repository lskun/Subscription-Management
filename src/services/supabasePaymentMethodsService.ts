import { supabase } from '@/lib/supabase'

export interface PaymentMethodOption {
  id: string
  value: string
  label: string
  is_default?: boolean
}

/**
 * Supabase支付方式管理服务
 * 提供基于Supabase的支付方式CRUD操作，支持系统默认支付方式和用户自定义支付方式
 */
export class SupabasePaymentMethodsService {
  /**
   * 获取所有可用支付方式（系统默认 + 用户自定义）
   */
  async getAllPaymentMethods(): Promise<PaymentMethodOption[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .order('is_default', { ascending: false }) // 默认支付方式在前
      .order('label', { ascending: true })

    if (error) {
      console.error('Error fetching payment methods:', error)
      throw new Error(`获取支付方式列表失败: ${error.message}`)
    }

    return data || []
  }

  /**
   * 根据ID获取支付方式
   */
  async getPaymentMethodById(id: string): Promise<PaymentMethodOption | null> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('Error fetching payment method:', error)
      throw new Error(`获取支付方式详情失败: ${error.message}`)
    }

    return data
  }

  /**
   * 创建用户自定义支付方式
   */
  async createPaymentMethod(paymentMethodData: { value: string; label: string }): Promise<PaymentMethodOption> {
    // 获取当前用户ID
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('用户未登录')
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: user.id,
        value: paymentMethodData.value,
        label: paymentMethodData.label,
        is_default: false
      })
      .select('id, value, label, is_default')
      .single()

    if (error) {
      console.error('Error creating payment method:', error)
      if (error.code === '23505') {
        throw new Error('该支付方式已存在')
      }
      throw new Error(`创建支付方式失败: ${error.message}`)
    }

    return data
  }

  /**
   * 更新用户自定义支付方式
   */
  async updatePaymentMethod(id: string, updateData: { value?: string; label?: string }): Promise<PaymentMethodOption> {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .eq('is_default', false) // 只能更新非默认支付方式
      .select('id, value, label, is_default')
      .single()

    if (error) {
      console.error('Error updating payment method:', error)
      if (error.code === '23505') {
        throw new Error('该支付方式值已存在')
      }
      throw new Error(`更新支付方式失败: ${error.message}`)
    }

    return data
  }

  /**
   * 删除用户自定义支付方式
   */
  async deletePaymentMethod(id: string): Promise<void> {
    // 检查是否有订阅使用此支付方式
    const { data: subscriptions, error: checkError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('payment_method_id', id)
      .limit(1)

    if (checkError) {
      console.error('Error checking payment method usage:', checkError)
      throw new Error(`检查支付方式使用情况失败: ${checkError.message}`)
    }

    if (subscriptions && subscriptions.length > 0) {
      throw new Error('该支付方式正在被订阅使用，无法删除')
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('is_default', false) // 只能删除非默认支付方式

    if (error) {
      console.error('Error deleting payment method:', error)
      throw new Error(`删除支付方式失败: ${error.message}`)
    }
  }

  /**
   * 根据value查找支付方式
   */
  async getPaymentMethodByValue(value: string): Promise<PaymentMethodOption | null> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('value', value)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('Error fetching payment method by value:', error)
      throw new Error(`根据值获取支付方式失败: ${error.message}`)
    }

    return data
  }
}

// 导出单例实例
export const supabasePaymentMethodsService = new SupabasePaymentMethodsService()