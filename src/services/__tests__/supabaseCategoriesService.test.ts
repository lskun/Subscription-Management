import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      }))
    }
  }
}))

import { supabaseCategoriesService } from '../supabaseCategoriesService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as any

describe('SupabaseCategoriesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllCategories', () => {
    it('应该获取所有分类', async () => {
      const mockCategories = [
        { id: '1', value: 'streaming', label: '流媒体', is_default: true },
        { id: '2', value: 'custom', label: '自定义分类', is_default: false }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockCategories, error: null }))
          }))
        }))
      })

      const result = await supabaseCategoriesService.getAllCategories()
      
      expect(result).toEqual(mockCategories)
      expect(mockSupabase.from).toHaveBeenCalledWith('categories')
    })

    it('应该处理获取分类时的错误', async () => {
      const mockError = { message: '数据库连接失败' }
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
          }))
        }))
      })

      await expect(supabaseCategoriesService.getAllCategories()).rejects.toThrow('获取分类列表失败: 数据库连接失败')
    })
  })

  describe('createCategory', () => {
    it('应该创建新的用户自定义分类', async () => {
      const newCategory = { value: 'test', label: '测试分类' }
      const mockResult = { id: '3', value: 'test', label: '测试分类', is_default: false }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockResult, error: null }))
          }))
        }))
      })

      const result = await supabaseCategoriesService.createCategory(newCategory)
      
      expect(result).toEqual(mockResult)
      expect(mockSupabase.from).toHaveBeenCalledWith('categories')
    })

    it('应该处理用户未登录的情况', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(supabaseCategoriesService.createCategory({ value: 'test', label: '测试' }))
        .rejects.toThrow('用户未登录')
    })

    it('应该处理重复分类的错误', async () => {
      const mockError = { code: '23505', message: 'duplicate key value' }
      
      // 确保用户已登录
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'test-user-id' } }, 
        error: null 
      })
      
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
          }))
        }))
      })

      await expect(supabaseCategoriesService.createCategory({ value: 'test', label: '测试' }))
        .rejects.toThrow('该分类已存在')
    })
  })

  describe('updateCategory', () => {
    it('应该更新用户自定义分类', async () => {
      const updateData = { value: 'updated', label: '更新的分类' }
      const mockResult = { id: '3', value: 'updated', label: '更新的分类', is_default: false }

      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockResult, error: null }))
              }))
            }))
          }))
        }))
      })

      const result = await supabaseCategoriesService.updateCategory('3', updateData)
      
      expect(result).toEqual(mockResult)
      expect(mockSupabase.from).toHaveBeenCalledWith('categories')
    })
  })

  describe('deleteCategory', () => {
    it('应该删除未被使用的用户自定义分类', async () => {
      // Mock 检查分类使用情况 - 没有订阅使用此分类
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }
        }
        if (table === 'categories') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
              }))
            }))
          }
        }
      })

      await expect(supabaseCategoriesService.deleteCategory('3')).resolves.not.toThrow()
    })

    it('应该阻止删除正在使用的分类', async () => {
      // Mock 检查分类使用情况 - 有订阅使用此分类
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'subscriptions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [{ id: 'sub1' }], error: null }))
              }))
            }))
          }
        }
      })

      await expect(supabaseCategoriesService.deleteCategory('3'))
        .rejects.toThrow('该分类正在被订阅使用，无法删除')
    })
  })
})