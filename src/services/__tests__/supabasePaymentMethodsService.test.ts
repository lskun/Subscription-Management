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

import { supabasePaymentMethodsService } from '../supabasePaymentMethodsService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as any

describe('SupabasePaymentMethodsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllPaymentMethods', () => {
    it('应该获取所有支付方式', async () => {
      const mockPaymentMethods = [
        { id: '1', value: 'credit_card', label: '信用卡', is_default: true },
        { id: '2', value: 'custom_method', label: '自定义支付方式', is_default: false }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockPaymentMethods, error: null }))
          }))
        }))
      })

      const result = await supabasePaymentMethodsService.getAllPaymentMethods()
      
      expect(result).toEqual(mockPaymentMethods)
      expect(mockSupabase.from).toHaveBeenCalledWith('payment_methods')
    })

    it('应该处理获取支付方式时的错误', async () => {
      const mockError = { message: '数据库连接失败' }
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
          }))
        }))
      })

      await expect(supabasePaymentMethodsService.getAllPaymentMethods()).rejects.toThrow('获取支付方式列表失败: 数据库连接失败')
    })
  })

  describe('createPaymentMethod', () => {
    it('应该创建新的用户自定义支付方式', async () => {
      const newPaymentMethod = { value: 'test_method', label: '测试支付方式' }
      const mockResult = { id: '3', value: 'test_method', label: '测试支付方式', is_default: false }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockResult, error: null }))
          }))
        }))
      })

      const result = await supabasePaymentMethodsService.createPaymentMethod(newPaymentMethod)
      
      expect(result).toEqual(mockResult)
      expect(mockSupabase.from).toHaveBeenCalledWith('payment_methods')
    })

    it('应该处理用户未登录的情况', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(supabasePaymentMethodsService.createPaymentMethod({ value: 'test', label: '测试' }))
        .rejects.toThrow('用户未登录')
    })

    it('应该处理重复支付方式的错误', async () => {
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

      await expect(supabasePaymentMethodsService.createPaymentMethod({ value: 'test', label: '测试' }))
        .rejects.toThrow('该支付方式已存在')
    })
  })

  describe('updatePaymentMethod', () => {
    it('应该更新用户自定义支付方式', async () => {
      const updateData = { value: 'updated_method', label: '更新的支付方式' }
      const mockResult = { id: '3', value: 'updated_method', label: '更新的支付方式', is_default: false }

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

      const result = await supabasePaymentMethodsService.updatePaymentMethod('3', updateData)
      
      expect(result).toEqual(mockResult)
      expect(mockSupabase.from).toHaveBeenCalledWith('payment_methods')
    })
  })

  describe('deletePaymentMethod', () => {
    it('应该删除未被使用的用户自定义支付方式', async () => {
      // Mock 检查支付方式使用情况 - 没有订阅使用此支付方式
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
        if (table === 'payment_methods') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
              }))
            }))
          }
        }
      })

      await expect(supabasePaymentMethodsService.deletePaymentMethod('3')).resolves.not.toThrow()
    })

    it('应该阻止删除正在使用的支付方式', async () => {
      // Mock 检查支付方式使用情况 - 有订阅使用此支付方式
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

      await expect(supabasePaymentMethodsService.deletePaymentMethod('3'))
        .rejects.toThrow('该支付方式正在被订阅使用，无法删除')
    })
  })

  describe('getPaymentMethodByValue', () => {
    it('应该根据value查找支付方式', async () => {
      const mockPaymentMethod = { id: '1', value: 'credit_card', label: '信用卡', is_default: true }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockPaymentMethod, error: null }))
          }))
        }))
      })

      const result = await supabasePaymentMethodsService.getPaymentMethodByValue('credit_card')
      
      expect(result).toEqual(mockPaymentMethod)
      expect(mockSupabase.from).toHaveBeenCalledWith('payment_methods')
    })

    it('应该在支付方式不存在时返回null', async () => {
      const mockError = { code: 'PGRST116', message: 'No rows found' }

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
          }))
        }))
      })

      const result = await supabasePaymentMethodsService.getPaymentMethodByValue('nonexistent')
      
      expect(result).toBeNull()
    })
  })
})