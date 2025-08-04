import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * 数据库性能指标 Edge Function
 * 从 Supabase Metrics API 获取 Prometheus 格式的指标数据并解析为结构化格式
 */

// Deno 全局对象类型声明
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// 复制 dynamicMetricsParser 的核心逻辑
interface ParsedMetric {
  name: string;
  labels: { [key: string]: string };
  value: number;
}

/**
 * 解析 Prometheus 格式的指标行
 * @param line - 单行指标数据
 * @returns 解析后的指标对象或 null
 */
function parseMetricLine(line: string): ParsedMetric | null {
  if (line.startsWith('#') || line.trim() === '') {
    return null;
  }
  
  const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)({([^}]*)})?\s+([0-9.e+-]+)/);
  if (!match) {
    return null;
  }
  
  const name = match[1];
  const labelsStr = match[3] || '';
  const value = parseFloat(match[4]);
  
  // 解析标签
  const labels: { [key: string]: string } = {};
  if (labelsStr) {
    const labelPairs = labelsStr.match(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g);
    if (labelPairs) {
      for (const pair of labelPairs) {
        const labelMatch = pair.match(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/); 
        if (labelMatch) {
          labels[labelMatch[1]] = labelMatch[2];
        }
      }
    }
  }
  
  return { name, labels, value };
}

/**
 * 从指标列表中查找匹配的指标
 * @param metrics - 解析后的指标列表
 * @param metricName - 指标名称
 * @param labelFilters - 标签过滤条件
 * @returns 匹配的指标值数组
 */
function findMetrics(
  metrics: ParsedMetric[], 
  metricName: string, 
  labelFilters: { [key: string]: string | string[] } = {}
): number[] {
  return metrics
    .filter(metric => {
      if (metric.name !== metricName) return false;
      
      for (const [key, expectedValue] of Object.entries(labelFilters)) {
        const actualValue = metric.labels[key];
        if (!actualValue) return false;
        
        if (Array.isArray(expectedValue)) {
          if (!expectedValue.includes(actualValue)) return false;
        } else {
          if (actualValue !== expectedValue) return false;
        }
      }
      
      return true;
    })
    .map(metric => metric.value);
}

/**
 * 获取指标的总和
 * @param metrics - 解析后的指标列表
 * @param metricName - 指标名称
 * @param labelFilters - 标签过滤条件
 * @returns 指标值的总和
 */
function sumMetrics(
  metrics: ParsedMetric[], 
  metricName: string, 
  labelFilters: { [key: string]: string | string[] } = {}
): number {
  const values = findMetrics(metrics, metricName, labelFilters);
  return values.reduce((sum, value) => sum + value, 0);
}

/**
 * 获取第一个匹配的指标值
 * @param metrics - 解析后的指标列表
 * @param metricName - 指标名称
 * @param labelFilters - 标签过滤条件
 * @returns 第一个匹配的指标值，如果没有找到则返回 0
 */
function getFirstMetric(
  metrics: ParsedMetric[], 
  metricName: string, 
  labelFilters: { [key: string]: string | string[] } = {}
): number {
  const values = findMetrics(metrics, metricName, labelFilters);
  return values.length > 0 ? values[0] : 0;
}

/**
 * 自动检测项目引用
 * @param metrics - 解析后的指标列表
 * @returns 项目引用字符串
 */
function detectProjectRef(metrics: ParsedMetric[]): string {
  for (const metric of metrics) {
    if (metric.labels.supabase_project_ref) {
      return metric.labels.supabase_project_ref;
    }
  }
  return 'unknown';
}

/**
 * 解析 Prometheus 格式的指标数据并转换为 API 响应格式
 * @param metricsText - Prometheus 格式的指标文本
 * @returns API 响应格式的对象
 */
