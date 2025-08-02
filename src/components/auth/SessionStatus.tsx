import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Clock, User, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface SessionStatusProps {
  showDetails?: boolean
  className?: string
}

export function SessionStatus({ showDetails = false, className }: SessionStatusProps) {
  const { 
    user, 
    session, 
    isSessionValid, 
    lastActivity, 
    expiresAt, 
    timeUntilExpiry,
    refreshSession,
    validateSession,
  } = useAuth()

  const [refreshing, setRefreshing] = useState(false)
  const [validating, setValidating] = useState(false)

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

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}天 ${hours % 24}小时`
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
      return <Badge variant="default">已登录</Badge>
    } else {
      return <Badge variant="destructive">会话无效</Badge>
    }
  }

  const getExpiryStatus = () => {
    if (!expiresAt || !timeUntilExpiry) {
      return null
    }

    const isExpiringSoon = timeUntilExpiry < 5 * 60 * 1000 // 5分钟内过期

    return (
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span className={isExpiringSoon ? 'text-orange-600' : 'text-muted-foreground'}>
          {isExpiringSoon ? '即将过期: ' : '过期时间: '}
          {formatDuration(timeUntilExpiry)}
        </span>
      </div>
    )
  }

  if (!showDetails) {
    // 简化显示模式
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusBadge()}
        {isSessionValid && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    )
  }

  // 详细显示模式
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          会话状态
        </CardTitle>
        <CardDescription>
          当前用户会话的详细信息
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 用户信息 */}
        {user && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{user.email}</span>
            {getStatusBadge()}
          </div>
        )}

        {/* 会话信息 */}
        {session && (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">会话ID: </span>
              <span className="font-mono text-xs">{session.access_token.slice(0, 20)}...</span>
            </div>
            
            {lastActivity > 0 && (
              <div>
                <span className="text-muted-foreground">最后活动: </span>
                <span>{formatTime(lastActivity)}</span>
              </div>
            )}

            {expiresAt && (
              <div>
                <span className="text-muted-foreground">过期时间: </span>
                <span>{formatTime(expiresAt)}</span>
              </div>
            )}

            {getExpiryStatus()}
          </div>
        )}

        {/* 操作按钮 */}
        {isSessionValid && (
          <div className="flex gap-2">
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
          </div>
        )}

        {/* 会话无效提示 */}
        {!isSessionValid && user && (
          <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-md">
            会话已失效，请重新登录以继续使用。
          </div>
        )}
      </CardContent>
    </Card>
  )
}