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
  // Create independent loading states for each operation
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isEmailLoginLoading, setIsEmailLoginLoading] = useState(false)
  const [isRegisterLoading, setIsRegisterLoading] = useState(false)
  const [isResetPasswordLoading, setIsResetPasswordLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0)
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [lockoutTime, setLockoutTime] = useState(0)
  const [isLocked, setIsLocked] = useState(false)

  // Check account lockout status
  useEffect(() => {
    const checkLockoutStatus = () => {
      if (email) {
        const remainingTime = AuthService.getRemainingLockoutTime(email)
        setLockoutTime(remainingTime)
        setIsLocked(remainingTime > 0)
      }
    }

    checkLockoutStatus()
    
    // If account is locked, update countdown every second
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

  // Clean up countdown timer when component unmounts
  useEffect(() => {
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }
    }
  }, [countdownTimer])

  // Reset form state
  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setSuccessMessage('')
    setAutoCloseCountdown(0)
    if (countdownTimer) {
      clearInterval(countdownTimer)
      setCountdownTimer(null)
    }
    setResetEmailSent(false)
    // Reset all loading states
    setIsGoogleLoading(false)
    setIsEmailLoginLoading(false)
    setIsRegisterLoading(false)
    setIsResetPasswordLoading(false)
  }

  // Handle modal close
  const handleClose = () => {
    // Clean up countdown timer
    if (countdownTimer) {
      clearInterval(countdownTimer)
      setCountdownTimer(null)
    }
    resetForm()
    onClose()
  }

  // Handle success screen close
  const handleSuccessClose = () => {
    // Clean up countdown timer
    if (countdownTimer) {
      clearInterval(countdownTimer)
      setCountdownTimer(null)
    }
    // Close modal directly
    onClose()
    // Delay form reset to ensure modal closes before reset
    setTimeout(() => {
      resetForm()
    }, 100)
  }

  // Format lockout time display
  const formatLockoutTime = (ms: number): string => {
    const minutes = Math.ceil(ms / (60 * 1000))
    return `${minutes} minutes`
  }

  const handleGoogleLogin = async () => {
    try {
      setError('')
      setIsGoogleLoading(true)
      await signInWithGoogle()
      // Google OAuth will redirect to callback page, no need to handle success logic here
      // Modal will close automatically when page redirects
    } catch (error: any) {
      console.error('Google login failed:', error)
      setError(error.message || 'Google login failed, please try again')
      toast.error('Google login failed, please try again')
      setIsGoogleLoading(false)
    }
    // Note: Don't set setIsGoogleLoading(false) in finally block because page will redirect
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please fill in email and password')
      return
    }

    // Check if account is locked
    const remainingTime = AuthService.getRemainingLockoutTime(email)
    if (remainingTime > 0) {
      setError(`Account is locked, please try again after ${formatLockoutTime(remainingTime)}`)
      setIsLocked(true)
      setLockoutTime(remainingTime)
      return
    }

    try {
      setError('')
      setIsEmailLoginLoading(true)
      await signInWithEmail(email, password)
      toast.success('Login successful')
      resetForm()
      onSuccess?.()
    } catch (error: any) {
      console.error('Email login failed:', error)
      
      // Check if it's an account lockout error
      if (error.code === 'account_locked') {
        setError(error.message)
        setIsLocked(true)
        setLockoutTime(AuthService.getRemainingLockoutTime(email))
      } else {
        setError(error.message || 'Login failed, please check your email and password')
      }
      
      toast.error(error.message || 'Login failed, please check your email and password')
    } finally {
      setIsEmailLoginLoading(false)
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
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setError('')
      setIsRegisterLoading(true)
      const result = await signUp(email, password)
      
      // Check registration result
      if (result?.data?.user) {
        // Registration successful, show email confirmation screen
        const userEmail = email
        console.log('Registration successful, email verification required:', userEmail)
        
        // Clear form fields
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        
        // Set success message
        const message = `Registration successful! We have sent a confirmation email to ${userEmail}. Please check your inbox (including spam folder) and click the confirmation link to complete registration.`
        console.log('Setting success message:', message)
        setSuccessMessage(message)
        toast.success('Registration successful! Please check your email for confirmation link')
        
        // Start 5-second countdown for auto-close
        setAutoCloseCountdown(5)
        const timer = setInterval(() => {
          setAutoCloseCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              setCountdownTimer(null)
              handleSuccessClose()
              return 0
            }
            return prev - 1
          })
        }, 1000)
        setCountdownTimer(timer)
      } else {
        // Registration failed
        setError('An unknown error occurred during registration, please try again')
      }
      
    } catch (error: any) {
      console.error('Registration failed:', error)
      setError(error.message || 'Registration failed, please try again')
      toast.error('Registration failed, please try again')
    } finally {
      setIsRegisterLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter email address')
      return
    }

    try {
      setError('')
      setIsResetPasswordLoading(true)
      await resetPassword(email)
      setResetEmailSent(true)
      toast.success('Password reset email sent')
      
      // Auto-close dialog after 3 seconds
      setTimeout(() => {
        handleClose()
      }, 3000)
    } catch (error: any) {
      console.error('Password reset failed:', error)
      setError(error.message || 'Password reset failed, please try again')
      toast.error('Password reset failed, please try again')
    } finally {
      setIsResetPasswordLoading(false)
    }
  }

  // Remove global loading conditional rendering, use local loading overlay instead
  // if (loading) {
  //   return (
  //     <Dialog open={isOpen} onOpenChange={handleClose}>
  //       <DialogContent className="sm:max-w-md">
  //         <div className="flex items-center justify-center py-8">
  //           <Loader2 className="h-8 w-8 animate-spin" />
  //         </div>
  //       </DialogContent>
  //     </Dialog>
  //   )
  // }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Welcome to Subscription Manager</DialogTitle>
          <DialogDescription className="text-center">
            Sign in or register to start managing your subscriptions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 relative">
          {/* Loading overlay - covers entire dialog content */}
          {(isGoogleLoading || isEmailLoginLoading || isRegisterLoading || isResetPasswordLoading) && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isGoogleLoading && 'Signing in with Google...'}
                  {isEmailLoginLoading && 'Signing in...'}
                  {isRegisterLoading && 'Registering...'}
                  {isResetPasswordLoading && 'Sending reset email...'}
                </p>
              </div>
            </div>
          )}

          {/* Registration success screen - covers entire content area */}
          {(() => {
            console.log('Render check - successMessage:', successMessage)
            return successMessage ? (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Mail className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-green-800 dark:text-green-200">
                  Registration Successful!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                  Please check your email and click the confirmation link to complete registration
                </p>
                {autoCloseCountdown > 0 && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This dialog will close automatically in {autoCloseCountdown} seconds
                  </p>
                )}
              </div>
              <Button 
                onClick={handleSuccessClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                {autoCloseCountdown > 0 ? `Got it (${autoCloseCountdown}s)` : 'Got it'}
              </Button>
            </div>
          ) : null
          })()}
          {!successMessage && (
            <>
              {/* Error message display */}
              {error && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Google login button */}
              <Button
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isEmailLoginLoading || isRegisterLoading || isResetPasswordLoading}
                className="w-full"
                variant="outline"
                size="lg"
              >
                {isGoogleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Sign in with Gmail
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                  <TabsTrigger value="reset">Reset Password</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
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
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLocked}
                      />
                    </div>
                    
                    {/* Account lockout notification */}
                    {isLocked && lockoutTime > 0 && (
                      <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                        <AlertDescription className="text-orange-800 dark:text-orange-200">
                          ⚠️ Account is locked, remaining time: {formatLockoutTime(lockoutTime)}
                          <br />
                          <span className="text-sm text-orange-600 dark:text-orange-400">
                            Too many consecutive login failures, please try again later
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isEmailLoginLoading || isLocked || isGoogleLoading || isRegisterLoading || isResetPasswordLoading}
                      size="lg"
                    >
                      {isEmailLoginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLocked ? `Account Locked (${formatLockoutTime(lockoutTime)})` : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="Enter your email address"
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
                        placeholder="Enter password again"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isRegisterLoading || isGoogleLoading || isEmailLoginLoading || isResetPasswordLoading} size="lg">
                      {isRegisterLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="reset" className="space-y-4">
                  {resetEmailSent ? (
                    <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Password reset email has been sent to your mailbox. Please check your email and follow the instructions to reset your password.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="Enter your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isResetPasswordLoading || isGoogleLoading || isEmailLoginLoading || isRegisterLoading} size="lg">
                        {isResetPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Reset Email
                      </Button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}