function parseAndFormatMetrics(metricsText: string) {
  const lines = metricsText.split('\n');
  const metrics: ParsedMetric[] = [];
  
  // 解析所有指标行
  for (const line of lines) {
    const metric = parseMetricLine(line);
    if (metric) {
      metrics.push(metric);
    }
  }
  
  // 自动检测项目引用
  const projectRef = detectProjectRef(metrics);
  const dbFilter = { service_type: 'db', supabase_project_ref: projectRef };
  
  // 提取 CPU 指标
  const cpuIdle = sumMetrics(metrics, 'node_cpu_seconds_total', { ...dbFilter, mode: 'idle' });
  const cpuUser = sumMetrics(metrics, 'node_cpu_seconds_total', { ...dbFilter, mode: 'user' });
  const cpuSystem = sumMetrics(metrics, 'node_cpu_seconds_total', { ...dbFilter, mode: 'system' });
  const cpuIowait = sumMetrics(metrics, 'node_cpu_seconds_total', { ...dbFilter, mode: 'iowait' });
  
  const totalCpu = cpuIdle + cpuUser + cpuSystem + cpuIowait;
  const cpuUsage = totalCpu > 0 ? ((cpuUser + cpuSystem) / totalCpu) * 100 : 0;
  
  // 提取内存指标
  const memTotal = getFirstMetric(metrics, 'node_memory_MemTotal_bytes', dbFilter);
  const memFree = getFirstMetric(metrics, 'node_memory_MemFree_bytes', dbFilter);
  const memAvailable = getFirstMetric(metrics, 'node_memory_MemAvailable_bytes', dbFilter);
  const memCached = getFirstMetric(metrics, 'node_memory_Cached_bytes', dbFilter);
  const memUsage = memTotal > 0 ? ((memTotal - memAvailable) / memTotal) * 100 : 0;
  
  // 提取磁盘指标
  const diskReads = sumMetrics(metrics, 'node_disk_reads_completed_total', dbFilter);
  const diskWrites = sumMetrics(metrics, 'node_disk_writes_completed_total', dbFilter);
  const diskReadTime = sumMetrics(metrics, 'node_disk_read_time_seconds_total', dbFilter);
  const diskWriteTime = sumMetrics(metrics, 'node_disk_write_time_seconds_total', dbFilter);
  const diskIoNow = sumMetrics(metrics, 'node_disk_io_now', dbFilter);

  // 计算 IOPS：使用 node_disk_io_now 作为瞬时 I/O 操作数。
  // 这是一个 Gauge 指标，表示当前正在进行的 I/O 操作数，比累计值更适合反映当前负载。
  const iops = diskIoNow;

  // 提取文件系统指标计算磁盘使用率 - 只统计数据存储盘(/data)
  const dataDiskSize = getFirstMetric(metrics, 'node_filesystem_size_bytes', 
    { ...dbFilter, mountpoint: '/data' });
  const dataDiskFree = getFirstMetric(metrics, 'node_filesystem_free_bytes', 
    { ...dbFilter, mountpoint: '/data' });
  const dataDiskAvail = getFirstMetric(metrics, 'node_filesystem_avail_bytes', 
    { ...dbFilter, mountpoint: '/data' });

  // 如果没有找到/data挂载点，则使用所有文件系统的总和作为备选
  const diskSizeTotal = dataDiskSize > 0 ? dataDiskSize : sumMetrics(metrics, 'node_filesystem_size_bytes', dbFilter);
  const diskFreeTotal = dataDiskFree > 0 ? dataDiskFree : sumMetrics(metrics, 'node_filesystem_free_bytes', dbFilter);
  const diskAvailTotal = dataDiskAvail > 0 ? dataDiskAvail : sumMetrics(metrics, 'node_filesystem_avail_bytes', dbFilter);

  // 计算磁盘使用率
  const diskUsagePercent = diskSizeTotal > 0 ? ((diskSizeTotal - diskFreeTotal) / diskSizeTotal) * 100 : 0;
  
  // 提取网络指标（尝试多个常见的网络接口）
  let networkReceiveBytes = 0;
  let networkTransmitBytes = 0;
  let networkReceivePackets = 0;
  let networkTransmitPackets = 0;
  
  // 尝试不同的网络接口设备名
  const networkDevices = ['ens5', 'eth0', 'en0', 'enp0s3', 'enp0s8'];
  for (const device of networkDevices) {
    const receiveBytes = getFirstMetric(metrics, 'node_network_receive_bytes_total', 
      { ...dbFilter, device });
    const transmitBytes = getFirstMetric(metrics, 'node_network_transmit_bytes_total', 
      { ...dbFilter, device });
    const receivePackets = getFirstMetric(metrics, 'node_network_receive_packets_total', 
      { ...dbFilter, device });
    const transmitPackets = getFirstMetric(metrics, 'node_network_transmit_packets_total', 
      { ...dbFilter, device });
    
    if (receiveBytes > 0 || transmitBytes > 0) {
      networkReceiveBytes += receiveBytes;
      networkTransmitBytes += transmitBytes;
      networkReceivePackets += receivePackets;
      networkTransmitPackets += transmitPackets;
    }
  }
  
  // 如果没有找到具体设备，尝试不指定设备
  if (networkReceiveBytes === 0 && networkTransmitBytes === 0) {
    networkReceiveBytes = sumMetrics(metrics, 'node_network_receive_bytes_total', dbFilter);
    networkTransmitBytes = sumMetrics(metrics, 'node_network_transmit_bytes_total', dbFilter);
    networkReceivePackets = sumMetrics(metrics, 'node_network_receive_packets_total', dbFilter);
    networkTransmitPackets = sumMetrics(metrics, 'node_network_transmit_packets_total', dbFilter);
  }
  
  // 提取数据库连接指标
  // pgbouncer 连接数
  const pgbouncerActiveConnections = sumMetrics(metrics, 'pgbouncer_pools_client_active_connections', 
    { supabase_project_ref: projectRef, service_type: 'db' });
  
  // 直接的 PostgreSQL 后端连接数
  const pgBackendConnections = getFirstMetric(metrics, 'pg_stat_database_num_backends', 
    { supabase_project_ref: projectRef, service_type: 'postgresql' });

  // 使用 PostgreSQL 后端连接数作为更可靠的活跃连接数来源
  const totalActiveConnections = pgBackendConnections > 0 ? pgBackendConnections : pgbouncerActiveConnections;
  
  const maxConnections = getFirstMetric(metrics, 'pgbouncer_config_max_client_connections', 
    { supabase_project_ref: projectRef, service_type: 'db' }) || 200; // 默认值
  const waitingConnections = sumMetrics(metrics, 'pgbouncer_pools_client_waiting_connections', 
    { supabase_project_ref: projectRef, service_type: 'db' });
  
  // 提取系统负载指标
  const load1 = getFirstMetric(metrics, 'node_load1', dbFilter);
  const load5 = getFirstMetric(metrics, 'node_load5', dbFilter);
  const load15 = getFirstMetric(metrics, 'node_load15', dbFilter);
  
  return {
    success: true,
    data: {
      cpu: {
        usage_percent: Number(cpuUsage.toFixed(1)),
        user_seconds: cpuUser,
        system_seconds: cpuSystem,
        idle_seconds: cpuIdle,
        iowait_seconds: cpuIowait
      },
      memory: {
        usage_percent: Number(memUsage.toFixed(1)),
        total_bytes: memTotal,
        available_bytes: memAvailable,
        free_bytes: memFree,
        cached_bytes: memCached
      },
      disk: {
        usage_percent: Number(diskUsagePercent.toFixed(1)),
        size_bytes: diskSizeTotal,
        available_bytes: diskAvailTotal,
        iops: Number(iops.toFixed(0)),
        reads_completed: diskReads,
        writes_completed: diskWrites,
        read_time_seconds: diskReadTime,
        write_time_seconds: diskWriteTime
      },
      network: {
        receive_bytes: networkReceiveBytes,
        transmit_bytes: networkTransmitBytes,
        receive_packets: networkReceivePackets,
        transmit_packets: networkTransmitPackets
      },
      database: {
        active_connections: totalActiveConnections,
        max_connections: maxConnections,
        waiting_connections: waitingConnections,
        connection_usage_percent: maxConnections > 0 
          ? Number(((totalActiveConnections / maxConnections) * 100).toFixed(1))
          : 0
      },
      load: {
        load1: Number(load1.toFixed(2)),
        load5: Number(load5.toFixed(2)),
        load15: Number(load15.toFixed(2))
      }
    },
    metadata: {
      project_ref: projectRef,
      parsed_at: new Date().toISOString(),
      total_metrics_parsed: metrics.length
    }
  };
}

/**
 * 获取 Supabase 项目引用
 */
function getProjectRef(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  
  const match = supabaseUrl.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co/);
  if (!match) {
    throw new Error('Invalid SUPABASE_URL format');
  }
  
  return match[1];
}

/**
 * 获取 service_role JWT
 */
function getServiceRoleKey(): string {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  }
  return serviceRoleKey;
}

Deno.serve(async (req: Request) => {
  // 设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    // 获取项目引用和认证密钥
    const projectRef = getProjectRef();
    const serviceRoleKey = getServiceRoleKey();
    
    // 构建 Metrics API URL
    const metricsUrl = `https://${projectRef}.supabase.co/customer/v1/privileged/metrics`;
    
    // 调用 Supabase Metrics API
    const response = await fetch(metricsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(`service_role:${serviceRoleKey}`)}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Metrics API request failed: ${response.status} ${response.statusText}`);
    }
    
    const metricsText = await response.text();
    
    // 解析指标数据
    const result = parseAndFormatMetrics(metricsText);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error in database-metrics Edge Function:', error);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      data: null
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
