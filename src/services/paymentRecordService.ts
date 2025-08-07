import { supabasePaymentHistoryService, PaymentHistoryRecord } from './supabasePaymentHistoryService'
import { shouldUpdateLastBillingDateWithReason } from '@/lib/subscription-utils'
import { DuplicatePaymentDetectionResult } from './duplicatePaymentDetectionService'
import { BillingCycle } from '@/store/subscriptionStore'

/**
 * 支付记录添加的结果接口
 */
export interface PaymentRecordAddResult {
  success: boolean
  paymentRecord?: PaymentHistoryRecord
  duplicateDetectionResult?: DuplicatePaymentDetectionResult
  lastBillingDateUpdated: boolean
  updateReason?: string
  error?: string
}

/**
 * 支付记录添加的参数接口
 */
export interface AddPaymentRecordParams {
  subscriptionId: string
  paymentDate: string
  amountPaid: number
  currency: string
  billingPeriodStart: string
  billingPeriodEnd: string
  status: 'success' | 'failed' | 'pending'
  notes?: string
  skipDuplicateCheck?: boolean
}

/**
 * 统一的支付记录添加服务
 * 包含重复支付检测、last_billing_date更新等完整逻辑
 */
export class PaymentRecordService {
  /**
   * 添加支付记录
   * @param params 支付记录参数
   * @param subscriptions 订阅列表（从组件传入）
   * @returns 添加结果
   */
  static async addPaymentRecord(
    params: AddPaymentRecordParams, 
    subscriptions: Array<{ id: string; name: string; nextBillingDate: string; lastBillingDate: string | null; billingCycle: BillingCycle }>,
    updateSubscription: (id: string, updates: { lastBillingDate: string }) => Promise<{ error: any | null }>
  ): Promise<PaymentRecordAddResult> {
    try {
      const {
        subscriptionId,
        paymentDate,
        amountPaid,
        currency,
        billingPeriodStart,
        billingPeriodEnd,
        status,
        notes,
        skipDuplicateCheck = false
      } = params

      // 1. 获取当前订阅信息
      const currentSubscription = subscriptions.find(sub => sub.id === subscriptionId)
      
      if (!currentSubscription) {
        throw new Error('Subscription does not exist')
      }

      // 2. 构造支付记录数据
      const paymentRecord: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'> = {
        subscriptionId,
        paymentDate,
        amountPaid,
        currency,
        billingPeriodStart,
        billingPeriodEnd,
        status,
        notes: notes || null
      }
      
      let duplicateDetectionResult: DuplicatePaymentDetectionResult | undefined
      
      // 3. 执行重复支付检测（如果未跳过）
      if (!skipDuplicateCheck) {
        duplicateDetectionResult = await supabasePaymentHistoryService.checkDuplicatePayment(paymentRecord)
        
        // 如果检测到高严重程度的重复支付且不允许强制添加，返回检测结果
        if (duplicateDetectionResult.isDuplicate && 
            duplicateDetectionResult.severity === 'high' && 
            !duplicateDetectionResult.allowForceAdd) {
          return {
            success: false,
            duplicateDetectionResult,
            lastBillingDateUpdated: false,
            error: `Duplicate payment detection failed: ${duplicateDetectionResult.message}`
          }
        }
      }
      
      // 4. 创建支付记录
      const createdPaymentRecord = await supabasePaymentHistoryService.createPaymentHistory(paymentRecord)
      
      // 5. 检查是否需要更新 last_billing_date 并获取详细原因
      const updateResult = shouldUpdateLastBillingDateWithReason(
        paymentDate,
        status,
        billingPeriodStart,
        billingPeriodEnd,
        currentSubscription.lastBillingDate,
        currentSubscription.billingCycle
      )
      
      let lastBillingDateUpdated = false
      
      // 6. 如果满足条件，更新订阅的 last_billing_date
      if (updateResult.shouldUpdate) {
        try {
          const updateSubscriptionResult = await updateSubscription(subscriptionId, {
            lastBillingDate: paymentDate
          })
          
          if (!updateSubscriptionResult.error) {
            lastBillingDateUpdated = true
          }
        } catch (error) {
          console.error('Update last_billing_date failed:', error)
          // 不抛出错误，因为支付记录已经创建成功
        }
      }
      
      return {
        success: true,
        paymentRecord: createdPaymentRecord,
        duplicateDetectionResult,
        lastBillingDateUpdated,
        updateReason: updateResult.reason
      }
      
    } catch (error) {
      console.error('Add payment record failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Add payment record failed, please try again.'
      
      return {
        success: false,
        lastBillingDateUpdated: false,
        error: errorMessage
      }
    }
  }

  /**
   * 强制添加支付记录（跳过重复检测）
   * @param params 支付记录参数
   * @param subscriptions 订阅列表（从组件传入）
   * @returns 添加结果
   */
  static async forceAddPaymentRecord(
    params: Omit<AddPaymentRecordParams, 'skipDuplicateCheck'>,
    subscriptions: Array<{ id: string; name: string; nextBillingDate: string; lastBillingDate: string | null; billingCycle: BillingCycle }>,
    updateSubscription: (id: string, updates: { lastBillingDate: string }) => Promise<{ error: any | null }>
  ): Promise<PaymentRecordAddResult> {
    return this.addPaymentRecord({ ...params, skipDuplicateCheck: true }, subscriptions, updateSubscription)
  }

  /**
   * 检测重复支付（不创建记录）
   * @param params 支付记录参数
   * @returns 重复检测结果
   */
  static async checkDuplicatePayment(params: Omit<AddPaymentRecordParams, 'skipDuplicateCheck'>): Promise<DuplicatePaymentDetectionResult> {
    const paymentRecord: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'> = {
      subscriptionId: params.subscriptionId,
      paymentDate: params.paymentDate,
      amountPaid: params.amountPaid,
      currency: params.currency,
      billingPeriodStart: params.billingPeriodStart,
      billingPeriodEnd: params.billingPeriodEnd,
      status: params.status,
      notes: params.notes || null
    }
    
    return await supabasePaymentHistoryService.checkDuplicatePayment(paymentRecord)
  }
}