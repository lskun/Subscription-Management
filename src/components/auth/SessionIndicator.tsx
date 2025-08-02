import { useState } from 'react'
import { useSessionStatus, useSessionWarning } from '@/hooks/useSessionMonitor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  Clock,
  User,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface SessionIndicatorProps {
  className?: string
  showUserInfo?: boolean
  showRefreshButton?: boolean
  compact?: boolean
}

export function SessionIndicator({ 
  className = '',
  showUserInfo = true,
  showRefreshButton = true,
  compact = false
}: SessionIndicatorProps) {
  const { isLoggedIn, isExpiringSoon, timeUntilExpiry, user } = useSessionStatus()
  const { shouldShowWarning } = useSessionWarning()
  const { refreshSession } = useAuth()

  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const success = await refreshSession()
      if (success) {
        toast.success('会话已刷新')
      } else {
        toast.error('会话刷新失败')
      }
    } catch (error) {
      toast.error('会话刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    } else {
      return `${seconds}秒`
    }
  }

  const getStatusIcon = () => {
    if (!isLoggedIn) {
      return <ShieldX className="h-4 w-4 text-red-500" />
    }
    
    if (shouldShowWarning || isExpiringSoon) {
      return <ShieldAlert className="h-4 w-4 text-orange-500" />
    }
    
    return <ShieldCheck className="h-4 w-4 text-green-500" />
  }

  const getStatusBadge = () => {
    if (!isLoggedIn) {
      return <Badge variant="destructive">未登录</Badge>
    }
    
    if (shouldShowWarning || isExpiringSoon) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">即将过期</Badge>
    }
    
    return <Badge variant="default" className="bg-green-100 text-green-800">已登录</Badge>
  }

  const getTooltipContent = () => {
    if (!isLoggedIn) {
      return "用户未登录"
    }
    
    if (shouldShowWarning && timeUntilExpiry) {
      return `会话将在 ${formatTimeRemaining(timeUntilExpiry)} 后过期`
    }
    
    return "会话状态正常"
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 ${className}`}>
              {getStatusIcon()}
              {isExpiringSoon && timeUntilExpiry && (
                <span className="text-xs text-orange-600 font-mono">
                  {formatTimeRemaining(timeUntilExpiry)}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 状态图标和徽章 */}
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        {getStatusBadge()}
      </div>

      {/* 用户信息 */}
      {showUserInfo && user && (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{user.email}</span>
        </div>
      )}

      {/* 过期时间警告 */}
      {isExpiringSoon && timeUntilExpiry && (
        <div className="flex items-center gap-1 text-sm text-orange-600">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            {formatTimeRemaining(timeUntilExpiry)}
          </span>
        </div>
      )}

      {/* 刷新按钮 */}
      {showRefreshButton && isLoggedIn && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>刷新会话</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

// 简化版本，只显示状态图标
export function SessionStatusIcon({ className = '' }: { className?: string }) {
  return (
    <SessionIndicator 
      className={className}
      showUserInfo={false}
      showRefreshButton={false}
      compact={true}
    />
  )
}

// 完整版本，显示所有信息
export function SessionStatusBar({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-muted/50 border-b px-4 py-2 ${className}`}>
      <SessionIndicator 
        showUserInfo={true}
        showRefreshButton={true}
        compact={false}
      />
    </div>
  )
}