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

import { SupabaseSubscriptionService } from '../supabaseSubscriptionService'
import { supabase } from '@/lib/supabase'

const mockSupabase = supabase as any

describe('SupabaseSubscriptionService', () => {
  let service: SupabaseSubscriptionService
  
  beforeEach(() => {
    service = new SupabaseSubscriptionService()
    vi.clearAllMocks()
  })

  describe('getAllSubscriptions', () => {
    it('should fetch all subscriptions with related data', async () => {
      const mockData = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: 'user-123',
          name: 'Netflix',
          plan: 'Premium',
          billing_cycle: 'monthly',
          next_billing_date: '2024-02-01',
          last_billing_date: '2024-01-01',
          amount: 15.99,
          currency: 'USD',
          payment_method_id: 'pm-123',
          start_date: '2023-01-01',
          status: 'active',
          category_id: 'cat-123',
          renewal_type: 'auto',
          notes: 'Test subscription',
          website: 'https://netflix.com',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          categories: {
            id: 'cat-123',
            value: 'streaming',
            label: '流媒体'
          },
          payment_methods: {
            id: 'pm-123',
            value: 'credit_card',
            label: '信用卡'
          }
        }
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockData,
          error: null
        })
      })

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      })

      const result = await service.getAllSubscriptions()

      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('categories'))
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Netflix',
        plan: 'Premium',
        billingCycle: 'monthly',
        nextBillingDate: '2024-02-01',
        lastBillingDate: '2024-01-01',
        amount: 15.99,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        startDate: '2023-01-01',
        status: 'active',
        categoryId: 'cat-123',
        renewalType: 'auto',
        notes: 'Test subscription',
        website: 'https://netflix.com',
        category: {
          id: 'cat-123',
          value: 'streaming',
          label: '流媒体'
        },
        paymentMethod: {
          id: 'pm-123',
          value: 'credit_card',
          label: '信用卡'
        }
      })
    })

    it('should handle errors gracefully', async () => {
      const mockError = { message: 'Database error' }
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      })

      await expect(service.getAllSubscriptions()).rejects.toThrow('获取订阅列表失败: Database error')
    })
  })

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const mockUser = { id: 'user-123' }
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const mockCreatedSubscription = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: 'user-123',
        name: 'Spotify',
        plan: 'Premium',
        billing_cycle: 'monthly',
        next_billing_date: '2024-02-01',
        last_billing_date: '2024-01-01',
        amount: 9.99,
        currency: 'USD',
        payment_method_id: 'pm-123',
        start_date: '2023-01-01',
        status: 'active',
        category_id: 'cat-123',
        renewal_type: 'auto',
        notes: '',
        website: '',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        categories: null,
        payment_methods: null
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockCreatedSubscription,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      })

      const subscriptionData = {
        name: 'Spotify',
        plan: 'Premium',
        billingCycle: 'monthly' as const,
        nextBillingDate: '2024-02-01',
        amount: 9.99,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        startDate: '2023-01-01',
        status: 'active' as const,
        categoryId: 'cat-123',
        renewalType: 'auto' as const,
        notes: '',
        website: ''
      }

      const result = await service.createSubscription(subscriptionData)

      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
      expect(mockSupabase.from).toHaveBeenCalledWith('subscriptions')
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        name: 'Spotify',
        plan: 'Premium',
        billing_cycle: 'monthly',
        next_billing_date: '2024-02-01',
        last_billing_date: expect.any(String),
        amount: 9.99,
        currency: 'USD',
        payment_method_id: 'pm-123',
        start_date: '2023-01-01',
        status: 'active',
        category_id: 'cat-123',
        renewal_type: 'auto',
        notes: '',
        website: ''
      }))
      
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000')
      expect(result.name).toBe('Spotify')
    })

    it('should throw error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const subscriptionData = {
        name: 'Spotify',
        plan: 'Premium',
        billingCycle: 'monthly' as const,
        nextBillingDate: '2024-02-01',
        amount: 9.99,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        startDate: '2023-01-01',
        status: 'active' as const,
        categoryId: 'cat-123',
        renewalType: 'auto' as const,
        notes: '',
        website: ''
      }

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow('用户未登录')
    })
  })
})