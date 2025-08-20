import { supabasePaymentHistoryService, PaymentHistoryRecord } from './supabasePaymentHistoryService'
import { shouldUpdateLastBillingDateWithReason } from '@/lib/subscription-utils'
import { DuplicatePaymentDetectionResult } from './duplicatePaymentDetectionService'
import { BillingCycle } from '@/store/subscriptionStore'
import { addMonths, addQuarters, addYears, isBefore, isEqual } from 'date-fns'

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
 * 自动生成支付记录的订阅信息接口
 */
export interface AutoGenerateSubscriptionInfo {
  id: string
  name: string
  amount: number
  currency: string
  billingCycle: BillingCycle
  startDate: string
  renewalType: 'auto' | 'manual'
  nextBillingDate: string | null
  lastBillingDate: string | null
}

/**
 * 自动生成支付记录的结果接口
 */
export interface AutoGeneratePaymentRecordsResult {
  success: boolean
  generatedCount: number
  paymentRecords: PaymentHistoryRecord[]
  lastBillingDateUpdated: boolean
  newLastBillingDate?: string
  newNextBillingDate?: string
  error?: string
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
            lastBillingDate: billingPeriodStart
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

  /**
   * 自动生成支付记录
   * 基于订阅的开始日期、计费周期和当前日期，自动生成历史支付记录
   * 
   * @param subscription 订阅信息
   * @param updateSubscription 更新订阅函数
   * @returns 生成结果
   */
  static async autoGeneratePaymentRecords(
    subscription: AutoGenerateSubscriptionInfo,
    updateSubscription: (id: string, updates: { lastBillingDate: string; nextBillingDate: string }) => Promise<{ error: any | null }>
  ): Promise<AutoGeneratePaymentRecordsResult> {
    try {
      // 1. 验证输入条件

      const startDate = new Date(subscription.startDate)
      const currentDate = new Date()
      
      if (!isBefore(startDate, currentDate) && !isEqual(startDate, currentDate)) {
        return {
          success: false,
          generatedCount: 0,
          paymentRecords: [],
          lastBillingDateUpdated: false,
          error: 'Subscription start date must be on or before current date'
        }
      }

      // 2. 计算需要生成的支付记录
      const paymentPeriods = this.calculatePaymentPeriods(startDate, currentDate, subscription.billingCycle)
      
      if (paymentPeriods.length === 0) {
        return {
          success: true,
          generatedCount: 0,
          paymentRecords: [],
          lastBillingDateUpdated: false
        }
      }

      // 3. 批量创建支付记录
      const paymentRecords: PaymentHistoryRecord[] = []
      let lastBillingDateUpdated = false
      let newLastBillingDate: string | undefined
      let newNextBillingDate: string | undefined

      for (const period of paymentPeriods) {
        const paymentRecord: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'> = {
          subscriptionId: subscription.id,
          paymentDate: period.billingDate,
          amountPaid: subscription.amount,
          currency: subscription.currency,
          billingPeriodStart: period.periodStart,
          billingPeriodEnd: period.periodEnd,
          status: 'success', // 自动生成的记录默认为成功状态
          notes: 'Auto-generated payment record'
        }

        // 创建支付记录（跳过重复检测，因为是自动生成的）
        const createdRecord = await supabasePaymentHistoryService.createPaymentHistory(paymentRecord)
        paymentRecords.push(createdRecord)
        
        // 记录最新的计费周期开始日期
        newLastBillingDate = period.periodStart
      }

      // 4. 更新订阅的 last_billing_date 和 next_billing_date
      if (newLastBillingDate) {
        try {
          // 计算下一个计费日期
          const lastBillingDate = new Date(newLastBillingDate)
          let nextBillingDate: Date
          
          switch (subscription.billingCycle) {
            case 'monthly':
              nextBillingDate = addMonths(lastBillingDate, 1)
              break
            case 'quarterly':
              nextBillingDate = addQuarters(lastBillingDate, 1)
              break
            case 'yearly':
              nextBillingDate = addYears(lastBillingDate, 1)
              break
            default:
              throw new Error(`Unsupported billing cycle: ${subscription.billingCycle}`)
          }
          
          newNextBillingDate = nextBillingDate.toISOString().split('T')[0]
          
          const updateResult = await updateSubscription(subscription.id, {
            lastBillingDate: newLastBillingDate,
            nextBillingDate: newNextBillingDate
          })
          
          if (!updateResult.error) {
            lastBillingDateUpdated = true
          }
        } catch (error) {
          console.error('Failed to update billing dates after auto-generation:', error)
          // 不抛出错误，因为支付记录已经创建成功
        }
      }

      return {
        success: true,
        generatedCount: paymentRecords.length,
        paymentRecords,
        lastBillingDateUpdated,
        newLastBillingDate,
        newNextBillingDate
      }

    } catch (error) {
      console.error('Auto-generate payment records failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to auto-generate payment records'
      
      return {
        success: false,
        generatedCount: 0,
        paymentRecords: [],
        lastBillingDateUpdated: false,
        error: errorMessage
      }
    }
  }

  /**
   * 计算支付周期
   * 根据开始日期、当前日期和计费周期，计算所有应该发生的支付周期
   * 
   * @param startDate 开始日期
   * @param currentDate 当前日期
   * @param billingCycle 计费周期
   * @returns 支付周期数组
   */
  private static calculatePaymentPeriods(
    startDate: Date, 
    currentDate: Date, 
    billingCycle: BillingCycle
  ): Array<{ billingDate: string; periodStart: string; periodEnd: string }> {
    const periods: Array<{ billingDate: string; periodStart: string; periodEnd: string }> = []
    
    let currentPeriodStart = new Date(startDate)
    
    while (isBefore(currentPeriodStart, currentDate) || isEqual(currentPeriodStart, currentDate)) {
      // 计算当前周期的结束日期
      let currentPeriodEnd: Date
      switch (billingCycle) {
        case 'monthly':
          currentPeriodEnd = addMonths(currentPeriodStart, 1)
          break
        case 'quarterly':
          currentPeriodEnd = addQuarters(currentPeriodStart, 1)
          break
        case 'yearly':
          currentPeriodEnd = addYears(currentPeriodStart, 1)
          break
        default:
          throw new Error(`Unsupported billing cycle: ${billingCycle}`)
      }
      
      // 计费日期通常是周期开始日期
      const billingDate = new Date(currentPeriodStart)
      
      // 周期结束日期减去一天，因为下一个周期从这天开始
      const adjustedPeriodEnd = new Date(currentPeriodEnd)
      adjustedPeriodEnd.setDate(adjustedPeriodEnd.getDate() - 1)
      
      periods.push({
        billingDate: billingDate.toISOString().split('T')[0],
        periodStart: currentPeriodStart.toISOString().split('T')[0],
        periodEnd: adjustedPeriodEnd.toISOString().split('T')[0]
      })
      
      // 移动到下一个周期
      currentPeriodStart = new Date(currentPeriodEnd)
    }
    
    return periods
  }
}