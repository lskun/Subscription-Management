import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SessionManager } from './SessionManager'
import { SessionIndicator, SessionStatusIcon, SessionStatusBar } from './SessionIndicator'
import { SessionTimeoutWarning } from './SessionTimeoutWarning'
import { SessionStatus } from './SessionStatus'
import { useSessionMonitor } from '@/hooks/useSessionMonitor'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

/**
 * 会话管理组件使用示例
 * 展示如何在应用中集成各种会话管理功能
 */
export function SessionManagementExample() {
  const { user, isSessionValid } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  
  // 使用会话监控Hook
  const {
    isHealthy,
    issues,
    recommendations,
    needsAttention,
    isChecking,
    checkHealth,
    manualRefresh,
    recoverSessionManagement
  } = useSessionMonitor({
    checkInterval: 30000, // 30秒检查一次
    autoRefresh: true,
    warningThreshold: 5 * 60 * 1000 // 5分钟警告阈值
  })

  const handleHealthCheck = async () => {
    await checkHealth()
    toast.success('健康检查完成')
  }

  const handleManualRefresh = async () => {
    const success = await manualRefresh()
    if (success) {
      toast.success('会话刷新成功')
    } else {
      toast.error('会话刷新失败')
    }
  }

  const handleRecover = async () => {
    const success = await recoverSessionManagement()
    if (success) {
      toast.success('会话管理已恢复')
    } else {
      toast.error('恢复失败')
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            请先登录以查看会话管理示例
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>会话管理系统示例</CardTitle>
          <CardDescription>
            展示各种会话管理组件的使用方法和功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant={isSessionValid ? 'default' : 'destructive'}>
              {isSessionValid ? '会话有效' : '会话无效'}
            </Badge>
            <Badge variant={isHealthy ? 'default' : 'destructive'}>
              {isHealthy ? '健康' : '异常'}
            </Badge>
            {needsAttention && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                需要关注
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleHealthCheck}
              disabled={isChecking}
            >
              {isChecking ? '检查中...' : '健康检查'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
            >
              手动刷新
            </Button>
            {!isHealthy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecover}
              >
                恢复管理
              </Button>
            )}
          </div>

          {issues.length > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
              <h4 className="font-medium text-orange-800 mb-2">检测到问题:</h4>
              <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                {issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
              {recommendations.length > 0 && (
                <div className="mt-2">
                  <h5 className="font-medium text-orange-800">建议:</h5>
                  <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                    {recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="indicators">指示器</TabsTrigger>
          <TabsTrigger value="manager">管理器</TabsTrigger>
          <TabsTrigger value="status">状态</TabsTrigger>
          <TabsTrigger value="warning">警告</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>会话概览</CardTitle>
              <CardDescription>
                显示当前会话的基本信息和状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionStatusBar />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>会话指示器</CardTitle>
              <CardDescription>
                不同样式的会话状态指示器
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">完整指示器</h4>
                <SessionIndicator 
                  showUserInfo={true}
                  showRefreshButton={true}
                  compact={false}
                />
              </div>

              <div>
                <h4 className="font-medium mb-2">紧凑指示器</h4>
                <SessionIndicator 
                  showUserInfo={false}
                  showRefreshButton={false}
                  compact={true}
                />
              </div>

              <div>
                <h4 className="font-medium mb-2">状态图标</h4>
                <SessionStatusIcon />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manager" className="space-y-4">
          <SessionManager 
            showHealthCheck={true}
            showDetailedInfo={true}
            autoRefresh={false}
          />
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SessionStatus showDetails={false} />
            <SessionStatus showDetails={true} />
          </div>
        </TabsContent>

        <TabsContent value="warning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>会话超时警告</CardTitle>
              <CardDescription>
                当会话即将过期时显示的警告对话框
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  会话超时警告组件会在会话即将过期时自动显示。
                  您可以配置以下参数：
                </p>
                
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><code>warningThreshold</code>: 提前多少毫秒显示警告（默认5分钟）</li>
                  <li><code>autoRefreshThreshold</code>: 自动刷新阈值（默认2分钟）</li>
                  <li><code>enableAutoRefresh</code>: 是否启用自动刷新（默认true）</li>
                </ul>

                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm">
                    {`<SessionTimeoutWarning 
  warningThreshold={5 * 60 * 1000}
  autoRefreshThreshold={2 * 60 * 1000}
  enableAutoRefresh={true}
/>`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 会话超时警告组件 - 始终渲染，会根据会话状态自动显示/隐藏 */}
      <SessionTimeoutWarning 
        warningThreshold={5 * 60 * 1000}
        autoRefreshThreshold={2 * 60 * 1000}
        enableAutoRefresh={true}
      />
    </div>
  )
}

/**
 * 使用指南组件
 */
export function SessionManagementGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>会话管理使用指南</CardTitle>
        <CardDescription>
          如何在您的应用中集成和使用会话管理功能
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">1. 基础设置</h3>
          <p className="text-sm text-muted-foreground mb-2">
            在应用根组件中包装AuthProvider：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { AuthProvider } from '@/contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      {/* 您的应用内容 */}
    </AuthProvider>
  )
}`}
            </code>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">2. 使用认证Hook</h3>
          <p className="text-sm text-muted-foreground mb-2">
            在组件中使用useAuth Hook：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, isSessionValid, refreshSession } = useAuth()
  
  // 使用认证状态和方法
}`}
            </code>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">3. 会话监控</h3>
          <p className="text-sm text-muted-foreground mb-2">
            使用useSessionMonitor Hook监控会话健康状态：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { useSessionMonitor } from '@/hooks/useSessionMonitor'

function MyComponent() {
  const { isHealthy, needsAttention, checkHealth } = useSessionMonitor({
    checkInterval: 30000,
    autoRefresh: true
  })
}`}
            </code>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">4. 添加会话指示器</h3>
          <p className="text-sm text-muted-foreground mb-2">
            在导航栏或状态栏中显示会话状态：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { SessionIndicator } from '@/components/auth/SessionIndicator'

function Navbar() {
  return (
    <nav>
      {/* 其他导航内容 */}
      <SessionIndicator showUserInfo={true} showRefreshButton={true} />
    </nav>
  )
}`}
            </code>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">5. 会话超时警告</h3>
          <p className="text-sm text-muted-foreground mb-2">
            在应用中添加会话超时警告：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning'

function App() {
  return (
    <div>
      {/* 应用内容 */}
      <SessionTimeoutWarning />
    </div>
  )
}`}
            </code>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">6. 高级会话管理</h3>
          <p className="text-sm text-muted-foreground mb-2">
            在设置页面或管理界面中使用完整的会话管理器：
          </p>
          <div className="bg-muted p-3 rounded-md">
            <code className="text-sm">
{`import { SessionManager } from '@/components/auth/SessionManager'

function SettingsPage() {
  return (
    <div>
      <SessionManager 
        showHealthCheck={true}
        showDetailedInfo={true}
        autoRefresh={false}
      />
    </div>
  )
}`}
            </code>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}