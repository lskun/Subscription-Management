import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface SessionTimeoutWarningProps {
  warningThreshold?: number // 提前多少毫秒显示警告，默认5分钟
  autoRefreshThreshold?: number // 自动刷新阈值，默认2分钟
  enableAutoRefresh?: boolean // 是否启用自动刷新
}

export function SessionTimeoutWarning({ 
  warningThreshold = 5 * 60 * 1000, // 5分钟
  autoRefreshThreshold = 2 * 60 * 1000, // 2分钟
  enableAutoRefresh = true
}: SessionTimeoutWarningProps) {
  const { 
    isSessionValid, 
    timeUntilExpiry, 
    refreshSession,
    signOut
  } = useAuth()

  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshed, setAutoRefreshed] = useState(false)

  // 监听会话过期时间
  useEffect(() => {
    if (!isSessionValid || !timeUntilExpiry) {
      setShowWarning(false)
      setAutoRefreshed(false)
      return
    }

    // 检查是否需要显示警告
    if (timeUntilExpiry <= warningThreshold && timeUntilExpiry > 0) {
      setShowWarning(true)
      setCountdown(timeUntilExpiry)
    } else {
      setShowWarning(false)
    }

    // 自动刷新逻辑
    if (enableAutoRefresh && 
        timeUntilExpiry <= autoRefreshThreshold && 
        timeUntilExpiry > 0 && 
        !autoRefreshed) {
      handleAutoRefresh()
    }
  }, [isSessionValid, timeUntilExpiry, warningThreshold, autoRefreshThreshold, enableAutoRefresh, autoRefreshed])

  // 倒计时更新
  useEffect(() => {
    if (!showWarning || !timeUntilExpiry) return

    const timer = setInterval(() => {
      const remaining = timeUntilExpiry
      if (remaining <= 0) {
        setShowWarning(false)
        setCountdown(0)
        // 会话已过期，自动登出
        handleSessionExpired()
      } else {
        setCountdown(remaining)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [showWarning, timeUntilExpiry])

  const handleAutoRefresh = async () => {
    if (refreshing || autoRefreshed) return

    console.log('自动刷新会话...')
    setRefreshing(true)
    setAutoRefreshed(true)

    try {
      const success = await refreshSession()
      if (success) {
        toast.success('会话已自动延长')
        setShowWarning(false)
      } else {
        toast.error('自动刷新失败，请手动刷新')
      }
    } catch (error) {
      console.error('自动刷新失败:', error)
      toast.error('自动刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      const success = await refreshSession()
      if (success) {
        toast.success('会话已刷新')
        setShowWarning(false)
        setAutoRefreshed(true)
      } else {
        toast.error('会话刷新失败')
      }
    } catch (error) {
      console.error('手动刷新失败:', error)
      toast.error('会话刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSessionExpired = async () => {
    console.log('会话已过期，自动登出')
    try {
      await signOut()
      toast.error('会话已过期，请重新登录')
    } catch (error) {
      console.error('自动登出失败:', error)
    }
  }

  const handleContinueSession = () => {
    handleManualRefresh()
  }

  const handleLogout = async () => {
    try {
      await signOut()
      toast.success('已安全登出')
    } catch (error) {
      console.error('登出失败:', error)
      toast.error('登出失败')
    }
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getProgressValue = (): number => {
    if (!countdown || countdown <= 0) return 0
    return Math.max(0, Math.min(100, (countdown / warningThreshold) * 100))
  }



  // 监听全局会话事件
  useEffect(() => {
    const handleSessionTimeout = () => {
      setShowWarning(false)
      toast.error('会话因长时间无活动而超时')
    }

    const handleSessionExpired = (event: CustomEvent) => {
      setShowWarning(false)
      const { reason } = event.detail
      if (reason === 'token_refresh_failed') {
        toast.error('会话已过期，请重新登录')
      }
    }

    window.addEventListener('sessionTimeout', handleSessionTimeout)
    window.addEventListener('sessionExpired', handleSessionExpired as EventListener)

    return () => {
      window.removeEventListener('sessionTimeout', handleSessionTimeout)
      window.removeEventListener('sessionExpired', handleSessionExpired as EventListener)
    }
  }, [])

  if (!showWarning || !isSessionValid) {
    return null
  }

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            会话即将过期
          </DialogTitle>
          <DialogDescription>
            您的登录会话即将过期，请选择继续使用或安全登出。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 倒计时显示 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-mono font-bold text-orange-600">
                {formatTime(countdown)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              剩余时间
            </p>
          </div>

          {/* 进度条 */}
          <div className="space-y-2">
            <Progress 
              value={getProgressValue()} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>会话过期</span>
              <span>安全时间</span>
            </div>
          </div>

          {/* 自动刷新状态 */}
          {enableAutoRefresh && (
            <div className="text-center text-sm text-muted-foreground">
              {autoRefreshed ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <RefreshCw className="h-4 w-4" />
                  <span>已自动延长会话</span>
                </div>
              ) : countdown <= autoRefreshThreshold ? (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>正在自动延长会话...</span>
                </div>
              ) : (
                <span>会话将在 {formatTime(autoRefreshThreshold)} 时自动延长</span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            安全登出
          </Button>
          <Button
            onClick={handleContinueSession}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            {refreshing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                延长中...
              </>
            ) : (
              '继续使用'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}