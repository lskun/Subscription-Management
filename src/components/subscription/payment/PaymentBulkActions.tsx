import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { 
  MoreHorizontal, 
  Trash2, 
  Download, 
  Edit,
  CheckCircle,
  XCircle
} from "lucide-react"
import { PaymentHistoryRecord, supabasePaymentHistoryService } from "@/services/supabasePaymentHistoryService"
import { useToast } from "@/hooks/use-toast"
import { useConfirmation } from "@/hooks/use-confirmation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface PaymentBulkActionsProps {
  payments: PaymentHistoryRecord[]
  selectedPayments: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onRefresh: () => void
  className?: string
}

export function PaymentBulkActions({
  payments,
  selectedPayments,
  onSelectionChange,
  onRefresh,
  className
}: PaymentBulkActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(payments.map(p => p.id))
    } else {
      onSelectionChange([])
    }
  }

  // 批量删除确认
  const deleteConfirmation = useConfirmation({
    title: "批量删除支付记录",
    description: `确定要删除选中的 ${selectedPayments.length} 条支付记录吗？此操作无法撤销。`,
    confirmText: "删除",
    onConfirm: handleBulkDelete,
  })

  // 批量删除
  async function handleBulkDelete() {
    setIsProcessing(true)
    try {
      // 逐个删除选中的支付记录
      await Promise.all(
        selectedPayments.map(id => 
          supabasePaymentHistoryService.deletePaymentHistory(id)
        )
      )

      toast({
        title: "成功",
        description: `已删除 ${selectedPayments.length} 条支付记录`,
      })

      onSelectionChange([]) // 清空选择
      onRefresh() // 刷新列表
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量删除失败'
      toast({
        title: "错误",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 批量导出
  const handleBulkExport = () => {
    const selectedPaymentData = payments.filter(p => selectedPayments.includes(p.id))
    
    const exportData = selectedPaymentData.map(payment => ({
      id: payment.id,
      subscriptionName: payment.subscription?.name || '未知订阅',
      paymentDate: payment.paymentDate,
      amount: payment.amountPaid,
      currency: payment.currency,
      status: payment.status,
      billingPeriodStart: payment.billingPeriodStart,
      billingPeriodEnd: payment.billingPeriodEnd,
      notes: payment.notes || '',
      createdAt: payment.createdAt
    }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected-payments-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "成功",
      description: `已导出 ${selectedPayments.length} 条支付记录`,
    })
  }

  // 批量更新状态
  const handleBulkUpdateStatus = async (newStatus: 'succeeded' | 'failed' | 'refunded') => {
    setIsProcessing(true)
    try {
      await Promise.all(
        selectedPayments.map(id => 
          supabasePaymentHistoryService.updatePaymentHistory(id, { status: newStatus })
        )
      )

      const statusNames = {
        succeeded: '成功',
        failed: '失败',
        refunded: '已退款'
      }

      toast({
        title: "成功",
        description: `已将 ${selectedPayments.length} 条记录状态更新为${statusNames[newStatus]}`,
      })

      onSelectionChange([]) // 清空选择
      onRefresh() // 刷新列表
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量更新失败'
      toast({
        title: "错误",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const isAllSelected = payments.length > 0 && selectedPayments.length === payments.length
  const isPartiallySelected = selectedPayments.length > 0 && selectedPayments.length < payments.length

  if (payments.length === 0) {
    return null
  }

  return (
    <div className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg ${className}`}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isPartiallySelected
          }}
          onCheckedChange={handleSelectAll}
        />
        <span className="text-sm font-medium">
          {selectedPayments.length > 0 ? (
            <>
              已选择 <Badge variant="secondary">{selectedPayments.length}</Badge> 条记录
            </>
          ) : (
            '选择记录进行批量操作'
          )}
        </span>
      </div>

      {selectedPayments.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkExport}
            disabled={isProcessing}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            导出
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                批量操作
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('succeeded')}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
                标记为成功
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('failed')}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4 text-red-600" />
                标记为失败
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('refunded')}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4 text-yellow-600" />
                标记为退款
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={deleteConfirmation.openDialog}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                批量删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={isProcessing}
          >
            取消选择
          </Button>
        </div>
      )}

      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </div>
  )
}