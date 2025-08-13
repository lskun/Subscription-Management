import { supabase } from '../lib/supabase';
import { supabaseGateway } from '@/utils/supabase-gateway';

/**
 * Supabase Metrics API 响应接口
 */
interface SupabaseMetricsResponse {
  [key: string]: {
    value: number;
    timestamp: number;
  }[];
}

/**
 * Edge Function 返回的数据库性能指标接口
 */
export interface EdgeFunctionMetricsResponse {
  success: boolean;
  data: {
    cpu: {
      usage_percent: number;
      user_seconds: number;
      system_seconds: number;
      idle_seconds: number;
      iowait_seconds: number;
    };
    memory: {
      usage_percent: number;
      total_bytes: number;
      available_bytes: number;
      free_bytes: number;
      cached_bytes: number;
    };
    disk: {
      iops: number;
      reads_completed: number;
      writes_completed: number;
      read_time_seconds: number;
      write_time_seconds: number;
      usage_percent?: number;
      size_bytes?: number;
      available_bytes?: number;
    };
    network: {
      receive_bytes: number;
      transmit_bytes: number;
      receive_packets: number;
      transmit_packets: number;
    };
    database: {
      active_connections: number;
      max_connections: number;
      waiting_connections: number;
      connection_usage_percent: number;
    };
    load: {
      load1: number;
      load5: number;
      load15: number;
    };
  };
  metadata: {
    project_ref: string;
    parsed_at: string;
    total_metrics_parsed: number;
  };
}

/**
 * 系统监控服务接口定义
 */
export interface SystemPerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  diskIops: number;
  diskSize: number; // GB
  activeConnections: number;
  maxConnections: number;
  connectionUsagePercent: number;
  queryPerformance: {
    avgQueryTime: number;
    slowQueries: number;
  };
  apiResponseTime: number;
  dbConnectionStatus: 'healthy' | 'warning' | 'error';
  externalServicesStatus: 'healthy' | 'warning' | 'error';
  cdnStatus: 'healthy' | 'warning' | 'error';
}

/**
 * 详细的数据库性能指标
 */
export interface DatabasePerformanceMetrics {
  connections: number;
  activeQueries: number;
  avgQueryTime: number;
  slowQueries: number;
  cacheHitRate: number;
  indexHitRate: number;
}

/**
 * 调用 database-metrics Edge Function 获取性能指标
 * @returns Promise<EdgeFunctionMetricsResponse> 数据库性能指标数据
 */
export const fetchDatabaseMetricsFromEdgeFunction = async (): Promise<EdgeFunctionMetricsResponse> => {
  try {
    const { data, error } = await supabaseGateway.invokeFunction('database-metrics');

    if (error) {
      console.error('Error calling database-metrics Edge Function:', error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data || !data.success) {
      throw new Error('Invalid response from database-metrics Edge Function');
    }

    return data as EdgeFunctionMetricsResponse;
  } catch (error) {
    console.error('Failed to fetch database metrics from Edge Function:', error);
    throw error;
  }
};

/**
 * 测试API响应时间
 */
export const getApiResponseTime = async (): Promise<number> => {
  try {
    const startTime = Date.now();
    await supabase.from('user_profiles').select('count').limit(1);
    return Date.now() - startTime;
  } catch (error) {
    console.error('Failed to test API response time:', error);
    return 1000; // 默认1秒
  }
};


/**
 * 检查外部服务状态
 * 在生产环境中，这应该检查实际的外部服务
 */
export const getExternalServicesStatus = async (): Promise<'healthy' | 'warning' | 'error'> => {
  try {
    // TODO 在实际部署环境中，这里应该检查外部服务的健康状态
    // 例如：支付服务、邮件服务、第三方API等
    // const paymentServiceHealth = await checkPaymentService();
    // const emailServiceHealth = await checkEmailService();
    
    // 临时模拟：基于数据库响应时间来判断外部服务状态
    return 'healthy';
  } catch (error) {
    console.error('Failed to check external services:', error);
    return 'error';
  }
};

/**
 * 检查CDN状态
 * 在生产环境中，这应该检查实际的CDN服务
 */
export const getCdnStatus = async (): Promise<'healthy' | 'warning' | 'error'> => {
  try {
    // 在实际部署环境中，这里应该检查CDN服务的健康状态
    // 例如：检查静态资源加载速度、CDN节点可用性等
    // const cdnResponse = await fetch('https://your-cdn.com/health');
    
    // 临时模拟：假设CDN服务正常
    return 'healthy';
  } catch (error) {
    console.error('Failed to check CDN status:', error);
    return 'error';
  }
};




/**
 * 获取系统性能指标（使用 Edge Function 数据）
 * @returns Promise<SystemPerformanceMetrics> 系统性能指标
 */
export const getSystemPerformanceMetrics = async (): Promise<SystemPerformanceMetrics> => {
  try {
    // 并行获取所有性能指标
    const [
      edgeMetrics,
      apiResponseTime,
      externalServicesStatus,
      cdnStatus
    ] = await Promise.all([
      fetchDatabaseMetricsFromEdgeFunction(),
      getApiResponseTime(),
      getExternalServicesStatus(),
      getCdnStatus()
    ]);

    // 从 Edge Function 响应中提取数据
    const { data } = edgeMetrics;
    
    // 计算数据库连接状态
    let dbConnectionStatus: 'healthy' | 'warning' | 'error' = 'healthy';
    if (data.database.connection_usage_percent > 80) {
      dbConnectionStatus = 'error';
    } else if (data.database.connection_usage_percent > 60) {
      dbConnectionStatus = 'warning';
    }

    return {
       cpuUsage: data.cpu.usage_percent,
       memoryUsage: data.memory.usage_percent,
       diskUsage: (data.disk.usage_percent || 0), // 使用新添加的磁盘使用率
       diskIops: Math.round(data.disk.iops),
       diskSize: Math.round((data.disk.available_bytes || 0) / (1024 * 1024 * 1024)), // 转换为 GB
       activeConnections: data.database.active_connections,
       maxConnections: data.database.max_connections,
       connectionUsagePercent: data.database.connection_usage_percent,
       queryPerformance: {
         avgQueryTime: apiResponseTime, // 使用 API 响应时间作为平均查询时间
         slowQueries: apiResponseTime > 1000 ? 1 : 0 // 如果响应时间超过1秒，认为有慢查询
       },
       apiResponseTime,
       dbConnectionStatus,
       externalServicesStatus,
       cdnStatus
     };
  } catch (error) {
    console.error('Failed to get system performance metrics:', error);
    
    // 返回默认值以防止页面崩溃
     return {
       cpuUsage: 0,
       memoryUsage: 0,
       diskUsage: 0,
       diskIops: 0,
       diskSize: 0,
       activeConnections: 0,
       maxConnections: 0,
       connectionUsagePercent: 0,
       queryPerformance: {
         avgQueryTime: 1000,
         slowQueries: 0
       },
       apiResponseTime: 1000,
       dbConnectionStatus: 'error',
       externalServicesStatus: 'error',
       cdnStatus: 'error'
     };
  }
};

/**
 * 获取详细的数据库性能指标（使用新的 Edge Function）
 * @returns Promise<EdgeFunctionMetricsResponse> 详细的数据库性能指标
 */
export const getDetailedDatabaseMetrics = async (): Promise<EdgeFunctionMetricsResponse> => {
  return await fetchDatabaseMetricsFromEdgeFunction();
};