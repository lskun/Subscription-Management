import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminGuard } from '../components/admin/AdminGuard';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAdminOperationLog, ADMIN_OPERATION_TYPES, ADMIN_TARGET_TYPES } from '../hooks/useAdminOperationLog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  LogOut,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { AdminOperationLog } from '../services/adminAuthService';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { adminUser, logout, hasPermission } = useAdminAuth();
  const { logOperation, getOperationLogs } = useAdminOperationLog();
  const [recentLogs, setRecentLogs] = useState<AdminOperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // 加载最近的操作日志
  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        const result = await getOperationLogs(1, 10);
        if (!result.error) {
          setRecentLogs(result.data);
        }
      } catch (error) {
        console.error('加载操作日志失败:', error);
      } finally {
        setLogsLoading(false);
      }
    };

    loadRecentLogs();
    
    // 记录访问仪表板的日志
    logOperation(
      ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
      ADMIN_TARGET_TYPES.SYSTEM,
      null,
      { action: 'access_admin_dashboard' }
    );
  }, [logOperation, getOperationLogs]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const result = await logout();
      if (result.success) {
        navigate('/admin/login');
      } else {
        console.error('登出失败:', result.error);
      }
    } catch (error) {
      console.error('登出异常:', error);
    } finally {
      setLogoutLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getOperationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'admin_login': '管理员登录',
      'admin_logout': '管理员登出',
      'user_view': '查看用户',
      'user_edit': '编辑用户',
      'system_config_change': '系统配置变更'
    };
    return labels[type] || type;
  };

  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'user': '用户',
      'system': '系统',
      'subscription': '订阅',
      'admin_user': '管理员用户'
    };
    return labels[type] || type;
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        {/* 头部导航 */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <Shield className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
                  <p className="text-sm text-gray-600">系统管理控制台</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {adminUser?.role?.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {adminUser?.user?.email}
                  </p>
                </div>
                <Button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  variant="outline"
                  size="sm"
                >
                  {logoutLoading ? (
                    <Activity className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  登出
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* 欢迎信息 */}
          <div className="mb-8">
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                欢迎使用管理后台！您当前拥有 <strong>{adminUser?.role?.name}</strong> 权限。
              </AlertDescription>
            </Alert>
          </div>

          {/* 功能卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* 用户管理 */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">用户管理</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">
                  总用户数
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    disabled={!hasPermission('manage_users')}
                    onClick={() => navigate('/admin/users')}
                  >
                    管理用户
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系统监控 */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">系统监控</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">99.9%</div>
                <p className="text-xs text-muted-foreground">
                  系统可用性
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    disabled={!hasPermission('view_analytics')}
                    onClick={() => navigate('/admin/monitoring')}
                  >
                    查看监控
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系统设置 */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">系统设置</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">
                  配置项目
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    disabled={!hasPermission('manage_system')}
                    onClick={() => navigate('/admin/settings')}
                  >
                    系统设置
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 操作日志 */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">操作日志</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentLogs.length}</div>
                <p className="text-xs text-muted-foreground">
                  最近操作
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/admin/logs')}
                  >
                    查看日志
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最近操作日志 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>最近操作日志</span>
              </CardTitle>
              <CardDescription>
                显示最近10条管理员操作记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Activity className="h-6 w-6 animate-spin mr-2" />
                  <span>加载日志中...</span>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无操作日志
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {getOperationTypeLabel(log.operation_type)}
                          </Badge>
                          <Badge variant="secondary">
                            {getTargetTypeLabel(log.target_type)}
                          </Badge>
                          {log.target_id && (
                            <span className="text-xs text-gray-600">
                              ID: {log.target_id}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {log.ip_address || '未知IP'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 权限信息 */}
          {adminUser?.role?.permissions && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>当前权限</CardTitle>
                <CardDescription>
                  您当前拥有的管理员权限列表
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(adminUser.role.permissions)
                    .filter(([_, value]) => value === true)
                    .map(([permission]) => (
                      <Badge key={permission} variant="outline" className="justify-center">
                        {permission}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}