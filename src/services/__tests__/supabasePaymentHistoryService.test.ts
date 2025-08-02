import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { supabasePaymentHistoryService, PaymentHistoryRecord } from '../supabasePaymentHistoryService'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}))

describe('SupabasePaymentHistoryService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  }

  const mockPaymentHistory: PaymentHistoryRecord = {
    id: 'payment-1',
    userId: 'test-user-id',
    subscriptionId: 'subscription-1',
    paymentDate: '2024-01-15',
    amountPaid: 9.99,
    currency: 'USD',
    billingPeriodStart: '2024-01-01',
    billingPeriodEnd: '2024-01-31',
    status: 'succeeded',
    notes: 'Test payment',
    createdAt: '2024-01-15T10:00:00Z',
    subscription: {
      id: 'subscription-1',
      name: 'Netflix'
    }
  }

  const mockSupabasePaymentHistory = {
    id: 'payment-1',
    user_id: 'test-user-id',
    subscription_id: 'subscription-1',
    payment_date: '2024-01-15',
    amount_paid: 9.99,
    currency: 'USD',
    billing_period_start: '2024-01-01',
    billing_period_end: '2024-01-31',
    status: 'succeeded',
    notes: 'Test payment',
    created_at: '2024-01-15T10:00:00Z',
    subscriptions: {
      id: 'subscription-1',
      name: 'Netflix'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock auth.getUser
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAllPaymentHistory', () => {
    it('should fetch all payment history records', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: [mockSupabasePaymentHistory],
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder
      } as any)

      mockSelect.mockReturnValue({
        order: mockOrder
      })

      const result = await supabasePaymentHistoryService.getAllPaymentHistory()

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockSelect).toHaveBeenCalledWith(`
        *,
        subscriptions (
          id,
          name
        )
      `)
      expect(mockOrder).toHaveBeenCalledWith('payment_date', { ascending: false })
      expect(result).toEqual([mockPaymentHistory])
    })

    it('should handle errors when fetching payment history', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        order: mockOrder
      } as any)

      mockSelect.mockReturnValue({
        order: mockOrder
      })

      await expect(supabasePaymentHistoryService.getAllPaymentHistory())
        .rejects.toThrow('获取支付历史失败: Database error')
    })
  })

  describe('getPaymentHistoryBySubscription', () => {
    it('should fetch payment history for a specific subscription', async () => {
      const subscriptionId = 'subscription-1'
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: [mockSupabasePaymentHistory],
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder
      } as any)

      mockSelect.mockReturnValue({
        eq: mockEq
      })
      mockEq.mockReturnValue({
        order: mockOrder
      })

      const result = await supabasePaymentHistoryService.getPaymentHistoryBySubscription(subscriptionId)

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockEq).toHaveBeenCalledWith('subscription_id', subscriptionId)
      expect(result).toEqual([mockPaymentHistory])
    })
  })

  describe('createPaymentHistory', () => {
    it('should create a new payment history record', async () => {
      const paymentData = {
        subscriptionId: 'subscription-1',
        paymentDate: '2024-01-15',
        amountPaid: 9.99,
        currency: 'USD',
        billingPeriodStart: '2024-01-01',
        billingPeriodEnd: '2024-01-31',
        status: 'succeeded' as const,
        notes: 'Test payment'
      }

      const mockInsert = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockSupabasePaymentHistory,
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle
      } as any)

      mockInsert.mockReturnValue({
        select: mockSelect
      })
      mockSelect.mockReturnValue({
        single: mockSingle
      })

      const result = await supabasePaymentHistoryService.createPaymentHistory(paymentData)

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockInsert).toHaveBeenCalledWith({
        subscription_id: 'subscription-1',
        payment_date: '2024-01-15',
        amount_paid: 9.99,
        currency: 'USD',
        billing_period_start: '2024-01-01',
        billing_period_end: '2024-01-31',
        status: 'succeeded',
        notes: 'Test payment',
        user_id: 'test-user-id'
      })
      expect(result).toEqual(mockPaymentHistory)
    })

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      })

      const paymentData = {
        subscriptionId: 'subscription-1',
        paymentDate: '2024-01-15',
        amountPaid: 9.99,
        currency: 'USD',
        billingPeriodStart: '2024-01-01',
        billingPeriodEnd: '2024-01-31',
        status: 'succeeded' as const
      }

      await expect(supabasePaymentHistoryService.createPaymentHistory(paymentData))
        .rejects.toThrow('用户未登录')
    })
  })

  describe('updatePaymentHistory', () => {
    it('should update a payment history record', async () => {
      const paymentId = 'payment-1'
      const updateData = {
        status: 'refunded' as const,
        notes: 'Refunded payment'
      }

      const mockUpdate = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...mockSupabasePaymentHistory, status: 'refunded', notes: 'Refunded payment' },
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        select: mockSelect,
        single: mockSingle
      } as any)

      mockUpdate.mockReturnValue({
        eq: mockEq
      })
      mockEq.mockReturnValue({
        select: mockSelect
      })
      mockSelect.mockReturnValue({
        single: mockSingle
      })

      const result = await supabasePaymentHistoryService.updatePaymentHistory(paymentId, updateData)

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'refunded',
        notes: 'Refunded payment'
      })
      expect(mockEq).toHaveBeenCalledWith('id', paymentId)
      expect(result.status).toBe('refunded')
      expect(result.notes).toBe('Refunded payment')
    })
  })

  describe('deletePaymentHistory', () => {
    it('should delete a payment history record', async () => {
      const paymentId = 'payment-1'

      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockResolvedValue({
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
        eq: mockEq
      } as any)

      mockDelete.mockReturnValue({
        eq: mockEq
      })

      await supabasePaymentHistoryService.deletePaymentHistory(paymentId)

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', paymentId)
    })
  })

  describe('getPaymentHistoryStats', () => {
    it('should calculate payment history statistics', async () => {
      const mockPayments = [
        { amount_paid: 10.00, status: 'succeeded', payment_date: '2024-01-15' },
        { amount_paid: 15.00, status: 'succeeded', payment_date: '2024-01-20' },
        { amount_paid: 5.00, status: 'failed', payment_date: '2024-01-10' },
        { amount_paid: 8.00, status: 'refunded', payment_date: '2024-01-25' }
      ]

      const mockSelect = vi.fn().mockResolvedValue({
        data: mockPayments,
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await supabasePaymentHistoryService.getPaymentHistoryStats()

      expect(result).toEqual({
        totalPayments: 4,
        totalAmount: 25.00,
        successfulPayments: 2,
        failedPayments: 1,
        refundedPayments: 1,
        averageAmount: 12.50,
        lastPaymentDate: '2024-01-25'
      })
    })
  })

  describe('searchPaymentHistory', () => {
    it('should search payment history records', async () => {
      const query = 'Netflix'

      const mockSelect = vi.fn().mockReturnThis()
      const mockOr = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: [mockSupabasePaymentHistory],
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        or: mockOr,
        order: mockOrder
      } as any)

      mockSelect.mockReturnValue({
        or: mockOr
      })
      mockOr.mockReturnValue({
        order: mockOrder
      })

      const result = await supabasePaymentHistoryService.searchPaymentHistory(query)

      expect(supabase.from).toHaveBeenCalledWith('payment_history')
      expect(mockOr).toHaveBeenCalledWith(`notes.ilike.%${query}%,subscriptions.name.ilike.%${query}%`)
      expect(result).toEqual([mockPaymentHistory])
    })
  })
})