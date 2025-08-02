import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { formatCurrencyAmount } from "@/utils/currency"
import { transformPaymentsFromApi, type PaymentRecord } from '@/utils/dataTransform'
import { supabase } from '@/lib/supabase'
import { formatDateDisplay } from '@/utils/date'
import {
  Search,
  Calendar,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react"
import { ExpenseInfoData } from "./ExpenseInfoCards"






interface PaymentHistoryResponse {
  payments: PaymentRecord[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  filters: {
    startDate: string | null
    endDate: string | null
    status: string | null
    currency: string | null
  }
}

interface ExpenseDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  periodData: ExpenseInfoData
}

export function ExpenseDetailDialog({ isOpen, onClose, periodData }: ExpenseDetailDialogProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  
  const pageSize = 10

  // Fetch payment data when dialog opens
  useEffect(() => {
    if (isOpen && periodData) {
      fetchPaymentData()
    }
  }, [isOpen, periodData])

  // Reset current page when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const fetchPaymentData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      let allPaymentDetails: PaymentRecord[] = []

      if (periodData.periodType === 'monthly') {
        // 月度数据：直接从 payment-history API 获取数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('payment_history')
          .select(`
            *,
            subscriptions!inner(name, plan)
          `)
          .gte('payment_date', startDateStr)
          .lte('payment_date', endDateStr)
          .eq('status', 'succeeded')
        
        if (error) throw error
        allPaymentDetails = transformPaymentsFromApi(data || [])

      } else {
        // 季度或年度数据：直接从 payment-history API 获取整个时间范围的数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('payment_history')
          .select(`
            *,
            subscriptions!inner(name, plan)
          `)
          .gte('payment_date', startDateStr)
          .lte('payment_date', endDateStr)
          .eq('status', 'succeeded')
        
        if (error) throw error
        allPaymentDetails = transformPaymentsFromApi(data || [])
      }

      setPayments(allPaymentDetails)
      setTotalRecords(allPaymentDetails.length)
      setTotalPages(Math.ceil(allPaymentDetails.length / pageSize))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data')
    } finally {
      setIsLoading(false)
    }
  }

  // Filter payments based on search term
  const filteredPayments = payments.filter(payment =>
    (payment.subscriptionName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (payment.subscriptionPlan?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  // Paginate filtered payments
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  // Update pagination info based on filtered results
  const filteredTotalPages = Math.ceil(filteredPayments.length / pageSize)


  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unknown':
      case null:
      case undefined:
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {periodData.period} - Payment Details
          </DialogTitle>
          <DialogDescription>
            View all payment records for this period
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatCurrencyAmount(periodData.totalSpent, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Payments</p>
                  <p className="font-semibold">
                    {payments.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Daily Avg</p>
                  <p className="font-semibold">{formatCurrencyAmount(periodData.dailyAverage, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subscriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Payment List */}
        <div className="h-[400px] w-full border border-gray-200 rounded-md overflow-y-auto">
          <div className="space-y-2 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading payments...</span>
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-4">
                <p>Error loading payments: {error}</p>
                <Button variant="outline" onClick={fetchPaymentData} className="mt-2">
                  Retry
                </Button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                No payments found for this period
              </div>
            ) : (
              paginatedPayments.map((payment, index) => (
                <Card
                  key={payment.id}
                  className="hover:bg-muted/50 transition-all duration-200 hover:shadow-md animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{payment.subscriptionName || 'Unknown Subscription'}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {payment.subscriptionPlan || 'Unknown Plan'}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(payment.status || 'unknown')}`}>
                            {payment.status || 'Unknown'}
                          </Badge>
                          {payment.billingCycle && payment.billingCycle !== 'monthly' && (
                            <Badge variant="outline" className="text-xs">
                              {payment.billingCycle}
                            </Badge>
                          )}
                          {(payment.billingCycle === 'yearly' || payment.billingCycle === 'quarterly') && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Allocated
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Paid: {formatDateDisplay(payment.paymentDate)}</span>
                          <span>
                            Billing: {formatDateDisplay(payment.billingPeriod?.start)} - {formatDateDisplay(payment.billingPeriod?.end)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrencyAmount(payment.amountPaid, payment.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">{payment.currency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {filteredTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredPayments.length)} of {filteredPayments.length} payments
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {filteredTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(filteredTotalPages, prev + 1))}
                disabled={currentPage === filteredTotalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
