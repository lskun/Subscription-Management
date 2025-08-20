import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Clock, CheckCircle, AlertCircle, History, TrendingUp, Settings, Activity, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { type CurrencyType, isBaseCurrency } from '@/config/currency';
import { formatCurrencyAmount } from '@/utils/currency';
import { logger } from '@/utils/logger';
import { CURRENCY_NAMES } from '@/config/constants';
import { supabaseExchangeRateService, type ExchangeRateHistory, type ExchangeRateUpdateLog, type ExchangeRateStats } from '@/services/supabaseExchangeRateService';
import { supabaseGateway } from '@/utils/supabase-gateway';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function ExchangeRateManager() {
  const { isAdmin, hasPermission } = useAdminAuth();
  const {
    exchangeRates,
    lastExchangeRateUpdate,
    apiKey,
    fetchExchangeRates,
    updateExchangeRatesFromApi,
    currency,
    setCurrency,
    showOriginalCurrency,
    setShowOriginalCurrency
  } = useSettingsStore();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [rateHistory, setRateHistory] = useState<ExchangeRateHistory[]>([]);
  const [updateLogs, setUpdateLogs] = useState<ExchangeRateUpdateLog[]>([]);
  const [rateStats, setRateStats] = useState<ExchangeRateStats | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  // 服务端统一调度器状态（替代前端本地定时器）
  // 说明：从 DB RPC `scheduler_status('exchange_rates_update')` 读取，作为单一事实源
  type ServerSchedulerStatus = {
    job_name: string
    job_type: string
    cron_spec: string
    timezone: string
    is_enabled: boolean
    pg_cron_job_id?: number | null
    last_run_at: string | null
    next_run_at: string | null
    last_status: string | null
    failed_attempts: number
  }
  const [schedulerStatus, setSchedulerStatus] = useState<ServerSchedulerStatus | null>(null);
  const [isLoadingScheduler, setIsLoadingScheduler] = useState(false);

  // Load exchange rate statistics
  const loadRateStats = async () => {
    try {
      const stats = await supabaseExchangeRateService.getRateStats();
      setRateStats(stats);
    } catch (error) {
      logger.error('Failed to load rate stats:', error);
    }
  };

  // Load exchange rate history
  const loadRateHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await supabaseExchangeRateService.getRateHistory(undefined, undefined, 50);
      setRateHistory(history);
    } catch (error) {
      logger.error('Failed to load rate history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load update logs
  const loadUpdateLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await supabaseExchangeRateService.getUpdateLogs(20);
      setUpdateLogs(logs);
    } catch (error) {
      logger.error('Failed to load update logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Manually update exchange rates (using frontend scheduler)
  const handleUpdateRates = async () => {
    setIsUpdating(true);
    try {
      // 改为通过 Edge Function 触发（由 supabaseGateway 统一处理 401/403）
      const result = await supabaseExchangeRateService.triggerExchangeRateUpdate('manual');

      if (!result?.success) {
        throw new Error('Update failed');
      }

      // Refresh exchange rate data
      await fetchExchangeRates();
      await loadRateStats();
      if (isAdmin) {
        await loadUpdateLogs();
        await loadSchedulerStatus();
      }
      logger.info(`Successfully updated ${result.rates_updated} exchange rates`);
    } catch (error) {
      logger.error('Failed to update exchange rates:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 加载“服务端统一调度器”状态
  // 关键说明：不再读取前端本地定时器；统一从 RPC 获取 `exchange_rates_update` 的真实状态
  const loadSchedulerStatus = async () => {
    setIsLoadingScheduler(true);
    try {
      // 优先管理员接口，失败时（403）回退到公开只读状态接口
      const res = await supabaseGateway.rpc<ServerSchedulerStatus[] | null>('scheduler_status', { p_job_name: 'exchange_rates_update' });
      let data = res.data; let error = res.error;
      if (error) {
        const msg = String(error?.message || '');
        if (/403|forbidden/i.test(msg)) {
          const fb = await supabaseGateway.rpc<ServerSchedulerStatus[] | null>('scheduler_status_public', { p_job_name: 'exchange_rates_update' });
          data = fb.data; error = fb.error;
        }
      }
      if (error) throw error
      setSchedulerStatus(Array.isArray(data) ? (data?.[0] || null) : null);
    } catch (error) {
      logger.error('Failed to load scheduler status:', error);
      setSchedulerStatus(null);
    } finally {
      setIsLoadingScheduler(false);
    }
  };

  // Clean up old data
  const handleCleanupOldData = async (days: number = 90) => {
    try {
      await supabaseExchangeRateService.cleanupOldHistory(days);
      logger.info(`Successfully cleaned up data older than ${days} days`);
      await loadRateStats();
      if (isAdmin) {
        await loadUpdateLogs();
      }
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
    }
  };

  // 启停“服务端统一调度器”
  // 关键修复（中文注释）：
  // - 由前端本地 setInterval 切换为服务端 pg_cron 统一调度
  // - 通过 RPC `scheduler_start/stop` 控制，避免多浏览器/多用户重复执行
  const handleToggleScheduler = async () => {
    try {
      if (schedulerStatus?.is_enabled) {
        const { error } = await supabaseGateway.rpc('scheduler_stop', { p_job_name: 'exchange_rates_update' });
        if (error) throw error
      } else {
        const { error } = await supabaseGateway.rpc('scheduler_start', {
          p_job_name: 'exchange_rates_update',
          p_cron: '0 2 * * *', // 默认每日 02:00（24 小时）
          p_timezone: 'Asia/Shanghai',
          p_payload: { function: 'update-exchange-rates', body: { updateType: 'scheduled' } }
        });
        if (error) throw error
      }
      await loadSchedulerStatus();
    } catch (error) {
      logger.error('Failed to toggle scheduler:', error);
      // 非管理员会命中 403：这里只做温和提示（读写隔离）
      try { 
        // @ts-ignore: toast hook exists in app
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { title: '权限不足', description: '仅管理员可启停服务端调度器', variant: 'destructive' } }))
      } catch {}
    }
  };

  // 初始加载：统计与统一调度状态
  // 只有管理员才需要加载调度状态，避免非管理员用户产生403错误请求
  useEffect(() => {
    loadRateStats();
    if (isAdmin) {
      loadSchedulerStatus();
    }
  }, [isAdmin]);

  const formatLastUpdate = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'partial':
        return <Badge variant="secondary">Partial Success</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatUpdateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-1'}`}>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="logs">Update Logs</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          {/* Currency settings and exchange rate list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Currency Settings</CardTitle>
            <CardDescription>
              Set your preferred currency for expense calculation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            <div>
              <Label htmlFor="currency">Default Currency</Label>
              <Select
                value={currency}
                onValueChange={async (value: CurrencyType) => await setCurrency(value)}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Your preferred currency for displaying subscription costs
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Show in original currency</Label>
                <p className="text-sm text-muted-foreground">
                  Always display the original subscription currency alongside converted values
                </p>
              </div>
              <Switch
                id="show-original"
                checked={showOriginalCurrency}
                onCheckedChange={setShowOriginalCurrency}
              />
            </div>
          </CardContent>
        </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Exchange Rate Operations
                </CardTitle>
                <CardDescription>
                  Manually update exchange rates and refresh data
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      Exchange rate data is automatically updated via Edge Function, manual trigger update is supported
                    </p>
                  </div>

                  {rateStats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Total Exchange Rates</p>
                        <p className="text-sm text-muted-foreground">{rateStats.total_rates}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Supported Currencies</p>
                        <p className="text-sm text-muted-foreground">{rateStats.supported_currencies.length} types</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Last Updated</p>
                        <p className="text-sm text-muted-foreground">
                          {rateStats.latest_update ? formatUpdateTime(rateStats.latest_update) : 'None'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Failed Attempts Today</p>
                        <p className="text-sm text-muted-foreground">{rateStats.failed_updates_today}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleUpdateRates}
                    disabled={isUpdating || !isAdmin || !hasPermission('manage_system')}
                    size="sm"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Update Exchange Rates
                  </Button>

                  <Button
                    onClick={fetchExchangeRates}
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exchange Rate List */}
          <Card>
            <CardHeader>
              <CardTitle>Current Exchange Rates</CardTitle>
              <CardDescription>
                All exchange rates relative to {currency} (1 {currency} = X currency)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(exchangeRates).map(([currency, rate]) => (
                  <div
                    key={currency}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{currency}</p>
                      <p className="text-xs text-muted-foreground">
                        {CURRENCY_NAMES[currency as keyof typeof CURRENCY_NAMES] || currency}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrencyAmount(rate, currency, false)}
                      </p>
                    </div>
                    {isBaseCurrency(currency) && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>

              {Object.keys(exchangeRates).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No exchange rate data available</p>
                  <Button
                    onClick={fetchExchangeRates}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Load Exchange Rates
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && <TabsContent value="scheduler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Scheduled Task Management
              </CardTitle>
              <CardDescription>
                Manage automatic exchange rate update scheduled tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingScheduler ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading scheduled task status...</p>
                </div>
              ) : schedulerStatus ? (
                <div className="space-y-6">
                  {/* Scheduler Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className={`h-4 w-4 ${schedulerStatus?.is_enabled ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="font-medium">Scheduler Status</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {schedulerStatus?.is_enabled ? 'Running' : 'Stopped'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Server-side scheduler (pg_cron + Edge Function)
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Next Update Time</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {schedulerStatus?.next_run_at 
                          ? formatUpdateTime(schedulerStatus.next_run_at)
                          : 'Not set'
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Estimated next automatic update
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Failed Attempts</span>
                      </div>
                      <p className="text-lg font-semibold">
                         {schedulerStatus?.failed_attempts ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Consecutive failed attempts
                      </p>
                    </div>
                  </div>

                  {/* Scheduler Control */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-blue-900">Auto-update Settings</h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="scheduler-toggle" className="text-sm text-blue-800">
                          Enable Auto-update
                        </Label>
                        <Switch
                          id="scheduler-toggle"
                          checked={!!schedulerStatus?.is_enabled}
                          onCheckedChange={handleToggleScheduler}
                          disabled={!isAdmin || !hasPermission('manage_system')}
                        />
                      </div>
                    </div>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Updates exchange rate data every 24 hours</li>
                      <li>• Supports manual trigger updates</li>
                      <li>• Automatically retries on failure (up to 3 times)</li>
                      <li>• Cron: {schedulerStatus?.cron_spec || '0 2 * * *'} ({schedulerStatus?.timezone || 'Asia/Shanghai'})</li>
                    </ul>
                  </div>

                  {/* Last Update Information */}
                  {schedulerStatus?.last_run_at && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Last Update Time</span>
                      </div>
                      <p className="text-lg">
                        {formatUpdateTime(schedulerStatus.last_run_at)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Time of last successful exchange rate data update
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={loadSchedulerStatus}
                      variant="outline"
                      size="sm"
                      disabled={isLoadingScheduler || !isAdmin || !hasPermission('manage_system')}
                    >
                      {isLoadingScheduler ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh Status
                    </Button>

                    <Button
                      onClick={handleUpdateRates}
                      size="sm"
                      disabled={isUpdating || !isAdmin || !hasPermission('manage_system')}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Update Now
                    </Button>

                    <Button
                      onClick={() => handleCleanupOldData(90)}
                      variant="outline"
                      size="sm"
                      disabled={!isAdmin || !hasPermission('manage_system')}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clean Up Old Data
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Unable to get scheduled task status</p>
                  <Button
                    onClick={loadSchedulerStatus}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {isAdmin && <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Exchange Rate System Status
              </CardTitle>
              <CardDescription>
                System running status and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Total Exchange Rates</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.total_rates}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Supported Currencies</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.supported_currencies.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rateStats.supported_currencies.join(', ')}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">Failed Attempts Today</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.failed_updates_today}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Last Successful Update</span>
                    </div>
                    <p className="text-lg">
                      {rateStats.last_successful_update 
                        ? formatUpdateTime(rateStats.last_successful_update)
                        : 'No record'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading status information...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {isAdmin && <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Exchange Rate History
              </CardTitle>
              <CardDescription>
                View exchange rate change history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Display recent exchange rate change records
                </p>
                <Button
                  onClick={loadRateHistory}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading history records...</p>
                </div>
              ) : rateHistory.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {rateHistory.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {record.from_currency} → {record.to_currency}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {record.source}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatUpdateTime(record.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">{record.rate.toFixed(6)}</p>
                        <p className="text-xs text-muted-foreground">{record.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No history records</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {isAdmin && <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Update Logs
              </CardTitle>
              <CardDescription>
                View exchange rate update operation logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Display recent update operation records
                </p>
                <Button
                  onClick={loadUpdateLogs}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingLogs}
                >
                  {isLoadingLogs ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {isLoadingLogs ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading update logs...</p>
                </div>
              ) : updateLogs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {updateLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{log.update_type}</span>
                          {getStatusBadge(log.status)}
                          <Badge variant="outline" className="text-xs">
                            {log.source}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Started: {formatUpdateTime(log.started_at)}
                          {log.completed_at && (
                            <> | Completed: {formatUpdateTime(log.completed_at)}</>
                          )}
                        </p>
                        {log.error_message && (
                          <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{log.rates_updated} rates</p>
                        <p className="text-xs text-muted-foreground">Updated</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No update logs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}
      </Tabs>
    </div>
  );
}
