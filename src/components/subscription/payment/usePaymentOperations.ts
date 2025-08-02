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
        title: "成功",
        description: "支付记录创建成功",
      })
      fetchPaymentHistory()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建支付记录失败'
      toast({
        title: "错误",
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
        title: "成功",
        description: "支付记录更新成功",
      })
      fetchPaymentHistory()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新支付记录失败'
      toast({
        title: "错误",
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
        title: "成功",
        description: "支付记录删除成功",
      })
      fetchPaymentHistory()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除支付记录失败'
      toast({
        title: "错误",
        description: errorMessage,
        variant: "destructive",
      })
    }
    
    setDeleteTarget(null)
  }
  
  const deleteConfirmation = useConfirmation({
    title: "删除支付记录",
    description: deleteTarget ? `确定要删除 ${deleteTarget.name} 的这条支付记录吗？此操作无法撤销。` : "",
    confirmText: "删除",
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