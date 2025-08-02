import { supabase } from '../lib/supabase';
import { AdminMiddleware, ADMIN_PERMISSIONS } from '../utils/adminMiddleware';
import { adminAuthService } from './adminAuthService';

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  totalRevenue: number;
  systemUptime: number;
  databaseConnections: number;
  apiRequestsToday: number;
  errorRate: number;
}

export interface UserBehaviorAnalytics {
  dailyActiveUsers: Array<{ date: string; count: number }>;
  userRegistrations: Array<{ date: string; count: number }>;
  subscriptionCreations: Array<{ date: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

export interface SystemPerformance {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorRates: {
    total: number;
    byType: Array<{ type: string; count: number }>;
  };
  databasePerformance: {
    queryTime: number;
    connectionPool: number;
    slowQueries: number;
  };
}

export interface DataAnalyticsReport {
  timeRange: {
    start: string;
    end: string;
  };
  userMetrics: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    churnRate: number;
  };
  subscriptionMetrics: {
    totalSubscriptions: number;
    newSubscriptions: number;
    canceledSubscriptions: number;
    averageSubscriptionValue: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    monthlyRecurringRevenue: number;
    averageRevenuePerUser: number;
    revenueGrowth: number;
  };
  systemMetrics: {
    uptime: number;
    errorRate: number;
    responseTime: number;
    apiCalls: number;
  };
}

class AdminSystemMonitoringService {
  /**
   * 获取系统关键指标
   */
  async getSystemMetrics(): Promise<{
    metrics?: SystemMetrics;
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS);
      if (!permissionCheck.success) {
        return { error: permissionCheck.error };
      }

      // 获取用户统计
      const { count: totalUsers } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      // 获取活跃用户数（最近7天登录）
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: activeUsers } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', sevenDaysAgo.toISOString());

