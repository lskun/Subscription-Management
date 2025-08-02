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
import { exchangeRateScheduler, type SchedulerStatus } from '@/services/exchangeRateScheduler';
import { supabase } from '@/lib/supabase';

export function ExchangeRateManager() {
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
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [isLoadingScheduler, setIsLoadingScheduler] = useState(false);

  // 加载汇率统计信息
  const loadRateStats = async () => {
    try {
      const stats = await supabaseExchangeRateService.getRateStats();
      setRateStats(stats);
    } catch (error) {
      logger.error('Failed to load rate stats:', error);
    }
  };

  // 加载汇率历史记录
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

  // 加载更新日志
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

  // 手动更新汇率（使用前端调度器）
  const handleUpdateRates = async () => {
    setIsUpdating(true);
    try {
      const result = await exchangeRateScheduler.triggerUpdate();
      
      if (result.success) {
        // 刷新汇率数据
        await fetchExchangeRates();
        await loadRateStats();
        await loadUpdateLogs();
        await loadSchedulerStatus();
        logger.info(`Successfully updated ${result.ratesUpdated} exchange rates`);
      } else {
        throw new Error(result.error || 'Update failed');
      }
    } catch (error) {
      logger.error('Failed to update exchange rates:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 加载定时任务状态
  const loadSchedulerStatus = async () => {
    setIsLoadingScheduler(true);
    try {
      const status = exchangeRateScheduler.getStatus();
      setSchedulerStatus(status);
    } catch (error) {
      logger.error('Failed to load scheduler status:', error);
    } finally {
      setIsLoadingScheduler(false);
    }
  };

  // 清理旧数据
  const handleCleanupOldData = async (days: number = 90) => {
    try {
      await supabaseExchangeRateService.cleanupOldHistory(days);
      logger.info(`Successfully cleaned up data older than ${days} days`);
      await loadRateStats();
      await loadUpdateLogs();
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
    }
  };

  // 启动/停止调度器
  const handleToggleScheduler = () => {
    if (schedulerStatus?.isRunning) {
      exchangeRateScheduler.stop();
    } else {
      exchangeRateScheduler.start();
    }
    loadSchedulerStatus();
  };

  // 组件加载时获取统计信息
  useEffect(() => {
    loadRateStats();
    loadSchedulerStatus();
  }, []);

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
        return <Badge variant="default" className="bg-green-100 text-green-800">成功</Badge>;
      case 'failed':
        return <Badge variant="destructive">失败</Badge>;
      case 'partial':
        return <Badge variant="secondary">部分成功</Badge>;
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="settings">设置</TabsTrigger>
          <TabsTrigger value="status">状态</TabsTrigger>
          <TabsTrigger value="scheduler">定时任务</TabsTrigger>
          <TabsTrigger value="history">历史记录</TabsTrigger>
          <TabsTrigger value="logs">更新日志</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          {/* 货币设置和汇率列表 */}
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
                  汇率操作
                </CardTitle>
                <CardDescription>
                  手动更新汇率和刷新数据
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      汇率数据通过Edge Function自动更新，支持手动触发更新
                    </p>
                  </div>

                  {rateStats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">总汇率数量</p>
                        <p className="text-sm text-muted-foreground">{rateStats.total_rates}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">支持货币</p>
                        <p className="text-sm text-muted-foreground">{rateStats.supported_currencies.length} 种</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">最后更新</p>
                        <p className="text-sm text-muted-foreground">
                          {rateStats.latest_update ? formatUpdateTime(rateStats.latest_update) : '无'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">今日失败次数</p>
                        <p className="text-sm text-muted-foreground">{rateStats.failed_updates_today}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleUpdateRates}
                    disabled={isUpdating}
                    size="sm"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    更新汇率
                  </Button>

                  <Button
                    onClick={fetchExchangeRates}
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新数据
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 汇率列表 */}
          <Card>
            <CardHeader>
              <CardTitle>当前汇率</CardTitle>
              <CardDescription>
                所有汇率相对于 {currency} (1 {currency} = X 货币)
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
                  <p>暂无汇率数据</p>
                  <Button
                    onClick={fetchExchangeRates}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    加载汇率
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                定时任务管理
              </CardTitle>
              <CardDescription>
                管理汇率自动更新定时任务
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingScheduler ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">加载定时任务状态中...</p>
                </div>
              ) : schedulerStatus ? (
                <div className="space-y-6">
                  {/* 调度器状态 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className={`h-4 w-4 ${schedulerStatus.isRunning ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="font-medium">调度器状态</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {schedulerStatus.isRunning ? '运行中' : '已停止'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        前端自动更新调度器
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">下次更新时间</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {schedulerStatus.nextUpdate 
                          ? formatUpdateTime(schedulerStatus.nextUpdate)
                          : '未设置'
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        预计下次自动更新
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">失败次数</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {schedulerStatus.failedAttempts}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        连续失败尝试次数
                      </p>
                    </div>
                  </div>

                  {/* 调度器控制 */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-blue-900">自动更新设置</h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="scheduler-toggle" className="text-sm text-blue-800">
                          启用自动更新
                        </Label>
                        <Switch
                          id="scheduler-toggle"
                          checked={schedulerStatus.isRunning}
                          onCheckedChange={handleToggleScheduler}
                        />
                      </div>
                    </div>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• 每6小时自动更新一次汇率数据</li>
                      <li>• 支持手动触发更新</li>
                      <li>• 失败时自动重试（最多3次）</li>
                      <li>• 更新间隔: {Math.round(schedulerStatus.updateInterval / (60 * 60 * 1000))} 小时</li>
                    </ul>
                  </div>

                  {/* 最后更新信息 */}
                  {schedulerStatus.lastUpdate && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="h-4 w-4 text-green-500" />
                        <span className="font-medium">最后更新时间</span>
                      </div>
                      <p className="text-lg">
                        {formatUpdateTime(schedulerStatus.lastUpdate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        上次成功更新汇率数据的时间
                      </p>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={loadSchedulerStatus}
                      variant="outline"
                      size="sm"
                      disabled={isLoadingScheduler}
                    >
                      {isLoadingScheduler ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      刷新状态
                    </Button>

                    <Button
                      onClick={handleUpdateRates}
                      size="sm"
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      立即更新
                    </Button>

                    <Button
                      onClick={() => handleCleanupOldData(90)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      清理旧数据
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>无法获取定时任务状态</p>
                  <Button
                    onClick={loadSchedulerStatus}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    重试
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                汇率系统状态
              </CardTitle>
              <CardDescription>
                系统运行状态和统计信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rateStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">总汇率数量</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.total_rates}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">支持货币</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.supported_currencies.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rateStats.supported_currencies.join(', ')}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium">今日失败次数</span>
                    </div>
                    <p className="text-2xl font-bold">{rateStats.failed_updates_today}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 text-green-500" />
                      <span className="font-medium">最后成功更新</span>
                    </div>
                    <p className="text-lg">
                      {rateStats.last_successful_update 
                        ? formatUpdateTime(rateStats.last_successful_update)
                        : '暂无记录'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">加载状态信息中...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                汇率历史记录
              </CardTitle>
              <CardDescription>
                查看汇率变更历史
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  显示最近的汇率变更记录
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
                  刷新
                </Button>
              </div>

              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">加载历史记录中...</p>
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
                  <p>暂无历史记录</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                更新日志
              </CardTitle>
              <CardDescription>
                查看汇率更新操作日志
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  显示最近的更新操作记录
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
                  刷新
                </Button>
              </div>

              {isLoadingLogs ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">加载更新日志中...</p>
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
                          开始: {formatUpdateTime(log.started_at)}
                          {log.completed_at && (
                            <> | 完成: {formatUpdateTime(log.completed_at)}</>
                          )}
                        </p>
                        {log.error_message && (
                          <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{log.rates_updated} 条</p>
                        <p className="text-xs text-muted-foreground">已更新</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>暂无更新日志</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
