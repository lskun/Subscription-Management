import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AuthService } from '@/services/authService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signInWithGoogle, signInWithEmail, signUp, resetPassword, loading } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [lockoutTime, setLockoutTime] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  // 获取重定向路径
  const from = location.state?.from?.pathname || '/dashboard'

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

  // 格式化锁定时间显示
  const formatLockoutTime = (ms: number): string => {
    const minutes = Math.ceil(ms / (60 * 1000))
    return `${minutes} minute`
  }

  const handleGoogleLogin = async () => {
    try {
      setError('')
      setIsLoading(true)
      await signInWithGoogle()
      // Google OAuth会重定向，不需要手动导航
    } catch (error: any) {
      setError(error.message || 'Google login failed，Please retry')
      toast.error('Google login failed，Please retry')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }

    // 检查账户是否被锁定
    const remainingTime = AuthService.getRemainingLockoutTime(email)
    if (remainingTime > 0) {
      setError(`Account is locked. Please try again after ${formatLockoutTime(remainingTime)}`)
      setIsLocked(true)
      setLockoutTime(remainingTime)
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await signInWithEmail(email, password)
      toast.success('Login successful')
      navigate(from, { replace: true })
    } catch (error: any) {
      console.error('Email login failed:', error)
      
      // 检查是否是账户锁定错误
      if (error.code === 'account_locked') {
        setError(error.message)
        setIsLocked(true)
        setLockoutTime(AuthService.getRemainingLockoutTime(email))
      } else {
        setError(error.message || 'Login failed, please check your email and password')
      }
      
      toast.error(error.message || 'Login failed, please check your email and password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await signUp(email, password)
      
      // 注册成功提示
      toast.success('Registration successful! Welcome to the Subscription Manager')
      
      // 导航到主页面
      navigate(from, { replace: true })
      
    } catch (error: any) {
      console.error('Registration failed:', error)
      setError(error.message || 'Registration failed, please try again')
      toast.error('Registration failed, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    try {
      setError('')
      setIsLoading(true)
      await resetPassword(email)
      setResetEmailSent(true)
      toast.success('Password reset email sent')
    } catch (error: any) {
      console.error('Password reset failed:', error)
      setError(error.message || 'Password reset failed, please try again')
      toast.error('Password reset failed, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Welcome to the Subscription Manager</CardTitle>
          <CardDescription className="text-center">
            Login or register to start managing your subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Google登录按钮 */}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full mb-4"
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Sign in with Gmail
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="reset">Reset Password</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Password</Label>
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
                      ⚠️ Account locked, remaining time: {formatLockoutTime(lockoutTime)}
                      <br />
                      <span className="text-sm text-orange-600 dark:text-orange-400">
                        Please try again after {formatLockoutTime(lockoutTime)}
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || isLocked}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLocked ? `Account locked (${formatLockoutTime(lockoutTime)})` : 'Login'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
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
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register  
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              {resetEmailSent ? (
                <Alert>
                  <AlertDescription>
                    Password reset email sent to your email, please check your email and follow the instructions to reset your password.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Email
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}