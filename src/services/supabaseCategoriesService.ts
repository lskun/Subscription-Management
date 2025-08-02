import { supabase } from '@/lib/supabase'

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
    const { data, error } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .order('is_default', { ascending: false }) // 默认分类在前
      .order('label', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      throw new Error(`获取分类列表失败: ${error.message}`)
    }

    return data || []
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
  async createCategory(categoryData: { value: string; label: string }): Promise<CategoryOption> {
    // 获取当前用户ID
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('用户未登录')
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        value: categoryData.value,
        label: categoryData.label,
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

    return data
  }

  /**
   * 更新用户自定义分类
   */
  async updateCategory(id: string, updateData: { value?: string; label?: string }): Promise<CategoryOption> {
    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .eq('is_default', false) // 只能更新非默认分类
      .select('id, value, label, is_default')
      .single()

    if (error) {
      console.error('Error updating category:', error)
      if (error.code === '23505') {
        throw new Error('该分类值已存在')
      }
      throw new Error(`更新分类失败: ${error.message}`)
    }

    return data
  }

  /**
   * 删除用户自定义分类
   */
  async deleteCategory(id: string): Promise<void> {
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

    if (subscriptions && subscriptions.length > 0) {
      throw new Error('该分类正在被订阅使用，无法删除')
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('is_default', false) // 只能删除非默认分类

    if (error) {
      console.error('Error deleting category:', error)
      throw new Error(`删除分类失败: ${error.message}`)
    }
  }

  /**
   * 根据value查找分类
   */
  async getCategoryByValue(value: string): Promise<CategoryOption | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('id, value, label, is_default')
      .eq('value', value)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // 记录不存在
      }
      console.error('Error fetching category by value:', error)
      throw new Error(`根据值获取分类失败: ${error.message}`)
    }

    return data
  }
}

// 导出单例实例
export const supabaseCategoriesService = new SupabaseCategoriesService()