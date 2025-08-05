import React, { useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'

/**
 * 设置缓存测试页面
 * 用于验证 settingsStore 的缓存机制是否正常工作
 */
export const SettingsCacheTestPage: React.FC = () => {
  const {
    currency,
    theme,
    showOriginalCurrency,
    notifications,
    userSettingsCache,
    userSettingsCacheTimestamp,
    isLoading,
    error,
    fetchSettings,
    getCachedSetting,
    isSettingsCacheValid,
    clearUserCache
  } = useSettingsStore()

  const [testResults, setTestResults] = useState<string[]>([])

  /**
   * 添加测试结果
   */
  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  /**
   * 测试获取设置
   */
  const handleFetchSettings = async () => {
    addTestResult('开始获取设置...')
    try {
      await fetchSettings()
      addTestResult('✅ 设置获取成功')
    } catch (error) {
      addTestResult(`❌ 设置获取失败: ${error}`)
    }
  }

  /**
   * 测试缓存功能
   */
  const handleTestCache = () => {
    const isValid = isSettingsCacheValid()
    addTestResult(`缓存状态: ${isValid ? '✅ 有效' : '❌ 无效或不存在'}`)
    
    if (userSettingsCache) {
      const cacheKeys = Object.keys(userSettingsCache)
      addTestResult(`缓存键: ${cacheKeys.join(', ')}`)
      
      // 测试获取特定设置
      const currencySetting = getCachedSetting('currency')
      const themeSetting = getCachedSetting('theme')
      addTestResult(`缓存中的货币设置: ${JSON.stringify(currencySetting)}`)
      addTestResult(`缓存中的主题设置: ${JSON.stringify(themeSetting)}`)
    }
  }

  /**
   * 清除缓存
   */
  const handleClearCache = () => {
    clearUserCache()
    addTestResult('🗑️ 缓存已清除')
  }

  /**
   * 清除测试结果
   */
  const handleClearResults = () => {
    setTestResults([])
  }

  /**
   * 格式化时间戳
   */
  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return '无'
    return new Date(timestamp).toLocaleString()
  }

  /**
   * 计算缓存年龄
   */
  const getCacheAge = () => {
    if (!userSettingsCacheTimestamp) return '无缓存'
    const ageInSeconds = Math.round((Date.now() - userSettingsCacheTimestamp) / 1000)
    return `${ageInSeconds}秒前`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">设置缓存测试</h1>
        <Badge variant={isSettingsCacheValid() ? 'default' : 'secondary'}>
          {isSettingsCacheValid() ? '缓存有效' : '缓存无效'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 当前设置状态 */}
        <Card>
          <CardHeader>
            <CardTitle>当前设置状态</CardTitle>
            <CardDescription>从 settingsStore 获取的当前设置值</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">货币:</span>
              <span>{currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">主题:</span>
              <span>{theme}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">显示原始货币:</span>
              <span>{showOriginalCurrency ? '是' : '否'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">通知设置:</span>
              <span className="text-sm">
                邮件: {notifications.email ? '✅' : '❌'}, 
                续费提醒: {notifications.renewal_reminders ? '✅' : '❌'}, 
                支付通知: {notifications.payment_notifications ? '✅' : '❌'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">加载状态:</span>
              <span>{isLoading ? '加载中...' : '已完成'}</span>
            </div>
            {error && (
              <div className="flex justify-between">
                <span className="font-medium text-red-600">错误:</span>
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 缓存信息 */}
        <Card>
          <CardHeader>
            <CardTitle>缓存信息</CardTitle>
            <CardDescription>用户设置缓存的详细信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">缓存状态:</span>
              <Badge variant={isSettingsCacheValid() ? 'default' : 'secondary'}>
                {isSettingsCacheValid() ? '有效' : '无效'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">缓存时间:</span>
              <span className="text-sm">{formatTimestamp(userSettingsCacheTimestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">缓存年龄:</span>
              <span className="text-sm">{getCacheAge()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">缓存项数:</span>
              <span>{userSettingsCache ? Object.keys(userSettingsCache).length : 0}</span>
            </div>
            {userSettingsCache && (
              <div className="mt-3">
                <span className="font-medium">缓存键:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.keys(userSettingsCache).map(key => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>测试操作</CardTitle>
          <CardDescription>测试设置缓存的各种功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleFetchSettings} disabled={isLoading}>
              {isLoading ? '获取中...' : '获取设置'}
            </Button>
            <Button onClick={handleTestCache} variant="outline">
              测试缓存
            </Button>
            <Button onClick={handleClearCache} variant="destructive">
              清除缓存
            </Button>
            <Button onClick={handleClearResults} variant="secondary">
              清除日志
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试日志</CardTitle>
            <CardDescription>操作和测试的详细日志</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono mb-1">
                  {result}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SettingsCacheTestPage