import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard, 
  BarChart3, 
  Calendar, 
  Shield, 
  Zap, 
  CheckCircle,
  ArrowRight,
  Star,
  Globe,
  Smartphone,
  TrendingUp,
  User,
  LogOut,
  Settings
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LoginModal } from '@/components/auth/LoginModal'

// Product features data
const features = [
  {
    icon: CreditCard,
    title: 'Smart Subscription Management',
    description: 'Easily add, edit, and track all your subscription services with support for multiple billing cycles and currencies'
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    description: 'Detailed expense analysis, trend charts, and category statistics to make your spending crystal clear'
  },
  {
    icon: Calendar,
    title: 'Smart Renewal Reminders',
    description: 'Automatic notifications for upcoming renewals to avoid unexpected charges and service interruptions'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level data encryption and privacy protection to keep your financial information absolutely secure'
  },
  {
    icon: Globe,
    title: 'Multi-Currency Support',
    description: 'Support for 7+ major currencies with real-time exchange rates for global users'
  },
  {
    icon: Smartphone,
    title: 'Responsive Design',
    description: 'Perfect compatibility across mobile, tablet, and desktop devices for management anywhere'
  }
]

// User testimonials data
const testimonials = [
  {
    name: 'Alex Chen',
    role: 'Freelancer',
    content: 'This tool helped me save 30% on monthly subscription costs. I never forget to cancel unused services anymore!',
    rating: 5
  },
  {
    name: 'Sarah Johnson',
    role: 'Entrepreneur',
    content: 'Perfect for managing all my business subscriptions. The analytics feature is incredibly helpful.',
    rating: 5
  },
  {
    name: 'Michael Rodriguez',
    role: 'Product Manager',
    content: 'Clean interface, powerful features. Our entire team is using it now. Highly recommended!',
    rating: 5
  }
]

// Product screenshots data
const screenshots = [
  {
    title: 'Dashboard Overview',
    description: 'Clear expense statistics and subscription status at a glance',
    image: '/api/placeholder/600/400'
  },
  {
    title: 'Subscription Management',
    description: 'Simple and intuitive subscription adding and editing interface',
    image: '/api/placeholder/600/400'
  },
  {
    title: 'Analytics & Reports',
    description: 'Rich charts and trend analysis for better insights',
    image: '/api/placeholder/600/400'
  }
]

export function LandingPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()

  // Debug information
  useEffect(() => {
    console.log('LandingPage - User status:', { 
      user: user?.email || 'undefined', 
      loading,
      hasUser: !!user,
      userObject: user ? { id: user.id, email: user.email } : null
    })
  }, [user, loading])

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false)
    navigate('/dashboard')
  }

  // 移除全局loading状态的条件渲染，改为在组件内部显示loading状态
  // 这样可以避免在用户进行注册、登录等操作时整个页面被loading界面替换
  // if (loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
  //         <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                SubManager
              </span>
            </div>
            
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Badge in navigation for logged in users - 调整大小和字体 */}
                <div className="items-center rounded-md px-3 py-2 text-sm font-semibold hidden sm:flex h-8">
                  👋 Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0]}!
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative h-12 w-12 rounded-full p-0 overflow-hidden">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.user_metadata?.full_name || 'User'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={async () => {
                        try {
                          await signOut()
                          window.location.reload()
                        } catch (error) {
                          console.error('Sign out failed:', error)
                        }
                      }}
                      className="text-red-600 dark:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                
                <Button 
                  onClick={() => setIsLoginModalOpen(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Take Control of Your
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 block sm:inline">
                {' '}Subscriptions
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Stop subscription chaos. Track, analyze, and optimize all your recurring payments 
              in one beautiful dashboard. Make every dollar count.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
            {user ? (
              <>
                <Button 
                  size="lg" 
                  onClick={() => navigate('/dashboard')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-2.5"
                >
                  Learn More
                </Button>
              </>
            ) : (
              <>
                <Button 
                  size="lg" 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-2.5"
                >
                  View Features
                </Button>
              </>
            )}
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-300 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>100% Free</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-300 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>No Credit Card</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-gray-600 dark:text-gray-300 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Start Instantly</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 bg-white dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Powerful Features, Simple Design
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to manage subscriptions efficiently in one clean, intuitive interface
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
                    <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Clean Interface, Clear Insights
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Thoughtfully designed interface that makes complex data simple to understand
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {screenshots.map((screenshot, index) => (
              <Card key={index} className="overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200">
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Preview</p>
                  </div>
                </div>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                    {screenshot.title}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-300">
                    {screenshot.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 bg-white dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Loved by Users Worldwide
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              See what our users have to say about their experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-1 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <CardDescription className="text-gray-600 dark:text-gray-300 text-sm italic leading-relaxed">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Completely Free Forever
          </h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            We believe everyone deserves great subscription management. Sign up now and enjoy all features at no cost.
          </p>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-auto shadow-2xl">
            <div className="mb-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                $0
                <span className="text-base font-normal text-gray-600 dark:text-gray-300">/month</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Forever free</p>
            </div>
            
            <ul className="space-y-2.5 mb-6 text-left">
              <li className="flex items-center space-x-2.5">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Unlimited subscriptions</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Advanced analytics</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Smart renewal alerts</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Multi-currency support</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Data import & export</span>
              </li>
            </ul>
            
            <Button 
              onClick={user ? () => navigate('/dashboard') : () => setIsLoginModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {user ? 'Go to Dashboard' : 'Get Started Free'}
              <Zap className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold">SubManager</span>
              </div>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                Professional subscription management tool that helps you easily track and optimize 
                all your recurring services for better financial control.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3 text-sm">Product</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">User Guide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-3 text-sm">Support</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-gray-400 text-sm">
            <p>&copy; 2025 SubManager. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* 登录模态框 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  )
}