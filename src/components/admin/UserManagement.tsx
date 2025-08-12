import React, { useState, useEffect } from 'react';
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
  onLoadingChange?: (loading: boolean) => void;
}

export function UserManagement({ className, onLoadingChange }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize] = useState(10);
  
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
  useEffect(() => {
    loadUsers();
  }, [currentPage, filters]);

  // 加载统计信息
  useEffect(() => {
    loadStats();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      onLoadingChange?.(true);
      const response = await adminUserManagementService.getUserList(
        currentPage,
        pageSize,
        filters
      );
      if (response.error) {
        setError(response.error);
      } else {
        setUsers(response.users);
        setTotalUsers(response.total);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await adminUserManagementService.getUserStatistics();
      if (!response.error) {
        setStats({
          totalUsers: response.totalUsers,
          activeUsers: response.activeUsers,
          newUsersThisMonth: response.newUsersThisMonth,
          suspendedUsers: response.suspendedUsers
        });
      }
    } catch (err) {
      console.error('加载统计信息失败:', err);
    }
  };

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ 
      ...prev, 
      status: status === 'all' ? undefined : status as 'active' | 'inactive' | 'suspended'
    }));
    setCurrentPage(1);
  };

  const handleSort = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: sortBy as 'created_at' | 'last_sign_in_at' | 'email',
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleUserAction = async (userId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      setLoading(true);
      
      let result;
      if (action === 'delete') {
        if (!window.confirm('确定要删除这个用户吗？此操作不可撤销。')) {
          return;
        }
        result = await adminUserManagementService.deleteUser(userId);
      } else {
        result = await adminUserManagementService.toggleUserStatus(userId, action);
      }
      
      if (result.success) {
        await loadUsers();
        await loadStats();
      } else {
        setError(result.error || '操作失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '从未';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getUserStatus = (user: UserProfile) => {
    // 检查用户是否被锁定
    if (user.is_blocked) {
      return { status: 'suspended', label: '已暂停', variant: 'destructive' as const };
    }
    
    // 检查用户是否活跃（最近30天内有登录记录）
    if (user.last_login_time) {
      const lastLogin = new Date(user.last_login_time);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (lastLogin > thirtyDaysAgo) {
        return { status: 'active', label: '活跃', variant: 'default' as const };
      }
    }
    
    return { status: 'inactive', label: '非活跃', variant: 'secondary' as const };
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200/50 dark:border-blue-800/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100">总用户数</CardTitle>
            <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.totalUsers}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
              注册用户总数
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200/50 dark:border-green-800/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-green-900 dark:text-green-100">活跃用户</CardTitle>
            <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.activeUsers}</div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
              最近30天登录
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 border-purple-200/50 dark:border-purple-800/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-purple-900 dark:text-purple-100">本月新用户</CardTitle>
            <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
              <Calendar className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{stats.newUsersThisMonth}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
              新注册用户
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200/50 dark:border-red-800/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-red-900 dark:text-red-100">暂停用户</CardTitle>
            <div className="p-2 bg-gradient-to-r from-red-500 to-rose-600 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
              <UserX className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900 dark:text-red-100">{stats.suspendedUsers}</div>
            <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
              被暂停账户
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤器 */}
      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg shadow-sm">
              <Search className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">搜索和筛选</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">快速查找和筛选用户</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索用户邮箱或姓名..."
                  value={filters.search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={filters.status || 'all'} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-36 h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">非活跃</SelectItem>
                  <SelectItem value="suspended">已暂停</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.sortBy} onValueChange={handleSort}>
                <SelectTrigger className="w-36 h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">注册时间</SelectItem>
                  <SelectItem value="last_login_time">最后登录</SelectItem>
                  <SelectItem value="email">邮箱</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-sm">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">用户列表</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                共 {totalUsers} 个用户
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-6 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
            </Alert>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">加载中...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">用户昵称</TableHead>
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">邮箱</TableHead>
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">状态</TableHead>
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">注册时间</TableHead>
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">最后登录</TableHead>
                      <TableHead className="font-semibold text-slate-900 dark:text-slate-100">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const status = getUserStatus(user);
                      return (
                        <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="py-2">
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {user.user_metadata?.full_name || user.display_name || ''}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{user.email}</div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge 
                              variant={status.variant}
                              className={`font-medium ${
                                status.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                status.status === 'suspended' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-slate-700 dark:text-slate-300">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell className="py-2 text-slate-700 dark:text-slate-300">
                            {formatDate(user.last_login_time)}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewUser(user)}
                                className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {status.status === 'suspended' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUserAction(user.id, 'activate')}
                                  className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUserAction(user.id, 'suspend')}
                                  className="h-8 w-8 p-0 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUserAction(user.id, 'delete')}
                                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalUsers)} 条，共 {totalUsers} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`h-8 w-8 p-0 ${
                              currentPage === page 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm hover:from-blue-700 hover:to-indigo-700' 
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
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
        <DialogContent className="max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 shadow-2xl">
          <DialogHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-sm">
                <Eye className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">用户详情</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  查看用户的详细信息和操作历史
                </DialogDescription>
              </div>
            </div>
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
  );
}

// 用户详情视图组件
interface UserDetailsViewProps {
  user: UserProfile;
  onClose: () => void;
}

function UserDetailsView({ user, onClose }: UserDetailsViewProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '从未';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-md">
              <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">用户名称</span>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{user.display_name}</div>
        </div>
        
        
        <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 dark:bg-green-900/50 rounded-md">
              <Mail className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">邮箱</span>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{user.email}</div>
        </div>
        
        
        <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">注册时间</span>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{formatDate(user.created_at)}</div>
        </div>
        
        <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-100 dark:bg-orange-900/50 rounded-md">
              <UserCheck className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">最后登录</span>
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{formatDate(user.last_login_time)}</div>
        </div>
      </div>

      {/* 用户元数据 */}
      {user.user_metadata && Object.keys(user.user_metadata).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-md">
              <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            用户信息
          </h4>
          <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
              {JSON.stringify(user.user_metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* 应用元数据 */}
      {user.app_metadata && Object.keys(user.app_metadata).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <div className="p-1.5 bg-teal-100 dark:bg-teal-900/50 rounded-md">
              <Eye className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            应用数据
          </h4>
          <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto">
              {JSON.stringify(user.app_metadata, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
        <Button 
          onClick={onClose}
          className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white shadow-sm hover:shadow-md transition-all duration-200"
        >
          关闭
        </Button>
      </div>
    </div>
  );
}