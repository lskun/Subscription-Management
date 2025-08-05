import { useState, useEffect } from "react"
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
import { PaymentHistoryStats } from "./payment/PaymentHistoryStats"
import { PaymentHistoryFilters, PaymentHistoryFilters as FilterType } from "./payment/PaymentHistoryFilters"
import { PaymentHistoryReport } from "./payment/PaymentHistoryReport"
import { PaymentBulkActions } from "./payment/PaymentBulkActions"
import { usePaymentOperations } from "./payment/usePaymentOperations"

interface PaymentHistorySectionProps {
  subscriptionId: string
  subscriptionName: string
}

export function PaymentHistorySection({ subscriptionId, subscriptionName }: PaymentHistorySectionProps) {
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

  // Load payment operations hook
  const {
    handleAddPayment: addPayment,
    handleEditPayment: editPayment,
    handleDeleteClick,
    deleteConfirmation
  } = usePaymentOperations(fetchPaymentHistory)

  // Handle adding new payment
  const handleAddPayment = async (paymentData: any) => {
    await addPayment(paymentData)
    setShowAddForm(false)
  }

  // Handle editing payment
  const handleEditPayment = async (paymentData: any) => {
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
      <PaymentHistoryStats subscriptionId={subscriptionId} />

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
        onSubmit={editingPayment ? handleEditPayment : handleAddPayment}
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </div>
  )
}
