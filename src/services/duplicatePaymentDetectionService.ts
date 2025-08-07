import { PaymentHistoryRecord } from './supabasePaymentHistoryService';
import { DUPLICATE_PAYMENT_CONFIG } from '@/config/constants';
import { formatWithUserCurrency } from '@/utils/currency';

/**
 * 重复支付检测结果类型
 */
export interface DuplicatePaymentDetectionResult {
  isDuplicate: boolean;
  duplicateType: DuplicatePaymentType | null;
  conflictingPayments: PaymentHistoryRecord[];
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
  allowForceAdd: boolean;
}

/**
 * 重复支付类型枚举
 */
export enum DuplicatePaymentType {
  SAME_BILLING_PERIOD = 'same_billing_period',
  SAME_DATE_AMOUNT = 'same_date_amount',
  SHORT_TIME_INTERVAL = 'short_time_interval',
  OVERLAPPING_BILLING_PERIOD = 'overlapping_billing_period',
  SIMILAR_AMOUNT = 'similar_amount'
}

/**
 * 待检测的支付记录接口
 */
export interface PaymentToCheck {
  subscription_id: string;
  payment_date: string;
  amount_paid: number;
  billing_period_start: string;
  billing_period_end: string;
  status: 'success' | 'failed' | 'pending';
}

/**
 * 重复支付检测服务类
 */
