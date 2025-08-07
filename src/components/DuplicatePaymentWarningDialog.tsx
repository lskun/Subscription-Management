import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, DollarSign, Calendar } from 'lucide-react'
import { DuplicatePaymentDetectionResult, DuplicatePaymentType } from '@/services/duplicatePaymentDetectionService'
import { PaymentHistoryRecord } from '@/services/supabasePaymentHistoryService'
import { formatWithUserCurrency } from '@/utils/currency'

interface DuplicatePaymentWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detectionResult: DuplicatePaymentDetectionResult
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

/**
 * 重复支付警告对话框组件
 * 用于显示重复支付检测结果并让用户选择是否继续
 */
export function DuplicatePaymentWarningDialog({
  open,
  onOpenChange,
  detectionResult,
  onConfirm,
  onCancel,
  loading = false
}: DuplicatePaymentWarningDialogProps) {
  /**
   * 获取严重程度对应的颜色
   */
  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  /**
   * 获取重复类型的显示文本
   */
  const getDuplicateTypeText = (type: DuplicatePaymentType) => {
    switch (type) {
      case 'same_billing_period':
        return 'Same billing period'
      case 'same_date_amount':
        return 'Same date and amount'
      case 'short_time_interval':
        return 'Short time interval'
      case 'overlapping_billing_period':
        return 'Overlapping billing period'
      case 'similar_amount':
        return 'Similar amount'
      default:
        return 'Unknown type'
    }
  }

  /**
   * 获取重复类型的图标
   */
  const getDuplicateTypeIcon = (type: DuplicatePaymentType) => {
    switch (type) {
      case 'same_billing_period':
      case 'overlapping_billing_period':
        return <Calendar className="h-4 w-4" />
      case 'same_date_amount':
      case 'similar_amount':
        return <DollarSign className="h-4 w-4" />
      case 'short_time_interval':
        return <Clock className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  /**
   * 格式化支付记录显示
   */
  const formatPaymentRecord = (payment: PaymentHistoryRecord) => {
    return {
      date: new Date(payment.paymentDate).toLocaleDateString('zh-CN'),
      amount: formatWithUserCurrency(payment.amountPaid, payment.currency),
      period: `${new Date(payment.billingPeriodStart).toLocaleDateString('zh-CN')} - ${new Date(payment.billingPeriodEnd).toLocaleDateString('zh-CN')}`,
      status: payment.status
    }
  }

  /**
   * 获取状态显示文本
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Success'
      case 'failed':
        return 'Failed'
      case 'pending':
        return 'Pending'
      default:
        return status
    }
  }

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Detected possible duplicate payment
          </DialogTitle>
          <DialogDescription>
            The system has detected that the payment record you are about to create may be a duplicate of existing records. Please carefully review the following information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 检测结果概览 */}
          <Alert className={getSeverityColor(detectionResult.severity)}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {detectionResult.message}
            </AlertDescription>
          </Alert>

          {/* 严重程度和检测类型 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Severity:</span>
              <Badge className={getSeverityColor(detectionResult.severity)}>
                {detectionResult.severity === 'low' && 'Low'}
                {detectionResult.severity === 'medium' && 'Medium'}
                {detectionResult.severity === 'high' && 'High'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Detection type:</span>
              <div className="flex items-center gap-1">
                {getDuplicateTypeIcon(detectionResult.duplicateType)}
                <span className="text-sm">{getDuplicateTypeText(detectionResult.duplicateType)}</span>
              </div>
            </div>
          </div>

          {/* 冲突的支付记录 */}
          {detectionResult.conflictingPayments && detectionResult.conflictingPayments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Conflicting payment records:</h4>
              <div className="space-y-2">
                {detectionResult.conflictingPayments.map((payment, index) => {
                  const formatted = formatPaymentRecord(payment)
                  return (
                    <div key={payment.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Record #{index + 1}
                        </span>
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusText(payment.status)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Payment date:</span> {formatted.date}
                        </div>
                        <div>
                          <span className="font-medium">Payment amount:</span> {formatted.amount}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Billing period:</span> {formatted.period}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 建议信息 */}
          {detectionResult.suggestion && (
            <Alert>
              <AlertDescription>
                <strong>Suggestion:</strong> {detectionResult.suggestion}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {detectionResult.allowForceAdd && (
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="w-full sm:w-auto"
              variant={detectionResult.severity === 'high' ? 'destructive' : 'default'}
            >
              {loading ? 'Processing...' : 'Add anyway'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}