import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, CreditCard, FileText, Eye, Clock, Sparkles, Calendar, Loader2 } from "lucide-react"
import { Subscription } from "@/store/subscriptionStore"
import { formatWithUserCurrency } from "@/utils/currency"
import { format } from "date-fns"
import { useState } from "react"

interface SubscriptionSuccessDialogProps {
  subscription: Subscription
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPayment: () => void
  onImportPayments: () => void
  onViewDetails: () => void
  onAutoGeneratePayments?: () => void
  isAutoGenerating?: boolean
}

/**
 * Subscription creation success dialog component
 * Displays detailed information of newly created subscription and provides follow-up action options
 */
export function SubscriptionSuccessDialog({
  subscription,
  open,
  onOpenChange,
  onAddPayment,
  onImportPayments,
  onViewDetails,
  onAutoGeneratePayments,
  isAutoGenerating = false
}: SubscriptionSuccessDialogProps) {
  // 内部loading状态，用于控制按钮状态和界面显示
  const [internalLoading, setInternalLoading] = useState(false)
  /**
   * Get status display style
   */
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'cancelled':
        return 'secondary'
      case 'expired':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  /**
   * Get status display text
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'cancelled':
        return 'Cancelled'
      case 'expired':
        return 'Expired'
      default:
        return status
    }
  }

  /**
   * Get billing cycle display text
   */
  const getBillingCycleText = (cycle: string) => {
    switch (cycle) {
      case 'monthly':
        return 'Monthly'
      case 'quarterly':
        return 'Quarterly'
      case 'yearly':
        return 'Yearly'
      default:
        return cycle
    }
  }

  /**
   * 判断是否应该显示自动生成支付记录选项
   * 只要开始时间<=当天，无论订阅类型都应该显示智能引导
   */
  const shouldShowAutoGeneration = () => {
    return new Date(subscription.startDate) <= new Date()
  }

  /**
   * 计算预估的支付记录数量
   */
  const calculateEstimatedRecords = () => {
    if (!shouldShowAutoGeneration()) return 0
    
    const startDate = new Date(subscription.startDate)
    const currentDate = new Date()
    const monthsDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    
    switch (subscription.billingCycle) {
      case 'monthly':
        return Math.max(1, monthsDiff + 1)
      case 'quarterly':
        return Math.max(1, Math.floor(monthsDiff / 3) + 1)
      case 'yearly':
        return Math.max(1, Math.floor(monthsDiff / 12) + 1)
      default:
        return 1
    }
  }

  /**
   * Handle later button click
   */
  const handleLater = () => {
    onOpenChange(false)
  }

  /**
   * Handle auto generate payments
   */
  const handleAutoGenerate = async () => {
    if (onAutoGeneratePayments) {
      // 设置内部loading状态
      setInternalLoading(true)
      try {
        await onAutoGeneratePayments()
      } finally {
        // 注意：这里不直接清除loading状态，因为父组件可能需要关闭对话框
        // loading状态会在组件重新渲染或对话框关闭时自然重置
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Loading遮罩层 */}
        {(internalLoading || isAutoGenerating) && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Generating Payment Records</p>
                <p className="text-xs text-muted-foreground">
                  Creating payment history for {subscription.name}...
                </p>
              </div>
            </div>
          </div>
        )}
        
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Subscription Created Successfully!</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your subscription has been successfully added to the system
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Subscription Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{subscription.name}</h3>
              <Badge variant={getStatusVariant(subscription.status)}>
                {getStatusText(subscription.status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-medium ml-1">
                  {formatWithUserCurrency(subscription.amount, subscription.currency)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Billing Cycle:</span>
                <span className="font-medium ml-1">
                  {getBillingCycleText(subscription.billingCycle)}
                </span>
              </div>
              {subscription.nextBillingDate && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Next Billing:</span>
                  <span className="font-medium ml-1">
                    {format(new Date(subscription.nextBillingDate), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
            </div>

            {subscription.notes && (
              <div>
                <span className="text-muted-foreground text-sm">Notes:</span>
                <p className="text-sm mt-1">{subscription.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* 智能引导：自动生成支付记录 */}
          {shouldShowAutoGeneration() && onAutoGeneratePayments && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Smart Payment History Generation</h4>
                </div>
                
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  Your subscription started on {format(new Date(subscription.startDate), 'MMM dd, yyyy')}.
                  We can automatically generate approximately {calculateEstimatedRecords()} payment record(s) for you based on your billing cycle.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={handleAutoGenerate}
                    disabled={internalLoading || isAutoGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Auto-Generate Records
                  </Button>
                  <Button 
                    onClick={onAddPayment}
                    disabled={internalLoading || isAutoGenerating}
                    variant="outline" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/50 flex-1 sm:flex-none disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Manually
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 常规操作选项：当不满足自动生成条件时显示 */}
          {!shouldShowAutoGeneration() && (
            <div className="space-y-3">
              <h4 className="font-medium text-base">What you can do next:</h4>
              <div className="grid gap-3">
                <Button
                  onClick={onAddPayment}
                  className="justify-start h-auto p-4"
                  variant="outline"
                >
                  <CreditCard className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Add Payment Record Now</div>
                    <div className="text-sm text-muted-foreground">
                      Record your first payment information
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={onImportPayments}
                  className="justify-start h-auto p-4"
                  variant="outline"
                >
                  <FileText className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Import Payment History</div>
                    <div className="text-sm text-muted-foreground">
                      Bulk import existing payment data
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={onViewDetails}
                  className="justify-start h-auto p-4"
                  variant="outline"
                >
                  <Eye className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">View Subscription Details</div>
                    <div className="text-sm text-muted-foreground">
                      View complete subscription information and settings
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* 其他选项：始终显示 */}
          {shouldShowAutoGeneration() && (
            <div className="space-y-3">
              <h4 className="font-medium text-base">Other options:</h4>
              <div className="grid gap-2">
                <Button
                  onClick={onImportPayments}
                  disabled={internalLoading || isAutoGenerating}
                  className="justify-start h-auto p-3 disabled:opacity-50"
                  variant="ghost"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Import Payment History</div>
                  </div>
                </Button>

                <Button
                  onClick={onViewDetails}
                  disabled={internalLoading || isAutoGenerating}
                  className="justify-start h-auto p-3 disabled:opacity-50"
                  variant="ghost"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="text-sm font-medium">View Subscription Details</div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Bottom Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleLater}
              disabled={internalLoading || isAutoGenerating}
              variant="ghost"
              className="flex items-center gap-2 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}