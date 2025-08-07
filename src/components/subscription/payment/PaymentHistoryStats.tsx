import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from "lucide-react"
import { supabasePaymentHistoryService, PaymentHistoryStats as PaymentHistoryStatsType } from "@/services/supabasePaymentHistoryService"
import { formatWithUserCurrency } from "@/utils/currency"
import { formatDateDisplay } from "@/utils/date"
import { useToast } from "@/hooks/use-toast"

interface PaymentHistoryStatsProps {
  subscriptionId?: string // 如果提供，则只显示特定订阅的统计
  className?: string
}

/**
 * PaymentHistoryStats组件的引用接口
 * 用于暴露刷新统计数据的方法
 */
export interface PaymentHistoryStatsRef {
  refreshStats: () => Promise<void>
}

/**
 * 支付历史统计组件
 * 显示支付总金额、支付次数、成功率和最近支付信息
 * @param subscriptionId - 订阅ID，如果提供则只显示特定订阅的统计
 * @param className - 自定义CSS类名
 * @param ref - 组件引用，用于外部调用刷新方法
 */
export const PaymentHistoryStats = forwardRef<PaymentHistoryStatsRef, PaymentHistoryStatsProps>(
  ({ subscriptionId, className }, ref) => {
  const [stats, setStats] = useState<PaymentHistoryStatsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  /**
   * 获取支付历史统计数据
   */
  const fetchStats = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 如果提供了subscriptionId，则只获取该订阅的统计数据
      const statsData = await supabasePaymentHistoryService.getPaymentHistoryStats(subscriptionId)
      setStats(statsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch payment history stats'
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

  /**
   * 暴露给父组件的刷新方法
   */
  useImperativeHandle(ref, () => ({
    refreshStats: fetchStats
  }), [subscriptionId])

  useEffect(() => {
    fetchStats()
  }, [subscriptionId])

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="min-h-[120px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <Skeleton className="h-4 w-20 flex-1 min-w-0" />
              <Skeleton className="h-4 w-4 flex-shrink-0 ml-2" />
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {error || 'Failed to fetch payment history stats'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const successRate = stats.totalPayments > 0 
    ? Math.round((stats.successfulPayments / stats.totalPayments) * 100) 
    : 0

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {/* 总支付金额 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            Payment Amount
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-xl font-bold break-words leading-tight">
          {formatWithUserCurrency(stats.totalAmount, 'CNY')}
          </div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            Average {formatWithUserCurrency(stats.averageAmount, 'CNY')}
          </p>
        </CardContent>
      </Card>

      {/* 支付次数 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            Total Payments
          </CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-xl font-bold break-words leading-tight">{stats.totalPayments}</div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            Success {stats.successfulPayments}
          </p>
          {stats.failedPayments > 0 && (
              <p className="text-xs text-muted-foreground break-words leading-tight">
                Fail {stats.failedPayments}
              </p>
            )}
          
        </CardContent>
      </Card>

      {/* 成功率 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            Success Rate
          </CardTitle>
          {successRate >= 90 ? (
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
          ) : successRate >= 70 ? (
            <TrendingUp className="h-4 w-4 text-yellow-600 flex-shrink-0 ml-2" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0 ml-2" />
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-xl font-bold break-words leading-tight">{successRate}%</div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            {stats.successfulPayments}/{stats.totalPayments} Success
          </p>
        </CardContent>
      </Card>

      {/* 最近支付 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            Recent Payment
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-lg font-bold break-words leading-tight">
            {stats.lastPaymentDate ? formatDateDisplay(stats.lastPaymentDate) : 'No recent payment'}
          </div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            {stats.pendingPayments > 0 ? `${stats.pendingPayments} Pending` : 'No pending record'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
})