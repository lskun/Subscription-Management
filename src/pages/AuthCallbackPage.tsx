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
    const [message, setMessage] = useState('Processing login...')
  const [processed, setProcessed] = useState(false)

  // 处理认证回调（包括OAuth和邮箱验证）
  useEffect(() => {
    if (processed) return

    const handleAuthCallback = async () => {
      try {
        console.log('开始处理认证回调...')
        console.log('当前URL:', window.location.href)

        setProcessed(true)
        
        // 检查URL参数来确定回调类型
        const urlParams = new URLSearchParams(window.location.search)
        const type = urlParams.get('type')
        const token = urlParams.get('token')
        
        if (type === 'signup' && token) {
          // 邮箱验证回调
          setMessage('Processing email verification...')
          console.log('检测到邮箱验证回调')
          
          // 让Supabase处理邮箱验证
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // 检查验证结果
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('邮箱验证失败:', error)
            setStatus('error')
            setMessage('Processing email verification failed, please try again')
            toast.error('Email verification failed: ' + error.message)
            
            setTimeout(() => {
              navigate('/', { replace: true })
            }, 3000)
            return
          }
          
          if (session?.user) {
            console.log('邮箱验证成功:', session.user.email)
            setStatus('success')
            setMessage('Processing email verification successful, logging in...')
            toast.success('Email verification successful! Welcome to Subscription Manager')
            
            // 短暂延迟后重定向到dashboard
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 1500)
          } else {
            console.log('Email verification completed, but no session obtained, waiting for AuthContext update...')
            setMessage('Processing login...')
          }
        } else {
          // OAuth回调
          setMessage('Processing OAuth authentication...')
          console.log('检测到OAuth回调')
          
          // 让Supabase自动处理URL中的认证参数
          await new Promise(resolve => setTimeout(resolve, 3000))

          // 检查是否有会话
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            console.error('获取会话失败:', error)
            setStatus('error')
            setMessage('Processing OAuth authentication failed, please try again')
            toast.error('Authentication failed: ' + error.message)

            setTimeout(() => {
              navigate('/', { replace: true })
            }, 3000)
            return
          }

          if (session?.user) {
            console.log('OAuth登录成功:', session.user.email)
            setStatus('success')
            setMessage('Processing OAuth authentication successful, redirecting...')
            toast.success('Login successful!')

            // 短暂延迟后重定向到dashboard
            setTimeout(() => {
              navigate('/dashboard', { replace: true })
            }, 1500)
          } else {
            console.log('OAuth authentication completed, but no session obtained, waiting for AuthContext update...')
            setMessage('Processing login...')
          }
        }

      } catch (error) {
        console.error('处理认证回调失败:', error)
        setStatus('error')
        setMessage('Processing authentication callback failed, please try again')
        toast.error('Authentication failed, please try again')

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
      setMessage('Processing login successful, initializing...')

      // 等待一小段时间确保所有状态都已同步
      setTimeout(async () => {
        try {
          // 尝试初始化用户设置
          const { useSettingsStore } = await import('@/store/settingsStore')
          await useSettingsStore.getState().fetchSettings()

          toast.success('Welcome back!')
          setMessage('Initialization completed, redirecting...')

          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1000)
        } catch (error) {
          console.warn('Initialization of user settings failed, but continuing login process:', error)
          toast.success('Welcome back!')
          navigate('/dashboard', { replace: true })
        }
      }, 500)
    }
  }, [user, loading, status, navigate])

  // 超时处理
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.warn('OAuth callback processing timeout')
        console.log('Current state:', { status, user: user?.email, loading })
        setStatus('error')
        setMessage('Processing login timeout, please try again')
        toast.error('Processing login timeout, please try again')

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
            {status === 'loading' && 'Processing login'}
            {status === 'success' && 'Login successful'}
            {status === 'error' && 'Login failed'}
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
                Please wait, processing your authentication...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Redirecting to home page in a few seconds...
              </p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Redirect now
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Redirecting to dashboard...
              </p>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Redirect now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}