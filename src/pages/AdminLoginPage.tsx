import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Shield, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, adminUser, isLoading, login } = useAdminAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAdminLogin = async () => {
    if (!user) {
      setMessage({ type: 'error', text: '请先登录普通用户账户' });
      return;
    }

    setLoginLoading(true);
    setMessage(null);

    try {
      const result = await login();
      
      if (result.success) {
        setMessage({ type: 'success', text: '管理员登录成功！' });
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.error || '登录失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '登录过程中发生错误' });
    } finally {
      setLoginLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>检查管理员权限中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            管理员登录
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            访问系统管理后台
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>权限验证</CardTitle>
            <CardDescription>
              验证您的管理员权限以访问后台管理系统
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 用户状态 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">用户登录状态:</span>
                <span className={`text-sm ${user ? 'text-green-600' : 'text-red-600'}`}>
                  {user ? '已登录' : '未登录'}
                </span>
              </div>
              
              {user && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">用户邮箱:</span>
                  <span className="text-sm text-gray-600">{user.email}</span>
                </div>
              )}
            </div>

            {/* 管理员状态 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">管理员权限:</span>
                <span className={`text-sm ${isAdmin ? 'text-green-600' : 'text-red-600'}`}>
                  {isAdmin ? '已验证' : '未验证'}
                </span>
              </div>
              
              {adminUser && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">管理员角色:</span>
                    <span className="text-sm text-gray-600">{adminUser.role?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">权限数量:</span>
                    <span className="text-sm text-gray-600">
                      {adminUser.role?.permissions ? Object.keys(adminUser.role.permissions).length : 0}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 消息提示 */}
            {message && (
              <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                {message.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="space-y-3">
              {!user && (
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                  variant="outline"
                >
                  前往登录
                </Button>
              )}

              {user && !isAdmin && (
                <Button
                  onClick={handleAdminLogin}
                  disabled={loginLoading}
                  className="w-full"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      验证权限中...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      验证管理员权限
                    </>
                  )}
                </Button>
              )}

              {isAdmin && (
                <Button
                  onClick={() => navigate('/admin/dashboard')}
                  className="w-full"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  进入管理后台
                </Button>
              )}
            </div>

            {/* 权限说明 */}
            {adminUser?.role?.permissions && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">当前权限:</h4>
                <div className="grid grid-cols-1 gap-1">
                  {Object.entries(adminUser.role.permissions)
                    .filter(([_, value]) => value === true)
                    .map(([permission]) => (
                      <div key={permission} className="text-xs text-gray-600">
                        • {permission}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}