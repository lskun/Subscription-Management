import { useState, useEffect } from "react"
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

export function PaymentHistoryStats({ subscriptionId, className }: PaymentHistoryStatsProps) {
  const [stats, setStats] = useState<PaymentHistoryStatsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchStats = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 如果提供了subscriptionId，则只获取该订阅的统计数据
      const statsData = await supabasePaymentHistoryService.getPaymentHistoryStats(subscriptionId)
      setStats(statsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取支付统计失败'
      setError(errorMessage)
      toast({
        title: "错误",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
              {error || '无法加载支付统计'}
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
            总支付金额
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-xl font-bold break-words leading-tight">
            {formatWithUserCurrency(stats.totalAmount, 'CNY')}
          </div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            平均 {formatWithUserCurrency(stats.averageAmount, 'CNY')}
          </p>
        </CardContent>
      </Card>

      {/* 支付次数 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            支付次数
          </CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="text-xl font-bold">{stats.totalPayments} 次</div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs px-2 py-0.5 whitespace-nowrap">
              成功 {stats.successfulPayments}
            </Badge>
            {stats.failedPayments > 0 && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5 whitespace-nowrap">
                失败 {stats.failedPayments}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 成功率 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            成功率
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
          <div className="text-xl font-bold">{successRate}%</div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            {stats.successfulPayments}/{stats.totalPayments} 成功
          </p>
        </CardContent>
      </Card>

      {/* 最近支付 */}
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-left leading-tight flex-1 min-w-0">
            最近支付
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <div className="text-lg font-bold break-words leading-tight">
            {stats.lastPaymentDate ? formatDateDisplay(stats.lastPaymentDate) : '暂无'}
          </div>
          <p className="text-xs text-muted-foreground break-words leading-tight">
            {stats.refundedPayments > 0 ? `${stats.refundedPayments} 笔退款` : '无退款记录'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}