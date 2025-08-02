import React from 'react'
import { useQuota, useAllQuotas, useUserPlan } from '@/hooks/usePermissions'
import { QuotaType } from '@/services/userPermissionService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  CheckCircle, 
  Infinity, 
  TrendingUp,
  Calendar,
  Database,
  Download,
  Upload,
  Zap,
  Loader2
} from 'lucide-react'

interface QuotaDisplayProps {
  quotaType: QuotaType
  showDetails?: boolean
  className?: string
}

/**
 * 单个配额显示组件
 */
export function QuotaDisplay({ quotaType, showDetails = true, className = '' }: QuotaDisplayProps) {
  const { quota, loading, isNearLimit, isAtLimit } = useQuota(quotaType)

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (!quota) {
    return null
  }

  const getQuotaIcon = (type: QuotaType) => {
    switch (type) {
      case QuotaType.MAX_SUBSCRIPTIONS:
        return <Database className="h-4 w-4" />
      case QuotaType.API_CALLS_PER_HOUR:
      case QuotaType.API_CALLS_PER_DAY:
        return <TrendingUp className="h-4 w-4" />
      case QuotaType.EXPORT_PER_MONTH:
        return <Download className="h-4 w-4" />
      case QuotaType.IMPORT_PER_MONTH:
        return <Upload className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const getQuotaName = (type: QuotaType) => {
    switch (type) {
      case QuotaType.MAX_SUBSCRIPTIONS:
        return '订阅数量'
      case QuotaType.API_CALLS_PER_HOUR:
        return 'API调用/小时'
      case QuotaType.API_CALLS_PER_DAY:
        return 'API调用/天'
      case QuotaType.EXPORT_PER_MONTH:
        return '导出次数/月'
      case QuotaType.IMPORT_PER_MONTH:
        return '导入次数/月'
      case QuotaType.STORAGE_SIZE_MB:
        return '存储空间'
      default:
        return type
    }
  }

  const getStatusColor = () => {
    if (isAtLimit) return 'text-red-600'
    if (isNearLimit) return 'text-orange-600'
    return 'text-green-600'
  }

  const getStatusIcon = () => {
    if (isAtLimit) return <AlertTriangle className="h-4 w-4 text-red-600" />
    if (isNearLimit) return <AlertTriangle className="h-4 w-4 text-orange-600" />
    return <CheckCircle className="h-4 w-4 text-green-600" />
  }

  const isUnlimited = quota.limit <= 0

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getQuotaIcon(quotaType)}
          <span className="text-sm font-medium">{getQuotaName(quotaType)}</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm font-mono ${getStatusColor()}`}>
            {quota.used}
            {!isUnlimited && ` / ${quota.limit}`}
            {isUnlimited && (
              <Infinity className="inline h-4 w-4 ml-1" />
            )}
          </span>
        </div>
      </div>

      {!isUnlimited && showDetails && (
        <div className="space-y-1">
          <Progress 
            value={quota.percentage} 
            className="h-2"
            // 根据使用情况改变颜色
            style={{
              '--progress-background': isAtLimit 
                ? 'rgb(239 68 68)' 
                : isNearLimit 
                  ? 'rgb(245 158 11)' 
                  : 'rgb(34 197 94)'
            } as React.CSSProperties}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{quota.percentage.toFixed(1)}% 已使用</span>
            {quota.resetDate && (
              <span>重置于 {quota.resetDate.toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 配额概览卡片
 */
export function QuotaOverviewCard({ className = '' }: { className?: string }) {
  const { quotas, loading, hasWarnings, hasLimitsReached } = useAllQuotas()
  const { plan } = useUserPlan()

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>使用配额</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>使用配额</span>
          </div>
          <Badge variant={hasLimitsReached ? 'destructive' : hasWarnings ? 'secondary' : 'default'}>
            {plan?.name || '未知计划'}
          </Badge>
        </CardTitle>
        <CardDescription>
          当前订阅计划的使用情况
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotas.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            暂无配额限制
          </p>
        ) : (
          quotas.map((quota) => (
            <QuotaDisplay
              key={quota.type}
              quotaType={quota.type}
              showDetails={true}
            />
          ))
        )}

        {hasLimitsReached && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              您已达到某些功能的使用限制。请升级您的订阅计划以继续使用。
            </AlertDescription>
          </Alert>
        )}

        {hasWarnings && !hasLimitsReached && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              您的某些配额使用量已接近限制。建议升级订阅计划以避免服务中断。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 配额警告横幅
 */
export function QuotaWarningBanner({ className = '' }: { className?: string }) {
  const { hasWarnings, hasLimitsReached, quotas } = useAllQuotas()

  if (!hasWarnings && !hasLimitsReached) {
    return null
  }

  const criticalQuotas = quotas.filter(q => q.used >= q.limit && q.limit > 0)
  const warningQuotas = quotas.filter(q => q.percentage >= 80 && q.used < q.limit)

  return (
    <Alert className={`${hasLimitsReached ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'} ${className}`}>
      <AlertTriangle className={`h-4 w-4 ${hasLimitsReached ? 'text-red-600' : 'text-orange-600'}`} />
      <AlertDescription className={hasLimitsReached ? 'text-red-800' : 'text-orange-800'}>
        {hasLimitsReached ? (
          <div>
            <p className="font-medium mb-2">配额已达上限</p>
            <ul className="list-disc list-inside space-y-1">
              {criticalQuotas.map((quota) => (
                <li key={quota.type} className="text-sm">
                  {quota.type}: {quota.used}/{quota.limit}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <p className="font-medium mb-2">配额使用警告</p>
            <ul className="list-disc list-inside space-y-1">
              {warningQuotas.map((quota) => (
                <li key={quota.type} className="text-sm">
                  {quota.type}: {quota.used}/{quota.limit} ({quota.percentage.toFixed(1)}%)
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button 
          size="sm" 
          className="mt-3 bg-gradient-to-r from-blue-600 to-purple-600"
        >
          <Zap className="mr-2 h-4 w-4" />
          升级计划
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * 简化的配额指示器
 */
export function QuotaIndicator({ 
  quotaType, 
  showLabel = true,
  size = 'sm',
  className = '' 
}: { 
  quotaType: QuotaType
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string 
}) {
  const { quota, loading, isNearLimit, isAtLimit } = useQuota(quotaType)

  if (loading || !quota) {
    return null
  }

  const sizeClasses = {
    sm: 'h-2 w-16',
    md: 'h-3 w-24',
    lg: 'h-4 w-32'
  }

  const isUnlimited = quota.limit <= 0

  if (isUnlimited) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {showLabel && <span className="text-xs text-muted-foreground">无限制</span>}
        <Infinity className="h-4 w-4 text-green-600" />
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {quota.used}/{quota.limit}
        </span>
      )}
      <Progress 
        value={quota.percentage} 
        className={sizeClasses[size]}
        style={{
          '--progress-background': isAtLimit 
            ? 'rgb(239 68 68)' 
            : isNearLimit 
              ? 'rgb(245 158 11)' 
              : 'rgb(34 197 94)'
        } as React.CSSProperties}
      />
    </div>
  )
}