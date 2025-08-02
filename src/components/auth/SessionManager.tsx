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
        toast.success('会话已自动刷新')
      } catch (error) {
        console.error('自动刷新失败:', error)
        toast.error('自动刷新失败')
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
        toast.success('会话刷新成功')
      } else {
        toast.error('会话刷新失败')
      }
    } catch (error) {
      toast.error('会话刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      const isValid = await validateSession()
      if (isValid) {
        toast.success('会话有效')
      } else {
        toast.error('会话无效，请重新登录')
      }
    } catch (error) {
      toast.error('会话验证失败')
    } finally {
      setValidating(false)
    }
  }

  const handleRecover = async () => {
    setRecovering(true)
    try {
      const success = await recoverSession()
      if (success) {
        toast.success('会话管理已恢复')
      } else {
        toast.error('会话恢复失败，请重新登录')
      }
    } catch (error) {
      toast.error('会话恢复失败')
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
      return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`
    } else if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`
    } else {
      return `${seconds}秒`
    }
  }

  const getStatusBadge = () => {
    if (!user) {
      return <Badge variant="secondary">未登录</Badge>
    }
    
    if (isSessionValid) {
      return <Badge variant="default" className="bg-green-500">已登录</Badge>
    } else {
      return <Badge variant="destructive">会话无效</Badge>
    }
  }

  const getHealthBadge = () => {
    if (!sessionHealth) {
      return <Badge variant="secondary">检查中...</Badge>
    }

    if (sessionHealth.isHealthy) {
      return <Badge variant="default" className="bg-green-500">健康</Badge>
    } else {
      return <Badge variant="destructive">异常</Badge>
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
          <span className="text-muted-foreground">会话剩余时间</span>
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
            ⚠️ 会话即将过期，建议刷新
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
            <span>用户未登录</span>
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
          会话管理
          {autoRefresh && (
            <Badge variant="outline" className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              自动刷新
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          管理和监控用户会话状态
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
              详细信息
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">最后活动:</span>
                <p className="font-mono text-xs mt-1">
                  {formatTime(detailedInfo.lastActivity)}
                </p>
              </div>
              
              {detailedInfo.expiresAt && (
                <div>
                  <span className="text-muted-foreground">过期时间:</span>
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
                <span>管理{detailedInfo.isActive ? '活跃' : '停止'}</span>
              </div>
              
              <div className="flex items-center gap-1">
                {detailedInfo.needsRefresh ? (
                  <Timer className="h-3 w-3 text-orange-500" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
                <span>{detailedInfo.needsRefresh ? '需要刷新' : '状态良好'}</span>
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
                <p className="font-medium">检测到会话问题:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {sessionHealth.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
                {sessionHealth.recommendations.length > 0 && (
                  <div>
                    <p className="font-medium text-sm">建议:</p>
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
            {refreshing ? '刷新中...' : '刷新会话'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={validating}
          >
            <Shield className={`h-4 w-4 mr-2 ${validating ? 'animate-spin' : ''}`} />
            {validating ? '验证中...' : '验证会话'}
          </Button>

          {sessionHealth && !sessionHealth.isHealthy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecover}
              disabled={recovering}
            >
              <Activity className={`h-4 w-4 mr-2 ${recovering ? 'animate-spin' : ''}`} />
              {recovering ? '恢复中...' : '恢复管理'}
            </Button>
          )}
        </div>

        {/* 会话无效提示 */}
        {!isSessionValid && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              会话已失效，请重新登录以继续使用。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}