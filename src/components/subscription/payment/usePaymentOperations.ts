import { useToast } from "@/hooks/use-toast"
import { useState } from 'react'
import { useConfirmation } from '@/hooks/use-confirmation'
import { supabasePaymentHistoryService, PaymentHistoryRecord } from '@/services/supabasePaymentHistoryService'

export const usePaymentOperations = (
  fetchPaymentHistory: () => void
) => {
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleAddPayment = async (paymentData: Omit<PaymentHistoryRecord, 'id' | 'userId' | 'createdAt'>) => {
    try {
      await supabasePaymentHistoryService.createPaymentHistory(paymentData)
      
      toast({
        title: "Payment record added",
        description: "Payment record created successfully",
      })
      fetchPaymentHistory()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add payment record, please try again.'
      toast({
        title: "Error adding payment record",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    }
  }

  const handleEditPayment = async (paymentId: string, paymentData: Partial<PaymentHistoryRecord>) => {
    try {
      await supabasePaymentHistoryService.updatePaymentHistory(paymentId, paymentData)
      
      toast({
        title: "Payment record updated",
        description: "Payment record updated successfully",
      })
      fetchPaymentHistory()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update payment record, please try again.'
      toast({
        title: "Error updating payment record",
        description: errorMessage,
        variant: "destructive",
      })
      throw err
    }
  }

  const handleDeletePayment = async () => {
    if (!deleteTarget) return
    
    try {
      await supabasePaymentHistoryService.deletePaymentHistory(deleteTarget.id)
      
      toast({
        title: "Payment record deleted",
        description: "Payment record deleted successfully",
      })
      fetchPaymentHistory()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete payment record, please try again.'
      toast({
        title: "Error deleting payment record",
        description: errorMessage,
        variant: "destructive",
      })
    }
    
    setDeleteTarget(null)
  }
  
  const deleteConfirmation = useConfirmation({
    title: "Delete payment record",
    description: deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}? This action cannot be undone.` : "",
    confirmText: "Delete",
    onConfirm: handleDeletePayment,
  })
  
  const handleDeleteClick = (paymentId: string, subscriptionName: string) => {
    setDeleteTarget({ id: paymentId, name: subscriptionName })
    deleteConfirmation.openDialog()
  }

  return {
    handleAddPayment,
    handleEditPayment,
    handleDeleteClick,
    deleteConfirmation
  }
}