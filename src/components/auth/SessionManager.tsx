import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  RefreshCw, 
  User, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Activity,
  Timer
} from 'lucide-react'
import { toast } from 'sonner'

interface SessionManagerProps {
  className?: string
  showHealthCheck?: boolean
  showDetailedInfo?: boolean
  autoRefresh?: boolean
}

interface SessionHealth {
  isHealthy: boolean
  issues: string[]
  recommendations: string[]
}

interface DetailedSessionInfo {
  isActive: boolean
  expiresAt: number | null
  timeUntilExpiry: number | null
  lastActivity: number
  isValid: boolean
  needsRefresh: boolean
}

export function SessionManager({ 
  className, 
  showHealthCheck = true, 
  showDetailedInfo = true,
  autoRefresh = false
}: SessionManagerProps) {
  const { 
    user, 
    isSessionValid, 
    expiresAt, 
    timeUntilExpiry,
    refreshSession,
    validateSession,
    getDetailedSessionInfo,
    checkSessionHealth,
    recoverSession
  } = useAuth()

  const [refreshing, setRefreshing] = useState(false)
  const [validating, setValidating] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [sessionHealth, setSessionHealth] = useState<SessionHealth | null>(null)
  const [detailedInfo, setDetailedInfo] = useState<DetailedSessionInfo | null>(null)


  // 定期检查会话健康状态
  useEffect(() => {
    if (!showHealthCheck || !isSessionValid) return

    const checkHealth = async () => {
      try {
        const health = await checkSessionHealth()
        setSessionHealth(health)
      } catch (error) {
        console.error('检查会话健康状态失败:', error)
      }
    }

    // 立即检查一次
    checkHealth()

    // 每30秒检查一次
    const healthTimer = setInterval(checkHealth, 30000)

    return () => clearInterval(healthTimer)
  }, [isSessionValid, showHealthCheck, checkSessionHealth])

  // 获取详细会话信息
  useEffect(() => {
    if (!showDetailedInfo || !isSessionValid) return

    const getInfo = async () => {
      try {
        const info = await getDetailedSessionInfo()
        setDetailedInfo(info)
      } catch (error) {
        console.error('获取详细会话信息失败:', error)
      }
    }

    // 立即获取一次
    getInfo()

    // 每10秒更新一次
    const infoTimer = setInterval(getInfo, 10000)

    return () => clearInterval(infoTimer)
  }, [isSessionValid, showDetailedInfo, getDetailedSessionInfo])

  // 自动刷新功能
  useEffect(() => {
    if (!autoRefresh || !isSessionValid || !detailedInfo?.needsRefresh) return

    const autoRefreshSession = async () => {
      console.log('自动刷新会话...')
      try {
        await refreshSession()
        toast.success('Session auto-refreshed successfully')
      } catch (error) {
        console.error('自动刷新失败:', error)
        toast.error('Auto-refresh failed')
      }
    }

    // 如果需要刷新，延迟1秒后执行
    const refreshTimer = setTimeout(autoRefreshSession, 1000)

    return () => clearTimeout(refreshTimer)
  }, [autoRefresh, isSessionValid, detailedInfo?.needsRefresh, refreshSession])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const success = await refreshSession()
      if (success) {
        toast.success('Session refreshed successfully')
      } else {
        toast.error('Session refresh failed')
      }
    } catch (error) {
      toast.error('Session refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      const isValid = await validateSession()
      if (isValid) {
        toast.success('Session is valid')
      } else {
        toast.error('Session is invalid, please log in again')
      }
    } catch (error) {
      toast.error('Session validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleRecover = async () => {
    setRecovering(true)
    try {
      const success = await recoverSession()
      if (success) {
        toast.success('Session management recovered')
      } else {
        toast.error('Session recovery failed, please log in again')
      }
    } catch (error) {
      toast.error('Session recovery failed')
    } finally {
      setRecovering(false)
    }
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const getStatusBadge = () => {
    if (!user) {
      return <Badge variant="secondary">Not Logged In</Badge>
    }
    
    if (isSessionValid) {
      return <Badge variant="default" className="bg-green-500">Logged In</Badge>
    } else {
      return <Badge variant="destructive">Invalid Session</Badge>
    }
  }

  const getHealthBadge = () => {
    if (!sessionHealth) {
      return <Badge variant="secondary">Checking...</Badge>
    }

    if (sessionHealth.isHealthy) {
      return <Badge variant="default" className="bg-green-500">Healthy</Badge>
    } else {
      return <Badge variant="destructive">Unhealthy</Badge>
    }
  }

  const getExpiryProgress = () => {
    if (!expiresAt || !timeUntilExpiry) return null

    const totalTime = 60 * 60 * 1000 // 假设总时长为1小时
    const progress = Math.max(0, Math.min(100, (timeUntilExpiry / totalTime) * 100))
    const isExpiringSoon = timeUntilExpiry < 5 * 60 * 1000 // 5分钟内过期

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Session Time Remaining</span>
          <span className={isExpiringSoon ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
            {formatDuration(timeUntilExpiry)}
          </span>
        </div>
        <Progress 
          value={progress} 
          className={`h-2 ${isExpiringSoon ? 'bg-orange-100' : ''}`}
        />
        {isExpiringSoon && (
          <p className="text-xs text-orange-600">
            ⚠️ Session expiring soon, refresh recommended
          </p>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>User Not Logged In</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Session Management
          {autoRefresh && (
            <Badge variant="outline" className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              Auto Refresh
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Manage and monitor user session status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基本状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {showHealthCheck && getHealthBadge()}
          </div>
        </div>

        {/* 会话过期进度 */}
        {isSessionValid && getExpiryProgress()}

        {/* 详细信息 */}
        {showDetailedInfo && detailedInfo && (
          <div className="space-y-3 text-sm border-t pt-4">
            <h4 className="font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Detailed Information
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Last Activity:</span>
                <p className="font-mono text-xs mt-1">
                  {formatTime(detailedInfo.lastActivity)}
                </p>
              </div>
              
              {detailedInfo.expiresAt && (
                <div>
                  <span className="text-muted-foreground">Expires At:</span>
                  <p className="font-mono text-xs mt-1">
                    {formatTime(detailedInfo.expiresAt)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                {detailedInfo.isActive ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>Session {detailedInfo.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              
              <div className="flex items-center gap-1">
                {detailedInfo.needsRefresh ? (
                  <Timer className="h-3 w-3 text-orange-500" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
                <span>{detailedInfo.needsRefresh ? 'Needs Refresh' : 'Status Good'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 健康检查结果 */}
        {showHealthCheck && sessionHealth && !sessionHealth.isHealthy && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Session issues detected:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {sessionHealth.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
                {sessionHealth.recommendations.length > 0 && (
                  <div>
                    <p className="font-medium text-sm">Recommendations:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {sessionHealth.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Session'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={validating}
          >
            <Shield className={`h-4 w-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validating...' : 'Validate Session'}
          </Button>

          {sessionHealth && !sessionHealth.isHealthy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecover}
              disabled={recovering}
            >
              <Activity className={`h-4 w-4 mr-2 ${recovering ? 'animate-spin' : ''}`} />
              {recovering ? 'Recovering...' : 'Recover Session'}
            </Button>
          )}
        </div>

        {/* 会话无效提示 */}
        {!isSessionValid && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Session has expired. Please log in again to continue.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}