export class DuplicatePaymentDetectionService {
  /**
   * 检测重复支付的主要方法
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有的支付记录列表
   * @returns 检测结果
   */
  static async detectDuplicatePayment(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): Promise<DuplicatePaymentDetectionResult> {
    // 过滤出相关的支付记录（同一订阅）
    const relevantPayments = existingPayments.filter(
      payment => payment.subscriptionId === paymentToCheck.subscription_id
    );

    // 执行各种重复检测
    const detectionResults = [
      this.checkSameBillingPeriod(paymentToCheck, relevantPayments),
      this.checkSameDateAndAmount(paymentToCheck, relevantPayments),
      this.checkShortTimeInterval(paymentToCheck, relevantPayments),
      this.checkOverlappingBillingPeriod(paymentToCheck, relevantPayments),
      this.checkSimilarAmount(paymentToCheck, relevantPayments)
    ];

    // 找到最严重的重复情况
    const duplicateResult = detectionResults.find(result => result.isDuplicate);
    
    if (duplicateResult) {
      return duplicateResult;
    }

    // 没有检测到重复
    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: 'No duplicate payment detected',
      suggestion: 'You can safely add this payment record',
      allowForceAdd: true
    };
  }

  /**
   * 检测同一账单周期内的重复成功支付
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有支付记录
   * @returns 检测结果
   */
  private static checkSameBillingPeriod(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): DuplicatePaymentDetectionResult {
    const conflictingPayments = existingPayments.filter(payment => 
      payment.billingPeriodStart === paymentToCheck.billing_period_start &&
      payment.billingPeriodEnd === paymentToCheck.billing_period_end &&
      payment.status === 'success' &&
      paymentToCheck.status === 'success'
    );

    if (conflictingPayments.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: DuplicatePaymentType.SAME_BILLING_PERIOD,
        conflictingPayments,
        severity: 'high',
        message: `Detected ${conflictingPayments.length} successful payment records in the same billing period`,
        suggestion: 'Typically, only one successful payment record should exist in the same billing period. Please verify if this is a duplicate.',
        allowForceAdd: DUPLICATE_PAYMENT_CONFIG.ALLOW_FORCE_ADD
      };
    }

    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: '',
      suggestion: '',
      allowForceAdd: true
    };
  }

  /**
   * 检测相同日期和金额的支付
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有支付记录
   * @returns 检测结果
   */
  private static checkSameDateAndAmount(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): DuplicatePaymentDetectionResult {
    const conflictingPayments = existingPayments.filter(payment => 
      payment.paymentDate === paymentToCheck.payment_date &&
      Math.abs(payment.amountPaid - paymentToCheck.amount_paid) < 0.01
    );

    if (conflictingPayments.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: DuplicatePaymentType.SAME_DATE_AMOUNT,
        conflictingPayments,
        severity: 'high',
        message: `Detected ${conflictingPayments.length} payment records with the same date and amount`,
        suggestion: 'Same date and amount payments may be duplicate operations, please verify carefully',
        allowForceAdd: DUPLICATE_PAYMENT_CONFIG.ALLOW_FORCE_ADD
      };
    }

    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: '',
      suggestion: '',
      allowForceAdd: true
    };
  }

  /**
   * 检测短时间间隔内的重复支付
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有支付记录
   * @returns 检测结果
   */
  private static checkShortTimeInterval(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): DuplicatePaymentDetectionResult {
    const paymentDate = new Date(paymentToCheck.payment_date);
    const thresholdMinutes = DUPLICATE_PAYMENT_CONFIG.TIME_THRESHOLD_MINUTES;
    
    const conflictingPayments = existingPayments.filter(payment => {
      const existingDate = new Date(payment.paymentDate);
      const timeDiffMinutes = Math.abs(paymentDate.getTime() - existingDate.getTime()) / (1000 * 60);
      return timeDiffMinutes <= thresholdMinutes;
    });

    if (conflictingPayments.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: DuplicatePaymentType.SHORT_TIME_INTERVAL,
        conflictingPayments,
        severity: 'medium',
        message: `Detected ${conflictingPayments.length} payment records within ${thresholdMinutes} minutes`,
        suggestion: 'Short time interval payments may be duplicate operations, please verify carefully',
        allowForceAdd: DUPLICATE_PAYMENT_CONFIG.ALLOW_FORCE_ADD
      };
    }

    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: '',
      suggestion: '',
      allowForceAdd: true
    };
  }

  /**
   * 检测账单周期重叠的支付
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有支付记录
   * @returns 检测结果
   */
  private static checkOverlappingBillingPeriod(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): DuplicatePaymentDetectionResult {
    const newStart = new Date(paymentToCheck.billing_period_start);
    const newEnd = new Date(paymentToCheck.billing_period_end);
    
    const conflictingPayments = existingPayments.filter(payment => {
      const existingStart = new Date(payment.billingPeriodStart);
      const existingEnd = new Date(payment.billingPeriodEnd);
      
      // 检测账单周期是否重叠
      return (
        (newStart <= existingEnd && newEnd >= existingStart) &&
        !(newStart.getTime() === existingStart.getTime() && newEnd.getTime() === existingEnd.getTime())
      );
    });

    if (conflictingPayments.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: DuplicatePaymentType.OVERLAPPING_BILLING_PERIOD,
        conflictingPayments,
        severity: 'medium',
        message: `Detected ${conflictingPayments.length} payment records with overlapping billing periods`,
        suggestion: 'Overlapping billing periods may indicate a change in subscription plan, please verify carefully',
        allowForceAdd: DUPLICATE_PAYMENT_CONFIG.ALLOW_FORCE_ADD
      };
    }

    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: '',
      suggestion: '',
      allowForceAdd: true
    };
  }

  /**
   * 检测金额相近的支付
   * @param paymentToCheck 待检测的支付记录
   * @param existingPayments 现有支付记录
   * @returns 检测结果
   */
  private static checkSimilarAmount(
    paymentToCheck: PaymentToCheck,
    existingPayments: PaymentHistoryRecord[]
  ): DuplicatePaymentDetectionResult {
    const threshold = DUPLICATE_PAYMENT_CONFIG.AMOUNT_SIMILARITY_THRESHOLD;
    
    const conflictingPayments = existingPayments.filter(payment => {
      const similarity = Math.min(payment.amountPaid, paymentToCheck.amount_paid) / 
                        Math.max(payment.amountPaid, paymentToCheck.amount_paid);
      return similarity >= threshold && Math.abs(payment.amountPaid - paymentToCheck.amount_paid) > 0.01;
    });

    if (conflictingPayments.length > 0) {
      return {
        isDuplicate: true,
        duplicateType: DuplicatePaymentType.SIMILAR_AMOUNT,
        conflictingPayments,
        severity: 'low',
        message: `Detected ${conflictingPayments.length} payment records with similar amount`,
        suggestion: 'Similar amount payments may be duplicate operations, please verify carefully',
        allowForceAdd: DUPLICATE_PAYMENT_CONFIG.ALLOW_FORCE_ADD
      };
    }

    return {
      isDuplicate: false,
      duplicateType: null,
      conflictingPayments: [],
      severity: 'low',
      message: '',
      suggestion: '',
      allowForceAdd: true
    };
  }

  /**
   * 格式化冲突支付记录的显示信息
   * @param payments 冲突的支付记录
   * @returns 格式化的显示信息
   */
  static formatConflictingPayments(payments: PaymentHistoryRecord[]): string {
    return payments.map(payment => 
      `${payment.paymentDate} - ${formatWithUserCurrency(payment.amountPaid, payment.currency)} (${payment.status})`
    ).join('\n');
  }

  /**
   * 获取严重程度的显示颜色
   * @param severity 严重程度
   * @returns CSS颜色类名
   */
  static getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
    switch (severity) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  }
}