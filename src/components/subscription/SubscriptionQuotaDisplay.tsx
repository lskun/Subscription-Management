import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { UserPermissionService, QuotaType, type QuotaUsage } from '@/services/userPermissionService'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface SubscriptionQuotaDisplayProps {
  className?: string
}

export function SubscriptionQuotaDisplay({ className }: SubscriptionQuotaDisplayProps) {
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuotaUsage = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const usage = await UserPermissionService.checkQuota(QuotaType.MAX_SUBSCRIPTIONS)
        setQuotaUsage(usage)
      } catch (error) {
        console.error('Failed to fetch quota usage:', error)
        setError('Failed to load quota information')
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuotaUsage()
  }, [])

  const getStatusColor = () => {
    if (!quotaUsage) return 'secondary'
    const percentage = quotaUsage.percentage
    if (percentage >= 100) return 'destructive'
    if (percentage >= 80) return 'warning'
    return 'default'
  }

  const getStatusIcon = () => {
    if (!quotaUsage) return null
    const percentage = quotaUsage.percentage
    if (percentage >= 100) {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading quota information...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">{error}</div>
        </CardContent>
      </Card>
    )
  }

  if (!quotaUsage) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">No quota information available</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Subscription Quota
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Used Subscriptions</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{quotaUsage.used}</span>
            <span className="text-muted-foreground">/ {quotaUsage.limit}</span>
            <Badge variant={getStatusColor() as 'default' | 'secondary' | 'destructive' | 'outline'}>
              {quotaUsage.percentage.toFixed(0)}%
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <Progress 
            value={Math.min(quotaUsage.percentage, 100)} 
            className={`h-2 ${quotaUsage.percentage >= 100 ? 'bg-red-100' : quotaUsage.percentage >= 80 ? 'bg-yellow-100' : 'bg-green-100'}`}
          />
          {quotaUsage.percentage >= 100 && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              You have reached your subscription limit. Please upgrade to add more subscriptions.
            </p>
          )}
          {quotaUsage.percentage >= 80 && quotaUsage.percentage < 100 && (
            <p className="text-xs text-orange-600">
              You are approaching your subscription limit ({quotaUsage.used}/{quotaUsage.limit})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}