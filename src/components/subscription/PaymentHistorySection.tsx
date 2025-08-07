import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { PaymentHistoryRecord, supabasePaymentHistoryService } from "@/services/supabasePaymentHistoryService"
import { PaymentHistorySheet } from "./PaymentHistorySheet"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

// Import sub-components
import { PaymentHistoryHeader } from "./payment/PaymentHistoryHeader"
import { PaymentListItem } from "./payment/PaymentListItem"
import { PaymentListState } from "./payment/PaymentListState"
import { PaymentHistoryStats, PaymentHistoryStatsRef } from "./payment/PaymentHistoryStats"
import { PaymentHistoryFilters, PaymentHistoryFilters as FilterType } from "./payment/PaymentHistoryFilters"
import { PaymentHistoryReport } from "./payment/PaymentHistoryReport"
import { PaymentBulkActions } from "./payment/PaymentBulkActions"
import { usePaymentOperations } from "./payment/usePaymentOperations"
import { usePaymentRecordOperations } from "@/hooks/usePaymentRecordOperations"
import { DuplicatePaymentConfirmDialog } from "./payment/DuplicatePaymentConfirmDialog"
import { AddPaymentRecordParams } from "@/services/paymentRecordService"

// 预填充数据接口
interface PrefilledData {
  amount?: number
  currency?: string
  billingCycle?: string
  nextBillingDate?: string
}

interface PaymentHistorySectionProps {
  subscriptionId: string
  subscriptionName: string
  prefilledData?: PrefilledData
}

