import React, { useState, useEffect } from 'react';
import { AdminGuard } from './AdminGuard';
import { ADMIN_PERMISSIONS } from '../../utils/adminMiddleware';
import { adminUserManagementService, UserProfile, UserListFilters } from '../../services/adminUserManagementService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Search, 
  Users, 
  UserCheck, 
  UserX, 
  Eye, 
  Edit, 
  Trash2, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Calendar,
  Mail,
  Phone
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface UserManagementProps {
  className?: string;
}

export function UserManagement({ className }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize] = useState(20);
  
  // 过滤器状态
  const [filters, setFilters] = useState<UserListFilters>({
    search: '',
    status: undefined,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  
  // 统计信息状态
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsersThisMonth: 0,
    suspendedUsers: 0
  });

  // 加载用户列表
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await adminUserManagementService.getUserList(
        currentPage,
        pageSize,
        filters
      );
      
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.users);
        setTotalUsers(result.total);
      }
    } catch (err) {
      setError('加载用户列表失败');
      console.error('加载用户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      const result = await adminUserManagementService.getUserStatistics();
      if (!result.error) {
        setStats(result);
      }
    } catch (err) {
      console.error('加载统计信息失败:', err);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadUsers();
    loadStats();
  }, [currentPage, filters]);

  // 搜索处理
  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
    setCurrentPage(1);
  };

  // 状态过滤处理
  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === 'all' ? undefined : status as any 
    }));
    setCurrentPage(1);
  };

  // 排序处理
  const handleSort = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: sortBy as any,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  };

  // 用户操作处理
  const handleUserAction = async (userId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      let result;
      
      if (action === 'delete') {
        if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) {
          return;
        }
        result = await adminUserManagementService.deleteUser(userId);
      } else {
        result = await adminUserManagementService.toggleUserStatus(userId, action);
      }
      
      if (result.success) {
        await loadUsers(); // 重新加载用户列表
        await loadStats(); // 重新加载统计信息
      } else {
        setError(result.error || '操作失败');
      }
    } catch (err) {
      setError('操作失败');
      console.error('用户操作失败:', err);
    }
  };

  // 查看用户详情
  const handleViewUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 获取用户状态
  const getUserStatus = (user: UserProfile) => {
    if (user.app_metadata?.banned_until) {
      return { status: 'suspended', label: '已暂停', variant: 'destructive' as const };
    }
    if (user.last_sign_in_at) {
      const lastSignIn = new Date(user.last_sign_in_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (lastSignIn > thirtyDaysAgo) {
        return { status: 'active', label: '活跃', variant: 'default' as const };
      }
    }
    return { status: 'inactive', label: '非活跃', variant: 'secondary' as const };
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <AdminGuard requiredPermission={ADMIN_PERMISSIONS.VIEW_USERS}>
      <div className={`space-y-6 ${className}`}>
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
            <p className="text-gray-600">管理系统中的所有用户账户</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                最近30天登录
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本月新用户</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newUsersThisMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">暂停用户</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.suspendedUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和过滤器 */}
        <Card>
          <CardHeader>
            <CardTitle>搜索和筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索用户邮箱或手机号..."
                    value={filters.search || ''}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filters.status || 'all'} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="用户状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有状态</SelectItem>
                  <SelectItem value="active">活跃用户</SelectItem>
                  <SelectItem value="inactive">非活跃用户</SelectItem>
                  <SelectItem value="suspended">已暂停</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.sortBy} onValueChange={(value) => handleSort(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">注册时间</SelectItem>
                  <SelectItem value="last_sign_in_at">最后登录</SelectItem>
                  <SelectItem value="email">邮箱</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>
              共 {totalUsers} 个用户，当前显示第 {currentPage} 页
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>加载中...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                没有找到用户
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户信息</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead>最后登录</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const userStatus = getUserStatus(user);
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center space-x-2">
                                  <Phone className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-600">{user.phone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={userStatus.variant}>
                              {userStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {formatDate(user.created_at)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : '从未登录'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewUser(user)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              <AdminGuard requiredPermission={ADMIN_PERMISSIONS.MANAGE_USERS} fallback={null}>
                                {userStatus.status === 'suspended' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserAction(user.id, 'activate')}
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUserAction(user.id, 'suspend')}
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                )}
                              </AdminGuard>

                              <AdminGuard requiredPermission={ADMIN_PERMISSIONS.DELETE_USERS} fallback={null}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUserAction(user.id, 'delete')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AdminGuard>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* 分页控件 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalUsers)} 条，共 {totalUsers} 条
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        上一页
                      </Button>
                      <span className="text-sm">
                        第 {currentPage} 页，共 {totalPages} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        下一页
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用户详情对话框 */}
        <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>用户详情</DialogTitle>
              <DialogDescription>
                查看用户的详细信息和操作历史
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <UserDetailsView 
                user={selectedUser} 
                onClose={() => setShowUserDetails(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminGuard>
  );
}

// 用户详情视图组件
interface UserDetailsViewProps {
  user: UserProfile;
  onClose: () => void;
}

function UserDetailsView({ user, onClose }: UserDetailsViewProps) {
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserDetails = async () => {
      try {
        const result = await adminUserManagementService.getUserDetails(user.id);
        setUserDetails(result);
      } catch (error) {
        console.error('加载用户详情失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserDetails();
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>加载用户详情中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">邮箱</label>
            <p className="text-sm">{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">手机号</label>
            <p className="text-sm">{user.phone || '未设置'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">注册时间</label>
            <p className="text-sm">{new Date(user.created_at).toLocaleString('zh-CN')}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">最后登录</label>
            <p className="text-sm">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('zh-CN') : '从未登录'}
            </p>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      {userDetails?.stats && (
        <div>
          <h3 className="text-lg font-semibold mb-3">统计信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">订阅数量</label>
              <p className="text-sm">{userDetails.stats.totalSubscriptions}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">总消费</label>
              <p className="text-sm">¥{userDetails.stats.totalSpent.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* 订阅列表 */}
      {userDetails?.subscriptions && userDetails.subscriptions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">订阅列表</h3>
          <div className="space-y-2">
            {userDetails.subscriptions.slice(0, 5).map((subscription: any) => (
              <div key={subscription.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{subscription.name}</span>
                <span className="text-sm text-gray-600">¥{subscription.amount}</span>
              </div>
            ))}
            {userDetails.subscriptions.length > 5 && (
              <p className="text-sm text-gray-600">还有 {userDetails.subscriptions.length - 5} 个订阅...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}