      // 获取订阅统计
      const { count: totalSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });

      // 获取收入统计
      const { data: revenueData } = await supabase
        .from('subscriptions')
        .select('amount')
        .not('amount', 'is', null);

      const totalRevenue = revenueData?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0;

      // 获取今日API请求数（从操作日志估算）
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: apiRequestsToday } = await supabase
        .from('admin_operation_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      const metrics: SystemMetrics = {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalSubscriptions: totalSubscriptions || 0,
        totalRevenue,
        systemUptime: 99.9, // 模拟数据，实际应该从监控系统获取
        databaseConnections: 10, // 模拟数据
        apiRequestsToday: apiRequestsToday || 0,
        errorRate: 0.1 // 模拟数据
      };

      // 记录操作日志
      await adminAuthService.logOperation(
        'system_metrics_view',
        'system',
        null,
        { metricsRequested: Object.keys(metrics) }
      );

      return { metrics };
    } catch (error) {
      console.error('获取系统指标失败:', error);
      return { error: '获取系统指标失败' };
    }
  }

  /**
   * 获取用户行为分析
   */
  async getUserBehaviorAnalytics(
    days: number = 30
  ): Promise<{
    analytics?: UserBehaviorAnalytics;
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS);
      if (!permissionCheck.success) {
        return { error: permissionCheck.error };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 获取每日活跃用户数
      const dailyActiveUsers = await this.getDailyActiveUsers(startDate, days);

      // 获取用户注册趋势
      const userRegistrations = await this.getUserRegistrationTrend(startDate, days);

      // 获取订阅创建趋势
      const subscriptionCreations = await this.getSubscriptionCreationTrend(startDate, days);

      // 获取热门分类
      const topCategories = await this.getTopCategories();

      // 计算用户留存率
      const userRetention = await this.calculateUserRetention();

      const analytics: UserBehaviorAnalytics = {
        dailyActiveUsers,
        userRegistrations,
        subscriptionCreations,
        topCategories,
        userRetention
      };

      // 记录操作日志
      await adminAuthService.logOperation(
        'user_behavior_analytics_view',
        'system',
        null,
        { days, analyticsType: 'user_behavior' }
      );

      return { analytics };
    } catch (error) {
      console.error('获取用户行为分析失败:', error);
      return { error: '获取用户行为分析失败' };
    }
  }

  /**
   * 获取系统性能监控
   */
  async getSystemPerformance(): Promise<{
    performance?: SystemPerformance;
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS);
      if (!permissionCheck.success) {
        return { error: permissionCheck.error };
      }

      // 模拟性能数据（实际应该从监控系统获取）
      const performance: SystemPerformance = {
        responseTime: {
          average: 120, // ms
          p95: 250,
          p99: 500
        },
        throughput: {
          requestsPerSecond: 45,
          requestsPerMinute: 2700
        },
        errorRates: {
          total: 0.5, // %
          byType: [
            { type: '4xx', count: 12 },
            { type: '5xx', count: 3 }
          ]
        },
        databasePerformance: {
          queryTime: 15, // ms
          connectionPool: 8,
          slowQueries: 2
        }
      };

      // 记录操作日志
      await adminAuthService.logOperation(
        'system_performance_view',
        'system',
        null,
        { performanceMetrics: Object.keys(performance) }
      );

      return { performance };
    } catch (error) {
      console.error('获取系统性能失败:', error);
      return { error: '获取系统性能失败' };
    }
  }

  /**
   * 生成数据分析报告
   */
  async generateAnalyticsReport(
    startDate: string,
    endDate: string
  ): Promise<{
    report?: DataAnalyticsReport;
    error?: string;
  }> {
    try {
      // 验证权限
      const permissionCheck = await AdminMiddleware.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS);
      if (!permissionCheck.success) {
        return { error: permissionCheck.error };
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // 获取用户指标
      const userMetrics = await this.getUserMetricsForPeriod(start, end);

      // 获取订阅指标
      const subscriptionMetrics = await this.getSubscriptionMetricsForPeriod(start, end);

      // 获取收入指标
      const revenueMetrics = await this.getRevenueMetricsForPeriod(start, end);

      // 获取系统指标
      const systemMetrics = await this.getSystemMetricsForPeriod(start, end);

      const report: DataAnalyticsReport = {
        timeRange: {
          start: startDate,
          end: endDate
        },
        userMetrics,
        subscriptionMetrics,
        revenueMetrics,
        systemMetrics
      };

      // 记录操作日志
      await adminAuthService.logOperation(
        'analytics_report_generate',
        'system',
        null,
        { startDate, endDate, reportSections: Object.keys(report) }
      );

      return { report };
    } catch (error) {
      console.error('生成分析报告失败:', error);
      return { error: '生成分析报告失败' };
    }
  }

  /**
   * 获取每日活跃用户数
   */
  private async getDailyActiveUsers(startDate: Date, days: number): Promise<Array<{ date: string; count: number }>> {
    const result = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', date.toISOString())
        .lt('last_sign_in_at', nextDate.toISOString());

      result.push({
        date: date.toISOString().split('T')[0],
        count: count || 0
      });
    }

    return result;
  }

  /**
   * 获取用户注册趋势
   */
  private async getUserRegistrationTrend(startDate: Date, days: number): Promise<Array<{ date: string; count: number }>> {
    const result = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      result.push({
        date: date.toISOString().split('T')[0],
        count: count || 0
      });
    }

    return result;
  }

  /**
   * 获取订阅创建趋势
   */
  private async getSubscriptionCreationTrend(startDate: Date, days: number): Promise<Array<{ date: string; count: number }>> {
    const result = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      result.push({
        date: date.toISOString().split('T')[0],
        count: count || 0
      });
    }

    return result;
  }

  /**
   * 获取热门分类
   */
  private async getTopCategories(): Promise<Array<{ category: string; count: number }>> {
    const { data } = await supabase
      .from('subscriptions')
      .select('category_id, categories(name)')
      .not('category_id', 'is', null);

    const categoryCount: Record<string, number> = {};
    
    data?.forEach(item => {
      const categoryName = (item as any).categories?.name || '未分类';
      categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
    });

    return Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * 计算用户留存率
   */
  private async calculateUserRetention(): Promise<{ day1: number; day7: number; day30: number }> {
    // 简化的留存率计算（实际应该更复杂）
    const now = new Date();
    
    // 1天前注册的用户
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { count: usersOneDayAgo } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString())
      .lt('created_at', now.toISOString());

    const { count: activeUsersOneDayAgo } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString())
      .lt('created_at', now.toISOString())
      .not('last_sign_in_at', 'is', null);

    const day1Retention = usersOneDayAgo ? (activeUsersOneDayAgo || 0) / usersOneDayAgo : 0;

    // 简化计算，实际应该分别计算7天和30天的留存
    return {
      day1: Math.round(day1Retention * 100),
      day7: Math.round(day1Retention * 0.8 * 100), // 模拟数据
      day30: Math.round(day1Retention * 0.6 * 100) // 模拟数据
    };
  }

  /**
   * 获取指定时期的用户指标
   */
  private async getUserMetricsForPeriod(start: Date, end: Date) {
    const { count: totalUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', end.toISOString());

    const { count: newUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { count: activeUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('last_sign_in_at', start.toISOString())
      .lte('last_sign_in_at', end.toISOString());

    return {
      totalUsers: totalUsers || 0,
      newUsers: newUsers || 0,
      activeUsers: activeUsers || 0,
      churnRate: 2.5 // 模拟数据
    };
  }

  /**
   * 获取指定时期的订阅指标
   */
  private async getSubscriptionMetricsForPeriod(start: Date, end: Date) {
    const { count: totalSubscriptions } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', end.toISOString());

    const { count: newSubscriptions } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('amount')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .not('amount', 'is', null);

    const averageSubscriptionValue = subscriptionData?.length 
      ? subscriptionData.reduce((sum, sub) => sum + (sub.amount || 0), 0) / subscriptionData.length
      : 0;

    return {
      totalSubscriptions: totalSubscriptions || 0,
      newSubscriptions: newSubscriptions || 0,
      canceledSubscriptions: 5, // 模拟数据
      averageSubscriptionValue
    };
  }

  /**
   * 获取指定时期的收入指标
   */
  private async getRevenueMetricsForPeriod(start: Date, end: Date) {
    const { data: revenueData } = await supabase
      .from('subscriptions')
      .select('amount')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .not('amount', 'is', null);

    const totalRevenue = revenueData?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0;

    const { count: totalUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', end.toISOString());

    const averageRevenuePerUser = totalUsers ? totalRevenue / totalUsers : 0;

    return {
      totalRevenue,
      monthlyRecurringRevenue: totalRevenue * 0.8, // 模拟数据
      averageRevenuePerUser,
      revenueGrowth: 15.5 // 模拟数据
    };
  }

  /**
   * 获取指定时期的系统指标
   */
  private async getSystemMetricsForPeriod(start: Date, end: Date) {
    const { count: apiCalls } = await supabase
      .from('admin_operation_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    return {
      uptime: 99.8, // 模拟数据
      errorRate: 0.2, // 模拟数据
      responseTime: 125, // 模拟数据
      apiCalls: apiCalls || 0
    };
  }
}

export const adminSystemMonitoringService = new AdminSystemMonitoringService();
export default adminSystemMonitoringService;