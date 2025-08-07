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

  // Select all/deselect all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(payments.map(p => p.id))
    } else {
      onSelectionChange([])
    }
  }

  // Bulk delete confirmation
  const deleteConfirmation = useConfirmation({
    title: "Bulk Delete Payment Records",
    description: `Are you sure you want to delete the selected ${selectedPayments.length} payment records? This action cannot be undone.`,
    confirmText: "Delete",
    onConfirm: handleBulkDelete,
  })

  // Bulk delete
  async function handleBulkDelete() {
    setIsProcessing(true)
    try {
      // Delete selected payment records one by one
      await Promise.all(
        selectedPayments.map(id => 
          supabasePaymentHistoryService.deletePaymentHistory(id)
        )
      )

      toast({
        title: "Success",
        description: `Deleted ${selectedPayments.length} payment records`,
      })

      onSelectionChange([]) // Clear selection
      onRefresh() // Refresh list
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk delete failed'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Bulk export
  const handleBulkExport = () => {
    const selectedPaymentData = payments.filter(p => selectedPayments.includes(p.id))
    
    const exportData = selectedPaymentData.map(payment => ({
      id: payment.id,
      subscriptionName: payment.subscription?.name || 'Unknown Subscription',
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
      title: "Success",
      description: `Exported ${selectedPayments.length} payment records`,
    })
  }

  // Bulk update status
  const handleBulkUpdateStatus = async (newStatus: 'success' | 'failed' | 'pending') => {
    setIsProcessing(true)
    try {
      await Promise.all(
        selectedPayments.map(id => 
          supabasePaymentHistoryService.updatePaymentHistory(id, { status: newStatus })
        )
      )

      const statusNames = {
        success: 'Success',
        failed: 'Failed',
        pending: 'Pending'
      }

      toast({
        title: "Success",
        description: `Updated ${selectedPayments.length} records status to ${statusNames[newStatus]}`,
      })

      onSelectionChange([]) // Clear selection
      onRefresh() // Refresh list
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk update failed'
      toast({
        title: "Error",
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
            if (el && el.querySelector('input')) {
              const input = el.querySelector('input') as HTMLInputElement
              input.indeterminate = isPartiallySelected
            }
          }}
          onCheckedChange={handleSelectAll}
        />
        <span className="text-sm font-medium">
          {selectedPayments.length > 0 ? (
            <>
              Selected <Badge variant="secondary">{selectedPayments.length}</Badge> records
            </>
          ) : (
            'Select records for bulk operations'
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
            Export
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
                Bulk Actions
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('success')}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
                Mark as Success
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('failed')}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4 text-red-600" />
                Mark as Failed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBulkUpdateStatus('pending')}
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4 text-yellow-600" />
                Mark as Pending
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={deleteConfirmation.openDialog}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Bulk Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={isProcessing}
          >
            Cancel Selection
          </Button>
        </div>
      )}

      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </div>
  )
}