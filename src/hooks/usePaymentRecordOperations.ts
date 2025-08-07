import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { PaymentRecordService, AddPaymentRecordParams, PaymentRecordAddResult } from '@/services/paymentRecordService'
import { DuplicatePaymentDetectionResult } from '@/services/duplicatePaymentDetectionService'
import { useSubscriptionStore } from '@/store/subscriptionStore'

/**
 * 支付记录操作的状态接口
 */
interface PaymentRecordOperationState {
  isLoading: boolean
  duplicateDetectionResult: DuplicatePaymentDetectionResult | null
  pendingPaymentData: AddPaymentRecordParams | null
  showDuplicateWarning: boolean
}

/**
 * 支付记录操作的回调接口
 */
interface PaymentRecordOperationCallbacks {
  onSuccess?: (result: PaymentRecordAddResult) => void
  onError?: (error: string) => void
  onDuplicateDetected?: (result: DuplicatePaymentDetectionResult, pendingData: AddPaymentRecordParams) => void
}

/**
 * 统一的支付记录操作Hook
 * 包含重复检测、用户确认、错误处理等完整逻辑
 */
export const usePaymentRecordOperations = (callbacks?: PaymentRecordOperationCallbacks) => {
  const { toast } = useToast()
  const { subscriptions, updateSubscription, fetchSubscriptions } = useSubscriptionStore()
  
  const [state, setState] = useState<PaymentRecordOperationState>({
    isLoading: false,
    duplicateDetectionResult: null,
    pendingPaymentData: null,
    showDuplicateWarning: false
  })

  /**
   * 重置状态
   */
  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      duplicateDetectionResult: null,
      pendingPaymentData: null,
      showDuplicateWarning: false
    })
  }, [])

  /**
   * 添加支付记录
   * @param params 支付记录参数
   */
  const addPaymentRecord = useCallback(async (params: AddPaymentRecordParams) => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      // 确保订阅数据已加载
      let currentSubscriptions = subscriptions
      if (currentSubscriptions.length === 0) {
        // fetchSubscriptions 现在返回最新的订阅数据
        currentSubscriptions = await fetchSubscriptions()
      }
      
      // 使用最新的订阅数据
      const result = await PaymentRecordService.addPaymentRecord(params, currentSubscriptions, updateSubscription)
      
      if (result.success) {
        // 成功添加支付记录
        let description = 'Payment record created successfully'
        
        if (result.lastBillingDateUpdated) {
          description += ', last billing date updated'
        }
        
        if (result.duplicateDetectionResult?.isDuplicate) {
          description += ', duplicate payment warning ignored'
        }
        
        toast({
          title: "Payment record added",
          description,
          variant: "default"
        })
        
        resetState()
        callbacks?.onSuccess?.(result)
        
      } else if (result.duplicateDetectionResult?.isDuplicate) {
        // 检测到重复支付，需要用户确认
        setState(prev => ({
          ...prev,
          isLoading: false,
          duplicateDetectionResult: result.duplicateDetectionResult!,
          pendingPaymentData: params,
          showDuplicateWarning: true
        }))
        
        callbacks?.onDuplicateDetected?.(result.duplicateDetectionResult!, params)
        
      } else {
        // 其他错误
        throw new Error(result.error || 'Add payment record failed')
      }
      
    } catch (error) {
      console.error('Add payment record failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Add payment record failed, please try again.'
      
      toast({
        title: "Add payment record failed",
        description: errorMessage,
        variant: "destructive"
      })
      
      setState(prev => ({ ...prev, isLoading: false }))
      callbacks?.onError?.(errorMessage)
    }
  }, [toast, callbacks, resetState, subscriptions, updateSubscription])

  /**
   * 确认添加重复支付记录
   */
  const confirmDuplicatePayment = useCallback(async () => {
    if (!state.pendingPaymentData) return
    
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const result = await PaymentRecordService.forceAddPaymentRecord(state.pendingPaymentData, subscriptions, updateSubscription)
      
      if (result.success) {
        let description = 'Duplicate payment warning ignored, payment record created successfully'
        
        if (result.lastBillingDateUpdated) {
          description += ', last billing date updated'
        }
        
        toast({
          title: "Payment record added",
          description,
          variant: "default"
        })
        
        resetState()
        callbacks?.onSuccess?.(result)
        
      } else {
        throw new Error(result.error || 'Force add payment record failed')
      }
      
    } catch (error) {
      console.error('Force add payment record failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Force add payment record failed, please try again.'
      
      toast({
        title: "Force add payment record failed",
        description: errorMessage,
        variant: "destructive"
      })
      
      setState(prev => ({ ...prev, isLoading: false }))
      callbacks?.onError?.(errorMessage)
    }
  }, [state.pendingPaymentData, toast, callbacks, resetState, subscriptions, updateSubscription])

  /**
   * 取消重复支付确认
   */
  const cancelDuplicatePayment = useCallback(() => {
    resetState()
  }, [resetState])

  /**
   * 检测重复支付（不创建记录）
   * @param params 支付记录参数
   */
  const checkDuplicatePayment = useCallback(async (params: Omit<AddPaymentRecordParams, 'skipDuplicateCheck'>) => {
    try {
      return await PaymentRecordService.checkDuplicatePayment(params)
    } catch (error) {
      console.error('Check duplicate payment failed:', error)
      throw error
    }
  }, [])

  return {
    // 状态
    isLoading: state.isLoading,
    duplicateDetectionResult: state.duplicateDetectionResult,
    pendingPaymentData: state.pendingPaymentData,
    showDuplicateWarning: state.showDuplicateWarning,
    
    // 操作方法
    addPaymentRecord,
    confirmDuplicatePayment,
    cancelDuplicatePayment,
    checkDuplicatePayment,
    resetState
  }
}