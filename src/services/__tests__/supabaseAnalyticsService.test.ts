import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}))

// Mock currency conversion
vi.mock('@/utils/currency', () => ({
  convertCurrency: vi.fn((amount, from, to) => amount) // 简单返回原金额用于测试
}))

import { SupabaseAnalyticsService } from '../supabaseAnalyticsService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as any

describe('SupabaseAnalyticsService', () => {
  let service: SupabaseAnalyticsService
  
  beforeEach(() => {
    service = new SupabaseAnalyticsService()
    vi.clearAllMocks()
  })

  describe('getMonthlyExpenses', () => {
    it('should calculate monthly expenses correctly', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          name: 'Netflix',
          amount: 15.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          start_date: '2024-01-01',
          next_billing_date: '2024-03-01',
          status: 'active',
          categories: {
            value: 'streaming',
            label: '流媒体'
          }
        },
        {
          id: 'sub-2',
          name: 'Spotify',
          amount: 119.88,
          currency: 'USD',
          billing_cycle: 'yearly',
          start_date: '2024-01-15',
          next_billing_date: '2025-01-15',
          status: 'active',
          categories: {
            value: 'music',
            label: '音乐'
          }
        }
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: mockSubscriptions,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-02-29')
      const result = await service.getMonthlyExpenses(startDate, endDate, 'USD')

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
      
      // 验证结果格式
      if (result.length > 0) {
        const firstResult = result[0]
        expect(firstResult).toHaveProperty('monthKey')
        expect(firstResult).toHaveProperty('month')
        expect(firstResult).toHaveProperty('year')
        expect(firstResult).toHaveProperty('amount')
        expect(firstResult).toHaveProperty('subscriptionCount')
      }
    })

    it('should handle errors gracefully', async () => {
      const mockError = { message: 'Database error' }
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        })
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-02-29')

      await expect(service.getMonthlyExpenses(startDate, endDate, 'USD'))
        .rejects.toThrow('获取月度费用数据失败: Database error')
    })
  })

  describe('getCategoryExpenses', () => {
    it('should calculate category expenses correctly', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          name: 'Netflix',
          amount: 15.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          status: 'active',
          categories: {
            value: 'streaming',
            label: '流媒体'
          }
        },
        {
          id: 'sub-2',
          name: 'Spotify',
          amount: 9.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          status: 'active',
          categories: {
            value: 'music',
            label: '音乐'
          }
        }
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockSubscriptions,
          error: null
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')
      const result = await service.getCategoryExpenses(startDate, endDate, 'USD')

      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBe(2) // 两个不同的分类

      // 验证结果格式
      result.forEach(category => {
        expect(category).toHaveProperty('category')
        expect(category).toHaveProperty('amount')
        expect(category).toHaveProperty('percentage')
        expect(category).toHaveProperty('subscriptionCount')
        expect(category.percentage).toBeGreaterThan(0)
        expect(category.percentage).toBeLessThanOrEqual(100)
      })

      // 验证百分比总和为100%
      const totalPercentage = result.reduce((sum, cat) => sum + cat.percentage, 0)
      expect(Math.round(totalPercentage)).toBe(100)
    })
  })

  describe('getCurrentMonthSpending', () => {
    it('should return current month spending', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          name: 'Netflix',
          amount: 15.99,
          currency: 'USD',
          billing_cycle: 'monthly',
          start_date: '2024-01-01',
          next_billing_date: '2024-03-01',
          status: 'active',
          categories: {
            value: 'streaming',
            label: '流媒体'
          }
        }
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              data: mockSubscriptions,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await service.getCurrentMonthSpending('USD')

      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getSubscriptionStatusStats', () => {
    it('should return subscription status statistics', async () => {
      const mockSubscriptions = [
        { status: 'active' },
        { status: 'active' },
        { status: 'inactive' },
        { status: 'cancelled' }
      ]

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockSubscriptions,
        error: null
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await service.getSubscriptionStatusStats()

      expect(result).toEqual({
        active: 2,
        inactive: 1,
        cancelled: 1,
        total: 4
      })
    })
  })
})