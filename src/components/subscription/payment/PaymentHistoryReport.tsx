import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  Download, 
  TrendingUp, 
  Calendar,
  DollarSign,
  FileText
} from "lucide-react"
import { supabasePaymentHistoryService, PaymentHistoryRecord } from "@/services/supabasePaymentHistoryService"
import { formatWithUserCurrency, convertCurrency } from "@/utils/currency"
import { useToast } from "@/hooks/use-toast"
import { useSettingsStore } from "@/store/settingsStore"

interface PaymentHistoryReportProps {
  subscriptionId?: string
  className?: string
}

interface MonthlyData {
  month: string
  totalAmount: number
  totalPayments: number
  successRate: number
}

interface StatusData {
  name: string
  value: number
  color: string
}

export function PaymentHistoryReport({ subscriptionId, className }: PaymentHistoryReportProps) {
  const [payments, setPayments] = useState<PaymentHistoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const { toast } = useToast()

  const fetchPayments = async () => {
    setIsLoading(true)
    setError(null)

    try {
      let paymentsData: PaymentHistoryRecord[]
      
      if (subscriptionId) {
        paymentsData = await supabasePaymentHistoryService.getPaymentHistoryBySubscription(subscriptionId)
      } else {
        paymentsData = await supabasePaymentHistoryService.getAllPaymentHistory()
      }
      
      setPayments(paymentsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payment data'
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

  useEffect(() => {
    fetchPayments()
  }, [subscriptionId])

  // 生成月度数据
  const generateMonthlyData = (): MonthlyData[] => {
    const { currency: userCurrency, exchangeRates } = useSettingsStore.getState()
    const monthlyMap = new Map<string, { totalAmount: number; totalPayments: number; successfulPayments: number }>()
    
    // 初始化12个月的数据
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${selectedYear}-${i.toString().padStart(2, '0')}`
      monthlyMap.set(monthKey, { totalAmount: 0, totalPayments: 0, successfulPayments: 0 })
    }

    // 统计实际数据
    payments
      .filter(payment => payment.paymentDate.startsWith(selectedYear))
      .forEach(payment => {
        const monthKey = payment.paymentDate.substring(0, 7) // YYYY-MM
        const data = monthlyMap.get(monthKey)
        
        if (data) {
          data.totalPayments++
          if (payment.status === 'success') {
            // 将支付金额转换为用户设置的默认货币
            const convertedAmount = convertCurrency(
              payment.amountPaid,
              payment.currency,
              userCurrency,
              exchangeRates
            )
            data.totalAmount += convertedAmount
            data.successfulPayments++
          }
        }
      })

    // 转换为图表数据
    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => ({
      month: `${monthKey.split('-')[1]}`,
      totalAmount: Math.round(data.totalAmount * 100) / 100,
      totalPayments: data.totalPayments,
      successRate: data.totalPayments > 0 ? Math.round((data.successfulPayments / data.totalPayments) * 100) : 0
    }))
  }

  // 生成状态分布数据
  const generateStatusData = (): StatusData[] => {
    const statusMap = new Map<string, number>()
    
    payments.forEach(payment => {
      const count = statusMap.get(payment.status) || 0
      statusMap.set(payment.status, count + 1)
    })

    const colors = {
      success: '#22c55e',
      failed: '#ef4444',
      pending: '#f59e0b'
    }

    const statusNames = {
      success: 'Success',
      failed: 'Failed',
      pending: 'Pending'
    }

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      name: statusNames[status as keyof typeof statusNames] || status,
      value: count,
      color: colors[status as keyof typeof colors] || '#6b7280'
    }))
  }

  // 导出报告
  const exportReport = () => {
    const { currency: userCurrency, exchangeRates } = useSettingsStore.getState()
    const monthlyData = generateMonthlyData()
    const statusData = generateStatusData()
    
    const totalAmount = payments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => {
        const convertedAmount = convertCurrency(
          p.amountPaid,
          p.currency,
          userCurrency,
          exchangeRates
        )
        return sum + convertedAmount
      }, 0)
    
    const reportData = {
      year: selectedYear,
      summary: {
        totalPayments: payments.length,
        totalAmount,
        successRate: payments.length > 0 ? Math.round((payments.filter(p => p.status === 'success').length / payments.length) * 100) : 0
      },
      monthlyData,
      statusData,
      generatedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-report-${selectedYear}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Payment report exported successfully",
    })
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const monthlyData = generateMonthlyData()
  const statusData = generateStatusData()
  const availableYears = Array.from(new Set(payments.map(p => p.paymentDate.substring(0, 4)))).sort().reverse()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 报告头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Payment History Report
          </h3>
          <p className="text-sm text-muted-foreground">
            View payment trends and statistical analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={exportReport}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* 报告图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 月度支付趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Payment Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'totalAmount' ? formatWithUserCurrency(Number(value), 'CNY') : value,
                    name === 'totalAmount' ? 'Payment Amount' : 'Payment Count'
                  ]}
                />
                <Bar dataKey="totalAmount" fill="#3b82f6" name="totalAmount" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 支付状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payment Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payment Amount</p>
                <p className="text-lg font-semibold">
                  {(() => {
                    const { currency: userCurrency, exchangeRates } = useSettingsStore.getState()
                    const totalAmount = payments
                      .filter(p => p.status === 'success')
                      .reduce((sum, p) => {
                        const convertedAmount = convertCurrency(
                          p.amountPaid,
                          p.currency,
                          userCurrency,
                          exchangeRates
                        )
                        return sum + convertedAmount
                      }, 0)
                    return formatWithUserCurrency(totalAmount, userCurrency)
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Count</p>
                <p className="text-lg font-semibold">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold">
                  {payments.length > 0 
                    ? Math.round((payments.filter(p => p.status === 'success').length / payments.length) * 100)
                    : 0
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}