import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthService } from '@/services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { signInWithGoogle, signInWithEmail, signUp, resetPassword, loading } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [lockoutTime, setLockoutTime] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  // 检查账户锁定状态
  useEffect(() => {
    const checkLockoutStatus = () => {
      if (email) {
        const remainingTime = AuthService.getRemainingLockoutTime(email)
        setLockoutTime(remainingTime)
        setIsLocked(remainingTime > 0)
      }
    }

    checkLockoutStatus()
    
    // 如果账户被锁定，每秒更新倒计时
    let timer: NodeJS.Timeout
    if (isLocked && lockoutTime > 0) {
      timer = setInterval(() => {
        const remainingTime = AuthService.getRemainingLockoutTime(email)
        setLockoutTime(remainingTime)
        if (remainingTime <= 0) {
          setIsLocked(false)
        }
      }, 1000)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [email, isLocked, lockoutTime])

  // 重置表单状态
  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setResetEmailSent(false)
    setIsLoading(false)
  }

  // 处理模态框关闭
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // 格式化锁定时间显示
  const formatLockoutTime = (ms: number): string => {
    const minutes = Math.ceil(ms / (60 * 1000))
    return `${minutes} 分钟`
  }

  const handleGoogleLogin = async () => {
    try {
      setError('')
      setIsLoading(true)
      await signInWithGoogle()
      // Google OAuth会重定向到回调页面，不需要在这里处理成功逻辑
      // 模态框会在页面重定向时自动关闭
    } catch (error: any) {
      console.error('Google登录失败:', error)
      setError(error.message || 'Google登录失败，请重试')
      toast.error('Google登录失败，请重试')
      setIsLoading(false)
    }
    // 注意：不在finally中设置setIsLoading(false)，因为页面会重定向
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('请填写邮箱和密码')
      return
    }

    // 检查账户是否被锁定
    const remainingTime = AuthService.getRemainingLockoutTime(email)
    if (remainingTime > 0) {
      setError(`账户已被锁定，请在 ${formatLockoutTime(remainingTime)} 后重试`)
      setIsLocked(true)
      setLockoutTime(remainingTime)
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await signInWithEmail(email, password)
      toast.success('登录成功')
      resetForm()
      onSuccess?.()
    } catch (error: any) {
      console.error('邮箱登录失败:', error)
      
      // 检查是否是账户锁定错误
      if (error.code === 'account_locked') {
        setError(error.message)
        setIsLocked(true)
        setLockoutTime(AuthService.getRemainingLockoutTime(email))
      } else {
        setError(error.message || '登录失败，请检查邮箱和密码')
      }
      
      toast.error(error.message || '登录失败，请检查邮箱和密码')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password || !confirmPassword) {
      setError('请填写所有必填字段')
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少为6位')
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await signUp(email, password)
      toast.success('注册成功，请检查邮箱验证链接')
      setError('注册成功！请检查您的邮箱并点击验证链接完成注册。')
    } catch (error: any) {
      console.error('注册失败:', error)
      setError(error.message || '注册失败，请重试')
      toast.error('注册失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('请输入邮箱地址')
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await resetPassword(email)
      setResetEmailSent(true)
      toast.success('密码重置邮件已发送')
    } catch (error: any) {
      console.error('密码重置失败:', error)
      setError(error.message || '密码重置失败，请重试')
      toast.error('密码重置失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">欢迎使用订阅管理器</DialogTitle>
          <DialogDescription className="text-center">
            登录或注册以开始管理您的订阅
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert className={error.includes('注册成功') ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : ''}>
              <AlertDescription className={error.includes('注册成功') ? 'text-green-800 dark:text-green-200' : ''}>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Google登录按钮 */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full"
            variant="outline"
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            使用Gmail登录
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
              <TabsTrigger value="reset">重置密码</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLocked}
                  />
                </div>
                
                {/* 账户锁定提示 */}
                {isLocked && lockoutTime > 0 && (
                  <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                    <AlertDescription className="text-orange-800 dark:text-orange-200">
                      ⚠️ 账户已被锁定，剩余时间：{formatLockoutTime(lockoutTime)}
                      <br />
                      <span className="text-sm text-orange-600 dark:text-orange-400">
                        连续登录失败次数过多，请稍后重试
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || isLocked}
                  size="lg"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLocked ? `账户已锁定 (${formatLockoutTime(lockoutTime)})` : '登录'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">邮箱</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">密码</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="至少6位字符"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  注册
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset" className="space-y-4">
              {resetEmailSent ? (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    密码重置邮件已发送到您的邮箱，请检查邮件并按照说明重置密码。
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">邮箱</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    发送重置邮件
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}