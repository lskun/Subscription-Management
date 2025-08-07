import React from 'react'
import { AlertTriangle, Clock, DollarSign } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DuplicatePaymentDetectionResult } from '@/services/duplicatePaymentDetectionService'

/**
 * 重复支付确认对话框的属性接口
 */
interface DuplicatePaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: DuplicatePaymentDetectionResult
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DuplicatePaymentConfirmDialog({
  open,
  onOpenChange,
  result,
  onConfirm,
  onCancel
}: DuplicatePaymentConfirmDialogProps) {
  /**
   * 根据严重程度获取风险等级信息
   */
  const getRiskInfo = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
          title: 'High risk duplicate payment',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200'
        }
      case 'medium':
        return {
          icon: <Clock className="h-6 w-6 text-yellow-500" />,
          title: 'Medium risk duplicate payment',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-800 dark:text-yellow-200'
        }
      case 'low':
        return {
          icon: <DollarSign className="h-6 w-6 text-blue-500" />,
          title: 'Low risk duplicate payment',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200'
        }
    }
  }

  const riskInfo = result ? getRiskInfo(result.severity) : null

  /**
   * 处理取消操作
   */
  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  /**
   * 处理确认操作
   */
  const handleConfirm = async () => {
    await onConfirm()
    onOpenChange(false)
  }

  // 如果 result 为空，不渲染对话框
  if (!result || !riskInfo) {
    return null
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {riskInfo.icon}
            <AlertDialogTitle className="text-lg font-semibold">
              {riskInfo.title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* 风险提示卡片 */}
              <div className={`p-4 rounded-lg border ${riskInfo.bgColor} ${riskInfo.borderColor}`}>
                <p className={`text-sm font-medium ${riskInfo.textColor} mb-2`}>
                  {result.message}
                </p>
                <p className={`text-xs ${riskInfo.textColor} opacity-80`}>
                  {result.suggestion}
                </p>
              </div>

              {/* 冲突支付详情 */}
              {result.conflictingPayments && result.conflictingPayments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    发现以下冲突支付记录：
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    {result.conflictingPayments.map((payment, index) => (
                      <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                        • {payment.paymentDate} - ¥{payment.amountPaid}
                        {payment.billingPeriodStart && payment.billingPeriodEnd && (
                          <span className="ml-2 text-gray-500">
                            ({payment.billingPeriodStart} 至 {payment.billingPeriodEnd})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          {result.allowForceAdd && (
            <AlertDialogAction 
              onClick={handleConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              Confirm Add
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}