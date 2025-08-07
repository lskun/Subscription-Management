import { supabase } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'

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
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    // 从缓存中获取
    const cacheKey = useSettingsStore.getState().generateCacheKey('payment_methods', user.id)
    const cachedData = useSettingsStore.getState().getFromGlobalCache<PaymentMethodOption[]>(cacheKey)

    if (cachedData.data) {
      console.info('🎯 使用缓存的支付方式数据: ' + cacheKey)
      return cachedData.data
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .or(`is_default.eq.true,user_id.eq.${user.id}`)
      .order('is_default', { ascending: false }) // 默认支付方式在前
      .order('label', { ascending: true })

    console.info('从数据库获取的支付方式数据:', data)
    if (error) {
      console.error('Error fetching payment methods:', error)
      throw new Error(`Failed to fetch payment methods: ${error.message}`)
    }

    // 缓存数据
    useSettingsStore.getState().setGlobalCache(cacheKey, data)

    return data
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
      throw new Error(`Failed to fetch payment method details: ${error.message}`)
    }

    return data
  }

  /**
   * 创建用户自定义支付方式
   */
  async createPaymentMethod(paymentMethodData: { value: string; label: string }): Promise<PaymentMethodOption> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('User not logged in')
    }

    // 检查是否存在同名的系统默认支付方式
    const { data: existingDefault, error: checkDefaultError } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('value', paymentMethodData.value)
      .eq('is_default', true)
      .maybeSingle()

    if (checkDefaultError) {
      console.error('Error checking default payment method:', checkDefaultError)
      throw new Error(`Failed to check default payment method: ${checkDefaultError.message}`)
    }

    if (existingDefault) {
      throw new Error(`Cannot create payment method: A default payment method with the same name "${existingDefault.label}" already exists.`)
    }

    // 检查是否存在同名的用户自定义支付方式
    const { data: existingUser, error: checkUserError } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('value', paymentMethodData.value)
      .eq('user_id', user.id)
      .eq('is_default', false)
      .maybeSingle()

    if (checkUserError) {
      console.error('Error checking user payment method:', checkUserError)
      throw new Error(`Failed to check user payment method: ${checkUserError.message}`)
    }

    if (existingUser) {
      throw new Error(`Payment method with the same name "${existingUser.label}" already exists.`)
    }

    // 创建新支付方式
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
        throw new Error('Payment method with the same name already exists.')
      }
      throw new Error(`Failed to create payment method: ${error.message}`)
    }

    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('payment_methods', user.id))

    return data
  }

  /**
   * 更新用户自定义支付方式
   */
  async updatePaymentMethod(id: string, updateData: { value?: string; label?: string }): Promise<PaymentMethodOption> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('User not logged in')
    }

    // 如果要更新value，需要检查冲突
    if (updateData.value) {
      // 检查是否存在同名的系统默认支付方式
      const { data: existingDefault, error: checkDefaultError } = await supabase
        .from('payment_methods')
        .select('id, value, label, is_default')
        .eq('value', updateData.value)
        .eq('is_default', true)
        .maybeSingle()

      if (checkDefaultError) {
        console.error('Error checking default payment method:', checkDefaultError)
        throw new Error(`Failed to check default payment method: ${checkDefaultError.message}`)
      }

      if (existingDefault) {
        throw new Error(`Cannot update payment method: A default payment method with the same name "${existingDefault.label}" already exists.`)
      }

      // 检查是否存在同名的其他用户自定义支付方式（排除当前支付方式）
      const { data: existingUser, error: checkUserError } = await supabase
        .from('payment_methods')
        .select('id, value, label, is_default')
        .eq('value', updateData.value)
        .eq('user_id', user.id)
        .eq('is_default', false)
        .neq('id', id) // 排除当前支付方式
        .maybeSingle()

      if (checkUserError) {
        console.error('Error checking user payment method:', checkUserError)
        throw new Error(`Failed to check user payment method: ${checkUserError.message}`)
      }

      if (existingUser) {
        throw new Error(`Payment method with the same name "${existingUser.label}" already exists.`)
      }
    }

    // 执行更新操作
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
        throw new Error('Payment method with the same value already exists.')
      }
      throw new Error(`Failed to update payment method: ${error.message}`)
    }

    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('payment_methods', user.id))

    return data
  }

  /**
   * 删除用户自定义支付方式
   */
  async deletePaymentMethod(id: string): Promise<void> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('User not logged in')
    }

    // 检查是否有订阅使用此支付方式
    const { data: subscriptions, error: checkError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('payment_method_id', id)
      .limit(1)

    if (checkError) {
      console.error('Error checking payment method usage:', checkError)
      throw new Error(`Failed to check payment method usage: ${checkError.message}`)
    }

    if (subscriptions && subscriptions.length > 0) {
      throw new Error('Payment method is currently in use by a subscription and cannot be deleted.')
    }

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('is_default', false) // 只能删除非默认支付方式

    if (error) {
      console.error('Error deleting payment method:', error)
      throw new Error(`Failed to delete payment method: ${error.message}`)
    }

    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('payment_methods', user.id))
  }

  /**
   * 根据value查找支付方式（优先返回用户自定义支付方式，其次是系统默认支付方式）
   */
  async getPaymentMethodByValue(value: string): Promise<PaymentMethodOption | null> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('User not logged in')
    }

    // 首先尝试查找用户自定义支付方式
    const { data: userPaymentMethod, error: userError2 } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('value', value)
      .eq('user_id', user.id)
      .eq('is_default', false)
      .maybeSingle()

    if (userError2) {
      console.error('Error fetching user payment method by value:', userError2)
      throw new Error(`Failed to fetch user payment method by value: ${userError2.message}`)
    }

    if (userPaymentMethod) {
      return userPaymentMethod
    }

    // 如果没有找到用户自定义支付方式，查找系统默认支付方式
    const { data: defaultPaymentMethod, error: defaultError } = await supabase
      .from('payment_methods')
      .select('id, value, label, is_default')
      .eq('value', value)
      .eq('is_default', true)
      .maybeSingle()

    if (defaultError) {
      console.error('Error fetching default payment method by value:', defaultError)
      throw new Error(`Failed to fetch default payment method by value: ${defaultError.message}`)
    }

    return defaultPaymentMethod
  }
}

// 导出单例实例
export const supabasePaymentMethodsService = new SupabasePaymentMethodsService()