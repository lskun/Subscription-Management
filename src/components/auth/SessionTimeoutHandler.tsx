import { useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface SessionTimeoutHandlerProps {
  redirectPath?: string // 会话超时后重定向的路径，默认为 '/login'
  showToast?: boolean // 是否显示超时提示，默认为 true
  onTimeout?: () => void // 超时回调函数
  onExpired?: (reason: string) => void // 会话过期回调函数
}

/**
 * 会话超时处理组件
 * 监听会话超时和过期事件，自动处理用户登出和页面重定向
 */
export function SessionTimeoutHandler({
  redirectPath = '/login',
  showToast = true,
  onTimeout,
  onExpired
}: SessionTimeoutHandlerProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  // 处理会话超时
  const handleSessionTimeout = useCallback(async () => {
    console.log('会话超时处理开始')
    
    try {
      // 执行自定义超时回调
      if (onTimeout) {
        onTimeout()
      }

      // 显示超时提示
      if (showToast) {
        toast.error('会话已超时，请重新登录', {
          duration: 5000,
          description: '由于长时间无活动，您的会话已自动过期'
        })
      }

      // 安全登出
      await signOut()

      // 重定向到登录页面
      navigate(redirectPath, { replace: true })
    } catch (error) {
      console.error('处理会话超时失败:', error)
      
      // 即使登出失败，也要重定向到登录页面
      navigate(redirectPath, { replace: true })
    }
  }, [onTimeout, showToast, signOut, navigate, redirectPath])

  // 处理会话过期
  const handleSessionExpired = useCallback(async (event: CustomEvent) => {
    const { reason } = event.detail
    console.log('会话过期处理开始:', reason)
    
    try {
      // 执行自定义过期回调
      if (onExpired) {
        onExpired(reason)
      }

      // 根据过期原因显示不同的提示
      if (showToast) {
        switch (reason) {
          case 'token_refresh_failed':
            toast.error('会话已过期，请重新登录', {
              duration: 5000,
              description: 'Token刷新失败，需要重新验证身份'
            })
            break
          case 'invalid_token':
            toast.error('登录状态异常，请重新登录', {
              duration: 5000,
              description: '检测到无效的认证信息'
            })
            break
          case 'security_violation':
            toast.error('安全验证失败，请重新登录', {
              duration: 5000,
              description: '检测到可疑活动，为了您的安全请重新登录'
            })
            break
          default:
            toast.error('会话已过期，请重新登录', {
              duration: 5000,
              description: '您的登录状态已失效'
            })
        }
      }

      // 安全登出
      await signOut()

      // 重定向到登录页面
      navigate(redirectPath, { replace: true })
    } catch (signOutError) {
      console.error('处理会话过期失败:', signOutError)
      
      // 即使登出失败，也要重定向到登录页面
      navigate(redirectPath, { replace: true })
    }
  }, [onExpired, showToast, signOut, navigate, redirectPath])

  // 监听全局会话事件
  useEffect(() => {
    // 监听会话超时事件
    const handleTimeout = () => {
      handleSessionTimeout()
    }

    // 监听会话过期事件
    const handleExpired = (event: Event) => {
      handleSessionExpired(event as CustomEvent)
    }

    // 添加事件监听器
    window.addEventListener('sessionTimeout', handleTimeout)
    window.addEventListener('sessionExpired', handleExpired)

    return () => {
      // 清理事件监听器
      window.removeEventListener('sessionTimeout', handleTimeout)
      window.removeEventListener('sessionExpired', handleExpired)
    }
  }, [handleSessionTimeout, handleSessionExpired])

  // 监听页面可见性变化
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时，检查会话状态
        console.log('页面重新可见，检查会话状态')
        // 这里可以添加会话状态检查逻辑
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // 监听网络状态变化
  useEffect(() => {
    const handleOnline = () => {
      console.log('网络连接恢复')
      // 网络恢复时可以尝试验证会话状态
    }

    const handleOffline = () => {
      console.log('网络连接断开')
      // 网络断开时的处理逻辑
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 这个组件不渲染任何UI，只处理事件
  return null
}

// 高阶组件版本，用于包装需要会话保护的组件
export function withSessionTimeout<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: SessionTimeoutHandlerProps
) {
  return function SessionTimeoutWrapper(props: P) {
    return (
      <>
        <SessionTimeoutHandler {...options} />
        <WrappedComponent {...props} />
      </>
    )
  }
}

// Hook版本，用于在组件中使用会话超时处理
export function useSessionTimeout(options?: SessionTimeoutHandlerProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleTimeout = useCallback(async () => {
    try {
      if (options?.onTimeout) {
        options.onTimeout()
      }

      if (options?.showToast !== false) {
        toast.error('会话已超时，请重新登录')
      }

      await signOut()
      navigate(options?.redirectPath || '/login', { replace: true })
    } catch (error) {
      console.error('处理会话超时失败:', error)
      navigate(options?.redirectPath || '/login', { replace: true })
    }
  }, [options, signOut, navigate])

  const handleExpired = useCallback(async (reason: string) => {
    try {
      if (options?.onExpired) {
        options.onExpired(reason)
      }

      if (options?.showToast !== false) {
        toast.error('会话已过期，请重新登录')
      }

      await signOut()
      navigate(options?.redirectPath || '/login', { replace: true })
    } catch (error) {
      console.error('处理会话过期失败:', error)
      navigate(options?.redirectPath || '/login', { replace: true })
    }
  }, [options, signOut, navigate])

  return {
    handleTimeout,
    handleExpired
  }
}