export function PaymentHistorySection({ subscriptionId, subscriptionName, prefilledData }: PaymentHistorySectionProps) {
  const [payments, setPayments] = useState<PaymentHistoryRecord[]>([])
  const [allPayments, setAllPayments] = useState<PaymentHistoryRecord[]>([]) // 存储所有支付记录用于筛选
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryRecord | null>(null)
  const [activeTab, setActiveTab] = useState('list')
  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const { toast } = useToast()
  
  // PaymentHistoryStats组件的引用
  const paymentStatsRef = useRef<PaymentHistoryStatsRef>(null)

  // 筛选状态
  const [filters, setFilters] = useState<FilterType>({
    searchTerm: '',
    status: 'all',
    startDate: null,
    endDate: null,
    currency: 'all'
  })


  // Fetch payment history for this subscription
  const fetchPaymentHistory = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const payments = await supabasePaymentHistoryService.getPaymentHistoryBySubscription(subscriptionId)
      setAllPayments(payments)
      setPayments(payments) // 初始时显示所有支付记录
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment history'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load payment history when component mounts
  useEffect(() => {
    fetchPaymentHistory()
  }, [subscriptionId])

  /**
   * 刷新支付数据和统计数据
   */
  const refreshPaymentData = async () => {
    await fetchPaymentHistory()
    // 刷新统计数据
    if (paymentStatsRef.current) {
      await paymentStatsRef.current.refreshStats()
    }
  }

  // Load payment operations hook (for edit and delete)
  const {
    handleEditPayment: editPayment,
    handleDeleteClick,
    deleteConfirmation
  } = usePaymentOperations(refreshPaymentData)

  // Load unified payment record operations hook (for add with duplicate detection)
  const {
    isLoading: isAddingPayment,
    showDuplicateWarning,
    duplicateDetectionResult,
    addPaymentRecord,
    confirmDuplicatePayment,
    cancelDuplicatePayment
  } = usePaymentRecordOperations({
    onSuccess: async () => {
      setShowAddForm(false)
      await refreshPaymentData()
    },
    onError: (error) => {
      console.error('支付记录添加失败:', error)
    }
  })

  // Handle adding new payment with duplicate detection
  const handleAddPayment = async (paymentData: {
    subscriptionId: string
    paymentDate: string
    amountPaid: number
    currency: string
    billingPeriodStart: string
    billingPeriodEnd: string
    status: 'success' | 'failed' | 'pending'
    notes?: string
  }) => {
    const params: AddPaymentRecordParams = {
      subscriptionId,
      paymentDate: paymentData.paymentDate,
      amountPaid: paymentData.amountPaid,
      currency: paymentData.currency,
      billingPeriodStart: paymentData.billingPeriodStart,
      billingPeriodEnd: paymentData.billingPeriodEnd,
      status: paymentData.status,
      notes: paymentData.notes
    }
    
    await addPaymentRecord(params)
  }

  // Handle editing payment
  const handleEditPayment = async (paymentData: {
    subscriptionId: string
    paymentDate: string
    amountPaid: number
    currency: string
    billingPeriodStart: string
    billingPeriodEnd: string
    status: 'success' | 'failed' | 'pending'
    notes?: string
  }) => {
    if (!editingPayment) return
    await editPayment(editingPayment.id, paymentData)
    setEditingPayment(null)
  }

  // 应用筛选条件
  const applyFilters = () => {
    let filtered = [...allPayments]

    // 搜索筛选
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(payment =>
        payment.paymentDate.toLowerCase().includes(searchLower) ||
        payment.status.toLowerCase().includes(searchLower) ||
        payment.amountPaid.toString().includes(searchLower) ||
        payment.notes?.toLowerCase().includes(searchLower) ||
        payment.subscription?.name.toLowerCase().includes(searchLower)
      )
    }

    // 状态筛选
    if (filters.status !== 'all') {
      filtered = filtered.filter(payment => payment.status === filters.status)
    }

    // 货币筛选
    if (filters.currency !== 'all') {
      filtered = filtered.filter(payment => payment.currency === filters.currency)
    }

    // 日期范围筛选
    if (filters.startDate) {
      const startDateStr = format(filters.startDate, 'yyyy-MM-dd')
      filtered = filtered.filter(payment => payment.paymentDate >= startDateStr)
    }

    if (filters.endDate) {
      const endDateStr = format(filters.endDate, 'yyyy-MM-dd')
      filtered = filtered.filter(payment => payment.paymentDate <= endDateStr)
    }

    setPayments(filtered)
  }

  // 当筛选条件改变时应用筛选
  useEffect(() => {
    applyFilters()
  }, [filters, allPayments])

  // 清除筛选条件
  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'all',
      startDate: null,
      endDate: null,
      currency: 'all'
    })
  }

  // 处理单个支付记录的选择
  const handlePaymentSelection = (paymentId: string, selected: boolean) => {
    if (selected) {
      setSelectedPayments(prev => [...prev, paymentId])
    } else {
      setSelectedPayments(prev => prev.filter(id => id !== paymentId))
    }
  }

  // 当支付记录列表改变时，清理无效的选择
  useEffect(() => {
    const validIds = payments.map(p => p.id)
    setSelectedPayments(prev => prev.filter(id => validIds.includes(id)))
  }, [payments])

  return (
    <div className="space-y-6">
      {/* 支付历史统计 */}
      <PaymentHistoryStats ref={paymentStatsRef} subscriptionId={subscriptionId} />

      {/* 标签页导航 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Payment History</TabsTrigger>
          <TabsTrigger value="report">Statistics Report</TabsTrigger>
        </TabsList>

        {/* 支付记录列表 */}
        <TabsContent value="list" className="space-y-4">
          {/* 筛选器 */}
          <PaymentHistoryFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
          />

          {/* Header with Add Button and Bulk Actions Toggle */}
          <div className="flex items-center justify-between">
            <PaymentHistoryHeader
              paymentCount={payments.length}
              searchTerm={filters.searchTerm}
              onSearchChange={(value) => setFilters(prev => ({ ...prev, searchTerm: value }))}
              onAddPayment={() => setShowAddForm(true)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowBulkActions(!showBulkActions)
                if (showBulkActions) {
                  setSelectedPayments([]) // 清空选择
                }
              }}
              className="gap-2"
            >
              {showBulkActions ? 'Cancel Bulk Actions' : 'Bulk Actions'}
            </Button>
          </div>

          {/* 批量操作栏 */}
          {showBulkActions && (
            <PaymentBulkActions
              payments={payments}
              selectedPayments={selectedPayments}
              onSelectionChange={setSelectedPayments}
              onRefresh={fetchPaymentHistory}
            />
          )}

          {/* Payment List */}
          <div className="space-y-2">
            <PaymentListState
              isLoading={isLoading}
              error={error}
              isEmpty={payments.length === 0}
              searchTerm={filters.searchTerm}
              onRetry={fetchPaymentHistory}
            />
            
            {!isLoading && !error && payments.map((payment) => (
              <PaymentListItem
                key={payment.id}
                payment={payment}
                onEdit={setEditingPayment}
                onDelete={() => handleDeleteClick(payment.id, subscriptionName)}
                isSelected={selectedPayments.includes(payment.id)}
                onSelectionChange={handlePaymentSelection}
                showSelection={showBulkActions}
              />
            ))}
          </div>
        </TabsContent>

        {/* 统计报告 */}
        <TabsContent value="report">
          <PaymentHistoryReport subscriptionId={subscriptionId} />
        </TabsContent>
      </Tabs>

      {/* Payment History Sheet */}
      <PaymentHistorySheet
        open={showAddForm || editingPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false)
            setEditingPayment(null)
          }
        }}
        initialData={editingPayment || undefined}
        subscriptionId={subscriptionId}
        subscriptionName={subscriptionName}
        prefilledData={!editingPayment ? prefilledData : undefined}
        onSubmit={editingPayment ? handleEditPayment : handleAddPayment}
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog {...deleteConfirmation.dialogProps} />
      
      {/* Duplicate Payment Confirmation Dialog */}
      <DuplicatePaymentConfirmDialog
        open={showDuplicateWarning}
        onOpenChange={(open) => {
          if (!open) {
            cancelDuplicatePayment()
          }
        }}
        result={duplicateDetectionResult}
        onConfirm={confirmDuplicatePayment}
        onCancel={cancelDuplicatePayment}
      />
    </div>
  )
}
