import { supabase } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'

export interface CategoryOption {
  id: string
  value: string
  label: string
  is_default?: boolean
}

/**
 * Supabase分类管理服务
 * 提供基于Supabase的分类CRUD操作，支持系统默认分类和用户自定义分类
 */
export class SupabaseCategoriesService {
  /**
   * 获取所有可用分类（系统默认 + 用户自定义）
   */
  async getAllCategories(): Promise<CategoryOption[]> {

    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }
    // 从缓存中获取
    const cacheKey = useSettingsStore.getState().generateCacheKey('categories', user.id)
    const cached = useSettingsStore.getState().getFromGlobalCache<CategoryOption[]>(cacheKey)
    
    if (cached.data) {
      console.log('🎯 使用缓存的分类数据: ' + cacheKey)
      return cached.data
    }
    
    if (cached.promise) {
      console.log('⏳ 等待现有的分类获取请求')
      return cached.promise
    }
    

    const { data, error } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .or(`is_default.eq.true,user_id.eq.${user.id}`)
      .order('is_default', { ascending: false }) // 默认分类在前
      .order('label', { ascending: true })
   
    if (error) {
      console.error('Error fetching categories:', error)
      throw new Error(`获取分类列表失败: ${error.message}`)
    }
    // 缓存结果
    useSettingsStore.getState().setGlobalCache(cacheKey, data)
    return data
  }

  /**
   * 根据ID获取分类
   */
  async getCategoryById(id: string): Promise<CategoryOption | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('Error fetching category:', error)
      throw new Error(`获取分类详情失败: ${error.message}`)
    }

    return data
  }

  /**
   * 创建用户自定义分类
   */
  async createCategory(categoryData: { value: string; label?: string }): Promise<CategoryOption> {
    // 获取当前用户ID
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    // 检查是否存在同名的系统默认分类
    const { data: existingDefault, error: checkDefaultError } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('value', categoryData.value)
      .eq('is_default', true)
      .maybeSingle()

    if (checkDefaultError) {
      console.error('Error checking default category:', checkDefaultError)
      throw new Error(`检查默认分类失败: ${checkDefaultError.message}`)
    }

    if (existingDefault) {
      throw new Error(`无法创建分类：已存在同名的系统默认分类 "${existingDefault.label}"`)
    }

    // 检查是否存在同名的用户自定义分类
    const { data: existingUser, error: checkUserError } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('value', categoryData.value)
      .eq('user_id', user.id)
      .eq('is_default', false)
      .maybeSingle()

    if (checkUserError) {
      console.error('Error checking user category:', checkUserError)
      throw new Error(`检查用户分类失败: ${checkUserError.message}`)
    }

    if (existingUser) {
      throw new Error(`该分类已存在：您已经创建了名为 "${existingUser.label}" 的分类`)
    }

    // 创建新分类
    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        value: categoryData.value,
        is_default: false
      })
      .select('id, value, label, is_default')
      .single()

    if (error) {
      console.error('Error creating category:', error)
      if (error.code === '23505') {
        throw new Error('该分类已存在')
      }
      throw new Error(`创建分类失败: ${error.message}`)
    }

    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('categories', user.id))

    return data
  }

  /**
   * 更新用户自定义分类
   * 优化版本：通过一次查询获取所有必要信息，减少数据库访问次数
   */
  async updateCategory(id: string, updateData: { value?: string; label?: string }): Promise<CategoryOption> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    // 通过一次查询获取所有必要信息：当前分类信息 + 冲突检查
    let query = supabase
      .from('categories')
      .select('id, value, label, is_default, user_id')
    
    // 构建查询条件：获取当前分类 + 可能冲突的分类
    if (updateData.value) {
      query = query.or(`id.eq.${id},and(value.eq.${updateData.value},or(is_default.eq.true,and(user_id.eq.${user.id},is_default.eq.false)))`)
    } else {
      query = query.eq('id', id)
    }

    const { data: categories, error: queryError } = await query

    if (queryError) {
      console.error('Error querying categories:', queryError)
      throw new Error(`查询分类失败: ${queryError.message}`)
    }

    // 查找当前要更新的分类
    const currentCategory = categories.find(cat => cat.id === id)
    if (!currentCategory) {
      throw new Error('分类不存在')
    }

    // 检查是否为系统默认分类
    if (currentCategory.is_default) {
      throw new Error('无法编辑系统默认分类')
    }

    // 检查是否为当前用户的分类
    if (currentCategory.user_id !== user.id) {
      throw new Error('无权限编辑此分类')
    }

    // 如果要更新value，检查冲突
    if (updateData.value && updateData.value !== currentCategory.value) {
      // 检查是否存在同名的系统默认分类
      const conflictingDefault = categories.find(cat => 
        cat.value === updateData.value && 
        cat.is_default === true && 
        cat.id !== id
      )
      
      if (conflictingDefault) {
        throw new Error(`无法更新分类：已存在同名的系统默认分类 "${conflictingDefault.value}"`)
      }

      // 检查是否存在同名的其他用户自定义分类
      const conflictingUser = categories.find(cat => 
        cat.value === updateData.value && 
        cat.user_id === user.id && 
        cat.is_default === false && 
        cat.id !== id
      )
      
      if (conflictingUser) {
        throw new Error(`该分类已存在：您已经创建了名为 "${conflictingUser.value}" 的分类`)
      }
    }

    // 执行更新操作
    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select('id, value, label, is_default')
      .single()

    if (error) {
      console.error('Error updating category:', error)
      if (error.code === '23505') {
        throw new Error('该分类值已存在')
      }
      throw new Error(`更新分类失败: ${error.message}`)
    }

    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('categories', user.id))

    return data
  }

  /**
   * 删除用户自定义分类
   */
  async deleteCategory(id: string): Promise<void> {
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    console.log('开始删除分类，ID:', id)
    
    // 检查是否有订阅使用此分类
    const { data: subscriptions, error: checkError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('category_id', id)
      .limit(1)

    if (checkError) {
      console.error('Error checking category usage:', checkError)
      throw new Error(`检查分类使用情况失败: ${checkError.message}`)
    }

    console.log('检查分类使用情况结果:', subscriptions)

    if (subscriptions && subscriptions.length > 0) {
      throw new Error('该分类正在被订阅使用，无法删除')
    }

    console.log('开始执行删除操作...')
    const { error, data } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('is_default', false) // 只能删除非默认分类
      .select() // 添加select来查看删除的记录

    console.log('删除操作结果:', { error, data })

    if (error) {
      console.error('Error deleting category:', error)
      throw new Error(`删除分类失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.warn('没有删除任何记录，可能是因为分类不存在或是系统默认分类')
      throw new Error('删除失败：分类不存在或无权限删除系统默认分类')
    }

    console.log('分类删除成功:', data)
    // 清除缓存
    useSettingsStore.getState().clearGlobalCache(useSettingsStore.getState().generateCacheKey('categories', user.id))
  }

  /**
   * 根据value查找分类（优先返回用户自定义分类，其次是系统默认分类）
   */
  async getCategoryByValue(value: string): Promise<CategoryOption | null> {
    // 获取当前用户ID
    const user = await useSettingsStore.getState().getCurrentUser();
    if (!user) {
      throw new Error('用户未登录')
    }

    // 首先尝试查找用户自定义分类
    const { data: userCategory, error: userError2 } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('value', value)
      .eq('user_id', user.id)
      .eq('is_default', false)
      .maybeSingle()

    if (userError2) {
      console.error('Error fetching user category by value:', userError2)
      throw new Error(`根据值获取用户分类失败: ${userError2.message}`)
    }

    if (userCategory) {
      return userCategory
    }

    // 如果没有找到用户自定义分类，查找系统默认分类
    const { data: defaultCategory, error: defaultError } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('value', value)
      .eq('is_default', true)
      .maybeSingle()

    if (defaultError) {
      console.error('Error fetching default category by value:', defaultError)
      throw new Error(`根据值获取默认分类失败: ${defaultError.message}`)
    }

    return defaultCategory
  }
}

// 导出单例实例
export const supabaseCategoriesService = new SupabaseCategoriesService()