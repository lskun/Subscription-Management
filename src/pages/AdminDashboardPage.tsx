import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminGuard } from '../components/admin/AdminGuard';
import { UserManagement } from '../components/admin/UserManagement';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useAuth } from '../contexts/AuthContext';
import { useAdminOperationLog, ADMIN_OPERATION_TYPES, ADMIN_TARGET_TYPES } from '../hooks/useAdminOperationLog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { supabase } from '../lib/supabase';
import { getSystemPerformanceMetrics } from '../services/systemMonitorService';
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
  AlertTriangle,
  Database,
  Server,
  Mail,
  Globe,
  Save,
  RefreshCw,
  Search,
  Filter,
  Download,
  Calendar,
  User
} from 'lucide-react';
import { AdminOperationLog } from '../services/adminAuthService';

// 系统设置接口
interface SystemSettings {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailNotifications: boolean;
  maxUsersPerAccount: number;
  sessionTimeout: number;
  backupEnabled: boolean;
  debugMode: boolean;
}

// 系统统计接口
interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth(); // 从登录缓存中获取用户信息
  const { adminUser, logout, hasPermission } = useAdminAuth();
  const { logOperation, getOperationLogs } = useAdminOperationLog();
  const [recentLogs, setRecentLogs] = useState<AdminOperationLog[]>([]);
  const [totalLogsCount, setTotalLogsCount] = useState(0); // 添加总日志数量状态
  const [logsLoading, setLogsLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'users' | 'monitoring' | 'settings' | 'logs'>('dashboard');
  const [contentLoading, setContentLoading] = useState(false);
  const [isTriggeringRenewal, setIsTriggeringRenewal] = useState(false);
  
  // 系统设置状态
  const [settings, setSettings] = useState<SystemSettings>({
    siteName: 'Subscription Manager',
    siteDescription: '订阅管理系统',
    maintenanceMode: false,
    registrationEnabled: true,
    emailNotifications: true,
    maxUsersPerAccount: 1000,
    sessionTimeout: 3600,
    backupEnabled: true,
    debugMode: false
  });
  
  // 系统监控状态
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSubscriptions: 0,
    systemHealth: 'healthy'
  });
  
  // 性能指标状态
  const [performanceMetrics, setPerformanceMetrics] = useState({
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    diskIops: 0,
    diskSize: 0,
    activeConnections: 0,
    maxConnections: 0,
    connectionUsagePercent: 0,
    queryPerformance: {
      avgQueryTime: 0,
      slowQueries: 0
    },
    apiResponseTime: 0,
    dbConnectionStatus: 'healthy' as 'healthy' | 'warning' | 'error',
    externalServicesStatus: 'healthy' as 'healthy' | 'warning' | 'error',
    cdnStatus: 'healthy' as 'healthy' | 'warning' | 'error'
  });
  
  // 操作日志状态
  const [allLogs, setAllLogs] = useState<AdminOperationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AdminOperationLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 辅助函数
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
      'subscription': '订阅',
      'system': '系统',
      'role': '角色',
      'permission': '权限'
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 加载系统统计数据
  const loadSystemStats = async () => {
    try {
      // 改为调用带权限校验（super_admin）的 RPC，绕过 RLS 统计真实数据
      const { data, error } = await supabase.rpc('get_system_stats');
      if (error) throw error;
      setStats({
        totalUsers: data?.totalUsers ?? 0,
        activeUsers: data?.activeUsers ?? 0,
        totalSubscriptions: data?.totalSubscriptions ?? 0,
        systemHealth: (data?.totalUsers ?? 0) > 1000 ? 'warning' : 'healthy'
      });
    } catch (error) {
      console.error('Failed to load system stats:', error);
      // 设置默认值以防查询失败
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        totalSubscriptions: 0,
        systemHealth: 'error'
      });
    }
  };
  
  // 优化3: 加载真实的系统性能指标
  const loadPerformanceMetrics = async () => {
    try {
      // 使用系统监控服务获取真实的性能指标
      const metrics = await getSystemPerformanceMetrics();
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('Failed to load performance metrics:', error);
      // 设置默认的错误状态
      setPerformanceMetrics({
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        diskIops: 0,
        diskSize: 0,
        activeConnections: 0,
        maxConnections: 0,
        connectionUsagePercent: 0,
        queryPerformance: {
          avgQueryTime: 0,
          slowQueries: 0
        },
        apiResponseTime: 0,
        dbConnectionStatus: 'error',
        externalServicesStatus: 'error',
        cdnStatus: 'error'
      });
    }
  };

  // 加载系统设置
  const loadSystemSettings = async () => {
    try {
      //TODO 实际应用中应该从数据库加载设置
      // 这里使用默认值
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  };

  // 保存系统设置
  const saveSystemSettings = async () => {
    try {
      //TODO 实际应用中应该保存到数据库
      toast({
        title: "设置已保存",
        description: "系统设置已成功更新"
      });
      
      await logOperation(
        ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
        ADMIN_TARGET_TYPES.SYSTEM,
        'system_settings',
        { settings }
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "保存失败",
        description: "系统设置保存失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 手动触发自动续费（优先 DB 内部批处理，失败回退 Edge Function）
  const triggerAutoRenewal = async () => {
    if (isTriggeringRenewal) return;
    setIsTriggeringRenewal(true);
    try {
      // 优先尝试调用数据库函数（生产方案）
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_due_auto_renewals', { p_limit: 200 });
      if (!rpcError) {
        toast({
          title: '自动续费任务已触发（DB）',
          description: `处理成功: ${rpcData?.processed_count ?? 0}，错误: ${rpcData?.error_count ?? 0}`
        });
        await logOperation(
          ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
          ADMIN_TARGET_TYPES.SYSTEM,
          'auto_renewal_manual_trigger',
          { method: 'db_function', result: rpcData }
        );
        return;
      }

      // 回退：调用 Edge Function
      const { data: fnData, error: fnError } = await supabase.functions.invoke('auto-renew-subscriptions');
      if (fnError) throw fnError;

      toast({
        title: '自动续费任务已触发（Edge Function）',
        description: `processed: ${fnData?.processed ?? 0}, errors: ${fnData?.errors ?? 0}`
      });
      await logOperation(
        ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
        ADMIN_TARGET_TYPES.SYSTEM,
        'auto_renewal_manual_trigger',
        { method: 'edge_function', result: fnData }
      );
    } catch (error: any) {
      console.error('手动触发自动续费失败:', error);
      toast({
        title: '触发失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive'
      });
      await logOperation(
        ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
        ADMIN_TARGET_TYPES.SYSTEM,
        'auto_renewal_manual_trigger_error',
        { error: String(error?.message || error) }
      );
    } finally {
      setIsTriggeringRenewal(false);
    }
  };

  // 加载所有操作日志
  const loadAllLogs = async () => {
    try {
      const result = await getOperationLogs(1, 100);
      if (!result.error) {
        setAllLogs(result.data);
        setFilteredLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to load all logs:', error);
    }
  };

  // 过滤日志
  useEffect(() => {
    let filtered = allLogs;
    
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.operation_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.operation_details && JSON.stringify(log.operation_details).toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (logLevel !== 'all') {
      // 根据操作类型映射日志级别
      const levelMap = {
        'info': ['admin_login', 'user_view', 'system_config_change'],
        'warning': ['user_edit'],
        'error': ['admin_logout']
      };
      filtered = filtered.filter(log => 
        levelMap[logLevel]?.includes(log.operation_type)
      );
    }
    
    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [allLogs, searchTerm, logLevel]);

  // 初始化日志数据
  useEffect(() => {
    if (currentView === 'logs' && allLogs.length === 0) {
      loadAllLogs();
    }
  }, [currentView, allLogs.length]);

  // 加载最近的操作日志
  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        const result = await getOperationLogs(1, 5); // 只显示最近5条
        if (!result.error) {
          setRecentLogs(result.data);
          setTotalLogsCount(result.total); // 设置总日志数量
        }
      } catch (error) {
        console.error('加载操作日志失败:', error);
      } finally {
        setLogsLoading(false);
      }
    };

    loadRecentLogs();
    loadSystemStats();
    loadSystemSettings();
    loadPerformanceMetrics();
    
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

  // 处理视图切换
  const handleViewChange = async (view: 'dashboard' | 'users' | 'monitoring' | 'settings' | 'logs') => {
    setContentLoading(true);
    setCurrentView(view);
    
    // 如果切换到监控页面，重新加载性能指标
    if (view === 'monitoring') {
      loadPerformanceMetrics();
    }
    
    // 模拟加载时间
    setTimeout(() => {
      setContentLoading(false);
    }, 500);
    
    // 记录操作日志
    logOperation(
      ADMIN_OPERATION_TYPES.SYSTEM_CONFIG_CHANGE,
      ADMIN_TARGET_TYPES.SYSTEM,
      null,
      { action: `access_${view}_page` }
    );
  };
  
  // 刷新系统监控数据
  const refreshMonitoringData = async () => {
    await Promise.all([
      loadSystemStats(),
      loadPerformanceMetrics()
    ]);
    toast({
      title: "数据已刷新",
      description: "系统监控数据已更新"
    });
  };



  // 渲染用户管理页面
  const renderUsersPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-1xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      用户管理
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      管理系统用户和权限设置
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => handleViewChange('dashboard')} 
                variant="outline"
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
              >
                返回仪表板
              </Button>
            </div>
          </div>
        </div>
        
        <UserManagement />
      </div>
    </div>
  );

  // 渲染系统监控页面
  const renderMonitoringPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-1xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      系统监控
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      监控系统运行状态和性能指标
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={refreshMonitoringData}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新数据
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleViewChange('dashboard')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                >
                  返回仪表板
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 系统统计卡片 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-slate-900 border-blue-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-300">总用户数</CardTitle>
              <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                <Users className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-800 bg-clip-text text-transparent">
                {stats.totalUsers}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                注册用户总数
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white to-green-50 dark:from-slate-800 dark:to-slate-900 border-green-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-300">活跃用户</CardTitle>
              <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
                <Activity className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-800 bg-clip-text text-transparent">
                {stats.activeUsers}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                近30天活跃
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white to-purple-50 dark:from-slate-800 dark:to-slate-900 border-purple-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-300">订阅总数</CardTitle>
              <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg">
                <Database className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-800 bg-clip-text text-transparent">
                {stats.totalSubscriptions}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                有效订阅
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white to-orange-50 dark:from-slate-800 dark:to-slate-900 border-orange-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-300">系统状态</CardTitle>
              <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg">
                <Server className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-violet-800 bg-clip-text text-transparent">
                {stats.systemHealth}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                系统运行状态
              </p>
            </CardContent>            
          </Card>
        </div>
        
        {/* 系统健康详情 */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                Supabase 性能指标
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <span>CPU 使用率</span>
                  <span>{performanceMetrics.cpuUsage}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300" style={{width: `${performanceMetrics.cpuUsage}%`}}></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <span>内存使用率</span>
                  <span>{performanceMetrics.memoryUsage}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300" style={{width: `${performanceMetrics.memoryUsage}%`}}></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <span>磁盘使用率</span>
                  <span>{performanceMetrics.diskUsage}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-yellow-500 to-amber-600 h-2 rounded-full transition-all duration-300" style={{width: `${performanceMetrics.diskUsage}%`}}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <span>数据库连接使用率</span>
                  <span>{performanceMetrics.connectionUsagePercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-yellow-500 to-amber-600 h-2 rounded-full transition-all duration-300" style={{width: `${performanceMetrics.connectionUsagePercent}%`}}></div>
                </div>
              </div>             
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-600 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                网络状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">API 响应时间</span>
                <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">{performanceMetrics.apiResponseTime}ms</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">数据库连接</span>
                <Badge className={`text-white border-0 ${
                  performanceMetrics.dbConnectionStatus === 'healthy' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                    : performanceMetrics.dbConnectionStatus === 'warning'
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-600'
                    : 'bg-gradient-to-r from-red-500 to-red-600'
                }`}>
                  {performanceMetrics.dbConnectionStatus === 'healthy' ? '正常' : 
                   performanceMetrics.dbConnectionStatus === 'warning' ? '警告' : '异常'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">数据库活跃连接数</span>
                <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">{performanceMetrics.activeConnections} 个</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">数据库可用磁盘大小</span>
                 <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">{performanceMetrics.diskSize} GB</Badge>
              </div>            
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">磁盘 IOPS</span>
                <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300">{performanceMetrics.diskIops}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">外部服务</span>
                <Badge className={`text-white border-0 ${
                  performanceMetrics.externalServicesStatus === 'healthy' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                    : performanceMetrics.externalServicesStatus === 'warning'
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-600'
                    : 'bg-gradient-to-r from-red-500 to-red-600'
                }`}>
                  {performanceMetrics.externalServicesStatus === 'healthy' ? '正常' : 
                   performanceMetrics.externalServicesStatus === 'warning' ? '警告' : '异常'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
           
      </div>
    </div>
  );

  // 渲染系统设置页面
  const renderSettingsPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Settings className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-1xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      系统设置
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      配置系统参数和选项
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={saveSystemSettings}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                >
                  <Save className="h-4 w-4" />
                  保存设置
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleViewChange('dashboard')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                >
                  返回仪表板
                </Button>
              </div>
            </div>
          </div>
        </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 基本设置 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              基本设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            <div className="space-y-2">
              <Label htmlFor="siteName" className="text-sm font-medium text-slate-700 dark:text-slate-300">站点名称</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                placeholder="输入站点名称"
                className="border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="siteDescription" className="text-sm font-medium text-slate-700 dark:text-slate-300">站点描述</Label>
              <Textarea
                id="siteDescription"
                value={settings.siteDescription}
                onChange={(e) => setSettings({...settings, siteDescription: e.target.value})}
                placeholder="输入站点描述"
                rows={3}
                className="border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all resize-none"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">维护模式</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">启用后用户无法访问系统</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => setSettings({...settings, maintenanceMode: checked})}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">允许注册</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">允许新用户注册账户</p>
              </div>
              <Switch
                checked={settings.registrationEnabled}
                onCheckedChange={(checked) => setSettings({...settings, registrationEnabled: checked})}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* 通知设置 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              通知设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">邮件通知</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">启用系统邮件通知</p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxUsers" className="text-sm font-medium text-slate-700 dark:text-slate-300">最大用户数</Label>
              <Input
                id="maxUsers"
                type="number"
                value={settings.maxUsersPerAccount}
                onChange={(e) => setSettings({...settings, maxUsersPerAccount: parseInt(e.target.value) || 0})}
                placeholder="输入最大用户数"
                className="border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout" className="text-sm font-medium text-slate-700 dark:text-slate-300">会话超时时间（秒）</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value) || 3600})}
                placeholder="输入会话超时时间"
                className="border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* 系统选项 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              系统运行选项
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">自动备份</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">启用数据自动备份</p>
              </div>
              <Switch
                checked={settings.backupEnabled}
                onCheckedChange={(checked) => setSettings({...settings, backupEnabled: checked})}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">调试模式</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">启用系统调试信息</p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => setSettings({...settings, debugMode: checked})}
                className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
              />
            </div>

            {/* 手动触发自动续费 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">手动触发自动续费</Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">立即执行到期订阅的批量续费任务（仅管理员）</p>
              </div>
              <Button
                onClick={triggerAutoRenewal}
                disabled={!hasPermission('manage_system') || isTriggeringRenewal}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {isTriggeringRenewal ? <Activity className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isTriggeringRenewal ? '执行中...' : '手动触发'}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* 当前配置预览 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              配置预览
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">站点名称</span>
                <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{settings.siteName}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">维护模式</span>
                <Badge 
                  variant={settings.maintenanceMode ? 'destructive' : 'default'}
                  className={`font-medium ${
                    settings.maintenanceMode 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' 
                      : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                  }`}
                >
                  {settings.maintenanceMode ? '启用' : '禁用'}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">用户注册</span>
                <Badge 
                  variant={settings.registrationEnabled ? 'default' : 'secondary'}
                  className={`font-medium ${
                    settings.registrationEnabled 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' 
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {settings.registrationEnabled ? '允许' : '禁止'}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">邮件通知</span>
                <Badge 
                  variant={settings.emailNotifications ? 'default' : 'secondary'}
                  className={`font-medium ${
                    settings.emailNotifications 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {settings.emailNotifications ? '启用' : '禁用'}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">最大用户</span>
                <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{settings.maxUsersPerAccount}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">会话超时</span>
                <span className="text-sm text-slate-900 dark:text-slate-100 font-semibold">{settings.sessionTimeout}秒</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // 渲染操作日志页面
  const renderLogsPage = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm border border-blue-200 dark:border-slate-600 rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-1xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                      操作日志
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                      查看系统操作记录和审计信息
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadAllLogs}
                  className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新日志
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleViewChange('dashboard')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                >
                  返回仪表板
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
        
        {/* 搜索和过滤 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              搜索和筛选
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="搜索操作类型、目标类型或详情..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={logLevel} onValueChange={(value: any) => setLogLevel(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="info">信息</SelectItem>
                    <SelectItem value="warning">警告</SelectItem>
                    <SelectItem value="error">错误</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 日志列表 */}
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center justify-between text-slate-900 dark:text-slate-100">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                操作记录
              </span>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                显示最近100条记录
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedLogs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无日志记录</h3>
                <p className="text-muted-foreground">没有找到符合条件的操作日志</p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {paginatedLogs.map((log, index) => {
                  const getLogLevelColor = (opType: string) => {
                    if (['admin_login', 'user_view', 'system_config_change'].includes(opType)) return 'default';
                    if (['user_edit'].includes(opType)) return 'secondary';
                    if (['admin_logout'].includes(opType)) return 'destructive';
                    return 'outline';
                  };
                  
                  const getLogIcon = (opType: string) => {
                    if (opType === 'admin_login') return <User className="h-4 w-4" />;
                    if (opType === 'admin_logout') return <LogOut className="h-4 w-4" />;
                    if (opType === 'user_view') return <Users className="h-4 w-4" />;
                    if (opType === 'user_edit') return <Settings className="h-4 w-4" />;
                    if (opType === 'system_config_change') return <Settings className="h-4 w-4" />;
                    return <Activity className="h-4 w-4" />;
                  };
                  
                  return (
                    <div key={log.id || index} className="flex items-start gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 shadow-sm hover:shadow-md">
                      <div className="flex-shrink-0 mt-0">
                        <Badge variant={getLogLevelColor(log.operation_type)} className="flex items-center gap-1 shadow-sm">
                          {getLogIcon(log.operation_type)}
                          {getOperationTypeLabel(log.operation_type)}
                        </Badge>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">                                                 
                          <Badge variant="secondary" className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-0 text-xs whitespace-nowrap">
                            {getTargetTypeLabel(log.target_type)}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            <User className="h-3 w-3" />
                            <span>{log.admin_user_id || '系统'}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            {log.ip_address || '未知IP'}
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                          
                        </div>                    
                        
                        {log.operation_details && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mt-3">
                            <pre className="whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
                              {JSON.stringify(log.operation_details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700">
                  显示 {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} 条，共 {filteredLogs.length} 条记录
                </div>
                <div className="flex items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    上一页
                  </Button>
                  <span className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md">
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const start = Math.max(1, currentPage - 2);
                        const end = Math.min(totalPages, start + 4);
                        pageNum = start + i;
                        if (pageNum > end) return null;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {pageNum}
                        </Button>
                      );
                    }).filter(Boolean)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    );
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* 头部导航 */}
        <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    SubManager Dashboard
                  </h1>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right bg-white/50 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.email || adminUser?.user?.email}
                  </p>
                </div>
                <Button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  variant="outline"
                  size="sm"
                  className="bg-white/50 hover:bg-white/80 border-gray-200 backdrop-blur-sm transition-all duration-200"
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
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {contentLoading ? (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
              <div className="flex flex-col items-center space-y-4">
                <div className="spinner"></div>
                <p className="text-lg font-medium text-gray-700">Loading Subscription Manager...</p>
              </div>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <>
                  {/* 欢迎信息 */}
                  <div className="mb-8">
                    <Alert className="border-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-sm shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                        <AlertDescription className="text-gray-800 font-medium">
                          欢迎使用管理后台！您当前拥有 <strong className="text-blue-600">{adminUser?.role?.name}</strong> 权限。
                        </AlertDescription>
                      </div>
                    </Alert>
                  </div>

          {/* 功能卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* 用户管理 */}
            <Card className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-blue-50/50 border-0 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold text-gray-700">用户管理</CardTitle>
                <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                  <Users className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-between h-32">
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    {stats.totalUsers}
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    总用户数
                  </p>
                </div>
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                    disabled={!hasPermission('manage_users')}
                    onClick={() => handleViewChange('users')}
                  >
                    管理用户
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系统监控 */}
            <Card className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-green-50/50 border-0 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold text-gray-700">系统监控</CardTitle>
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-between h-32">
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-800 bg-clip-text text-transparent">
                    {stats.systemHealth === 'healthy' ? '99.9%' : 
                     stats.systemHealth === 'warning' ? '95.2%' : '87.1%'}
                  </div>
                  {/* 健康状态指示器 */}
                  <div className="mt-1 flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      stats.systemHealth === 'healthy' ? 'bg-green-500' :
                      stats.systemHealth === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    } animate-pulse`}></div>
                    <span className={`text-xs font-medium ${
                      stats.systemHealth === 'healthy' ? 'text-green-600' :
                      stats.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {stats.systemHealth === 'healthy' ? '运行正常' :
                       stats.systemHealth === 'warning' ? '需要关注' : '存在问题'}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                    disabled={!hasPermission('view_analytics')}
                    onClick={() => handleViewChange('monitoring')}
                  >
                    查看监控
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 系统设置 */}
            <Card className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-purple-50/50 border-0 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold text-gray-700">系统设置</CardTitle>
                <div className="p-2 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                  <Settings className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-between h-32">
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-800 bg-clip-text text-transparent">
                    {Object.keys(settings).length}
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    配置项目
                  </p>
                </div>
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                    disabled={!hasPermission('manage_system')}
                    onClick={() => handleViewChange('settings')}
                  >
                    系统设置
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 操作日志 */}
            <Card className="group hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-orange-50/50 border-0 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold text-gray-700">操作日志</CardTitle>
                <div className="p-2 bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                  <FileText className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-between h-32">
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-800 bg-clip-text text-transparent">
                    {totalLogsCount}
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    最近操作
                  </p>
                </div>
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200"
                    onClick={() => handleViewChange('logs')}
                  >
                    查看日志
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 最近操作日志 */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-lg py-3 px-6">
              <CardTitle className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-slate-600 to-gray-700 rounded-lg shadow-md">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-800">最近操作日志</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <Activity className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-gray-600 font-medium">加载日志中...</span>
                  </div>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-4 bg-gray-100 rounded-full">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <span className="text-gray-500 font-medium">暂无操作日志</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log, index) => (
                    <div key={log.id} className="group p-3 bg-gradient-to-r from-white to-gray-50/50 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-1">
                        <div className="flex items-center space-x-2 flex-1">
                          <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm text-xs whitespace-nowrap">
                            {getOperationTypeLabel(log.operation_type)}
                          </Badge>
                          <Badge variant="secondary" className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border-0 text-xs whitespace-nowrap">
                            {getTargetTypeLabel(log.target_type)}
                          </Badge>
                          <div className="flex items-center space-x-1 text-xs text-gray-600">
                            <User className="h-3 w-3" />
                            <span>{log.admin_user_id || '系统'}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 ml-6">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                          <div className="bg-gray-50 px-2 py-1 rounded-full">
                            {log.ip_address || '未知IP'}
                          </div>
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
                    <Card className="mt-8 bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-lg">
                        <CardTitle className="flex items-center space-x-3">
                          <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md">
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-xl font-bold text-gray-800">当前权限</span>
                        </CardTitle>
                        <CardDescription className="text-gray-600 font-medium">
                          您当前拥有的管理员权限列表
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(adminUser.role.permissions)
                            .filter(([_, value]) => value === true)
                            .map(([permission], index) => (
                              <Badge 
                                key={permission} 
                                className={`justify-center py-2 px-4 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 ${
                                  index % 4 === 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                  index % 4 === 1 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                                  index % 4 === 2 ? 'bg-gradient-to-r from-purple-500 to-violet-600' :
                                  'bg-gradient-to-r from-orange-500 to-amber-600'
                                }`}
                              >
                                {permission}
                              </Badge>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
              
              {currentView === 'users' && renderUsersPage()}
              {currentView === 'monitoring' && renderMonitoringPage()}
              {currentView === 'settings' && renderSettingsPage()}
              {currentView === 'logs' && renderLogsPage()}
            </>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}