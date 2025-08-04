import React from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissionCheck } from '../../hooks/useAdminPermissions';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallback?: React.ReactNode;
  showLoginButton?: boolean;
}

export function AdminGuard({ 
  children, 
  requiredPermission, 
  fallback,
  showLoginButton = true 
}: AdminGuardProps) {
  const { isAdmin, isLoading, login } = useAdminAuth();
  const permissionCheck = usePermissionCheck(requiredPermission || '');
  
  // 如果需要特定权限，使用权限检查Hook的结果
  const hasRequiredPermission = requiredPermission 
    ? permissionCheck.hasPermission 
    : true;
  const permissionLoading = requiredPermission ? permissionCheck.isLoading : false;

  // 显示加载状态，与主页面loading样式保持一致
  if (isLoading || permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="spinner"></div>
          <p className="text-lg font-medium text-gray-700">Loading Subscription Manager...</p>
        </div>
      </div>
    );
  }

  // 非管理员用户
  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-3">
                <p>您没有管理员权限，无法访问此页面。</p>
                {showLoginButton && (
                  <Button
                    onClick={login}
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    管理员登录
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // 检查特定权限
  if (requiredPermission && !hasRequiredPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              您没有执行此操作的权限。请联系超级管理员获取相应权限。
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // 权限验证通过，渲染子组件
  return <>{children}</>;
}

// 权限检查的高阶组件
export function withAdminGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: string
) {
  return function AdminGuardedComponent(props: P) {
    return (
      <AdminGuard requiredPermission={requiredPermission}>
        <Component {...props} />
      </AdminGuard>
    );
  };
}

// 权限按钮组件
interface AdminPermissionButtonProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export function AdminPermissionButton({ 
  permission, 
  children, 
  fallback = null,
  ...props 
}: AdminPermissionButtonProps) {
  const { hasPermission } = usePermissionCheck(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <Button {...props}>{children}</Button>;
}