import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('正在处理登录...')
  const [processed, setProcessed] = useState(false)

  // 处理OAuth回调
  useEffect(() => {
    if (processed) return

    const handleAuthCallback = async () => {
      try {
        console.log('开始处理OAuth回调...')
        console.log('当前URL:', window.location.href)

        setProcessed(true)
        setMessage('正在处理认证...')

        // 让Supabase自动处理URL中的认证参数
        // Supabase会自动检测URL中的code参数并处理OAuth回调
        console.log('等待Supabase自动处理OAuth回调...')

        // 等待一段时间让Supabase处理
        await new Promise(resolve => setTimeout(resolve, 3000))

        // 检查是否有会话
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('获取会话失败:', error)
          setStatus('error')
          setMessage('认证失败，请重试')
          toast.error('认证失败：' + error.message)

          setTimeout(() => {
            navigate('/', { replace: true })
          }, 3000)
          return
        }

        if (session?.user) {
          console.log('OAuth登录成功:', session.user.email)
          setStatus('success')
          setMessage('登录成功，正在跳转...')
          toast.success('登录成功！')

          // 短暂延迟后重定向到dashboard
          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1500)
        } else {
          console.log('未获取到会话，等待AuthContext更新...')
          setMessage('正在完成登录...')
        }

      } catch (error) {
        console.error('处理OAuth回调失败:', error)
        setStatus('error')
        setMessage('登录过程中出现错误')
        toast.error('登录失败，请重试')

        setTimeout(() => {
          navigate('/', { replace: true })
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [navigate, processed])

  // 监听用户状态变化
  useEffect(() => {
    if (!loading && user && status === 'loading') {
      console.log('检测到用户登录成功:', user.email)
      setStatus('success')
      setMessage('登录成功，正在初始化...')

      // 等待一小段时间确保所有状态都已同步
      setTimeout(async () => {
        try {
          // 尝试初始化用户设置
          const { useSettingsStore } = await import('@/store/settingsStore')
          await useSettingsStore.getState().fetchSettings()

          toast.success('欢迎回来！')
          setMessage('初始化完成，正在跳转...')

          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1000)
        } catch (error) {
          console.warn('设置初始化失败，但继续登录流程:', error)
          toast.success('欢迎回来！')
          navigate('/dashboard', { replace: true })
        }
      }, 500)
    }
  }, [user, loading, status, navigate])

  // 超时处理
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.warn('OAuth回调处理超时')
        console.log('当前状态:', { status, user: user?.email, loading })
        setStatus('error')
        setMessage('登录超时，请重试')
        toast.error('登录超时，请重试')

        setTimeout(() => {
          navigate('/', { replace: true })
        }, 2000)
      }
    }, 20000) // 增加到20秒超时

    return () => clearTimeout(timeout)
  }, [status, navigate, user, loading])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            {getStatusIcon()}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {status === 'loading' && '正在登录'}
            {status === 'success' && '登录成功'}
            {status === 'error' && '登录失败'}
          </h1>

          <p className={`text-lg ${getStatusColor()} mb-6`}>
            {message}
          </p>

          {status === 'loading' && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                请稍候，正在验证您的身份...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                将在几秒后自动返回首页
              </p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                立即返回
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                正在跳转到控制面板...
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                立即跳转
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}