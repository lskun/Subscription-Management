import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Settings,
  BarChart3,
  CreditCard,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ModeToggle'
import { SessionIndicator } from '@/components/auth/SessionIndicator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut, loading } = useAuth()

  // 调试信息
  console.log('MainLayout - 用户状态:', { user: user?.email, loading })

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const getUserDisplayName = () => {
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name
    }
    if (user?.email) {
      return user.email.split('@')[0]
    }
    return '用户'
  }

  const getUserAvatarFallback = () => {
    const displayName = getUserDisplayName()
    return displayName.charAt(0).toUpperCase()
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between py-4 px-4 sm:px-6">
          <div className="flex items-center gap-6 md:gap-10">
            <Link to="/" className="flex items-center space-x-2">
              <span className="font-bold text-lg sm:text-xl">SubManager</span>
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/dashboard">
              <Button variant={location.pathname === '/dashboard' ? "default" : "ghost"} size="sm" className="px-2 sm:px-3">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>

            <Link to="/subscriptions">
              <Button variant={location.pathname === '/subscriptions' ? "default" : "ghost"} size="sm" className="px-2 sm:px-3">
                <CreditCard className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Subscriptions</span>
              </Button>
            </Link>

            <Link to="/expense-reports">
              <Button variant={location.pathname === '/expense-reports' ? "default" : "ghost"} size="sm" className="px-2 sm:px-3">
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reports</span>
              </Button>
            </Link>



            <Link to="/settings">
              <Button variant={location.pathname === '/settings' ? "default" : "ghost"} size="sm" className="px-2 sm:px-3">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>

            {/* 用户菜单 */}
            {!loading && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt={getUserDisplayName()} />
                      <AvatarFallback>{getUserAvatarFallback()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings?tab=profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>个人资料</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings?tab=preferences')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>偏好设置</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 加载状态指示器 */}
            {loading && (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            )}

            <div className="hidden md:block">
              <SessionIndicator 
                showUserInfo={false}
                showRefreshButton={true}
                compact={true}
              />
            </div>
            
            <ModeToggle />
          </div>
        </div>
      </header>
      
      <main className="container py-4 sm:py-6 px-4 sm:px-6 flex-grow">{children}</main>
      
      <footer className="border-t py-4 sm:py-6">
        <div className="container flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6 px-4 sm:px-6">
          <p className="text-center text-sm leading-loose text-muted-foreground">
            &copy; {new Date().getFullYear()} SubManager. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
