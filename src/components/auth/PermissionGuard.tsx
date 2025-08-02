import React from 'react'
import { usePermission } from '@/hooks/usePermissions'
import { Permission, QuotaType } from '@/services/userPermissionService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, AlertTriangle, Zap, Loader2 } from 'lucide-react'

interface PermissionGuardProps {
  permission: Permission
  quotaType?: QuotaType
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
  onUpgradeClick?: () => void
}

/**
 * 权限守卫组件
 * 根据用户权限和配额控制子组件的显示
 */
export function PermissionGuard({
  permission,
  quotaType,
  children,
  fallback,
  showUpgradePrompt = true,
  onUpgradeClick
}: PermissionGuardProps) {
  const { allowed, reason, upgradeRequired, loading } = usePermission(permission, quotaType)

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">检查权限中...</span>
      </div>
    )
  }

  // 有权限，显示内容
  if (allowed) {
    return <>{children}</>
  }

  // 有自定义fallback，使用自定义内容
  if (fallback) {
    return <>{fallback}</>
  }

  // 默认的权限拒绝UI
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          {upgradeRequired ? (
            <Lock className="h-6 w-6 text-muted-foreground" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <CardTitle className="text-lg">
          {upgradeRequired ? '功能受限' : '访问受限'}
        </CardTitle>
        <CardDescription>
          {reason || '您当前没有权限访问此功能'}
        </CardDescription>
      </CardHeader>
      {showUpgradePrompt && upgradeRequired && (
        <CardContent className="text-center">
          <Button 
            onClick={onUpgradeClick}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Zap className="mr-2 h-4 w-4" />
            升级计划
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

/**
 * 简化的权限检查组件
 * 只在有权限时显示内容，无权限时不显示任何内容
 */
export function PermissionCheck({
  permission,
  quotaType,
  children
}: {
  permission: Permission
  quotaType?: QuotaType
  children: React.ReactNode
}) {
  const { allowed, loading } = usePermission(permission, quotaType)

  if (loading || !allowed) {
    return null
  }

  return <>{children}</>
}

/**
 * 权限警告组件
 * 显示权限相关的警告信息
 */
export function PermissionWarning({
  permission,
  quotaType,
  className = ''
}: {
  permission: Permission
  quotaType?: QuotaType
  className?: string
}) {
  const { allowed, reason, upgradeRequired } = usePermission(permission, quotaType)

  if (allowed) {
    return null
  }

  return (
    <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        {reason}
        {upgradeRequired && (
          <span className="ml-2 text-orange-600 font-medium">
            请升级您的订阅计划以解锁此功能。
          </span>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * 功能按钮权限包装器
 * 根据权限状态禁用或启用按钮
 */
interface PermissionButtonProps extends React.ComponentProps<typeof Button> {
  permission: Permission
  quotaType?: QuotaType
  showTooltip?: boolean
}

export function PermissionButton({
  permission,
  quotaType,
  showTooltip = true,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const { allowed, reason, loading } = usePermission(permission, quotaType)

  const isDisabled = loading || !allowed || buttonProps.disabled

  return (
    <Button
      {...buttonProps}
      disabled={isDisabled}
      title={showTooltip && !allowed ? reason : buttonProps.title}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          检查中...
        </>
      ) : (
        children
      )}
    </Button>
  )
}

/**
 * 权限路由守卫
 * 用于保护整个页面或路由
 */
export function PermissionRoute({
  permission,
  quotaType,
  children,
  redirectTo,
  onAccessDenied
}: {
  permission: Permission
  quotaType?: QuotaType
  children: React.ReactNode
  redirectTo?: string
  onAccessDenied?: () => void
}) {
  const { allowed, reason, upgradeRequired, loading } = usePermission(permission, quotaType)

  React.useEffect(() => {
    if (!loading && !allowed) {
      if (onAccessDenied) {
        onAccessDenied()
      } else if (redirectTo) {
        window.location.href = redirectTo
      }
    }
  }, [allowed, loading, onAccessDenied, redirectTo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">验证访问权限...</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>访问受限</CardTitle>
            <CardDescription>
              {reason || '您没有权限访问此页面'}
            </CardDescription>
          </CardHeader>
          {upgradeRequired && (
            <CardContent className="text-center">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                <Zap className="mr-2 h-4 w-4" />
                升级计划
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  return <>{children}</>
}