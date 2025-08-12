# 缓存监控使用指南

本指南介绍如何使用项目中的缓存监控工具来监控和优化缓存性能。

## 📋 目录

1. [快速开始](#快速开始)
2. [开发环境调试](#开发环境调试)
3. [生产环境监控](#生产环境监控)
4. [性能分析](#性能分析)
5. [故障排查](#故障排查)
6. [最佳实践](#最佳实践)

## 🚀 快速开始

### 导入监控工具

```typescript
import { cacheMonitor, cacheDebugTools } from '@/utils/cacheMonitor'
```

### 基本使用

```typescript
// 获取缓存统计信息
const stats = cacheMonitor.getCacheStats()
console.log('缓存统计:', stats)

// 获取性能指标
const metrics = cacheMonitor.getPerformanceMetrics()
console.log('性能指标:', metrics)

// 生成完整报告
const report = cacheMonitor.generateCacheReport()
console.log(report)
```

## 🛠️ 开发环境调试

在开发环境中，缓存调试工具会自动挂载到 `window` 对象上，可以直接在浏览器控制台中使用：

### 基本调试命令

```javascript
// 打印完整的缓存报告
window.cacheDebugTools.printCacheReport()

// 打印缓存统计（表格形式）
window.cacheDebugTools.printCacheStats()

// 打印性能指标（表格形式）
window.cacheDebugTools.printPerformanceMetrics()

// 清理过期缓存并报告结果
window.cacheDebugTools.cleanupAndReport()

// 重置所有监控数据
window.cacheDebugTools.resetMonitoring()
```

### 调试场景示例

#### 场景1：检查缓存是否正常工作

```javascript
// 1. 重置监控数据
window.cacheDebugTools.resetMonitoring()

// 2. 执行一些操作（如切换页面、更新设置等）
// ...

// 3. 检查缓存统计
window.cacheDebugTools.printCacheStats()

// 4. 查看性能指标
window.cacheDebugTools.printPerformanceMetrics()
```

#### 场景2：分析缓存命中率

```javascript
// 执行多次相同操作后检查命中率
const metrics = cacheMonitor.getPerformanceMetrics()
if (metrics.hitRate < 50) {
  console.warn('缓存命中率较低:', metrics.hitRate + '%')
  console.log('建议检查缓存策略或增加缓存时间')
}
```

#### 场景3：内存使用分析

```javascript
const stats = cacheMonitor.getCacheStats()
const memoryMB = stats.memoryUsageEstimate / (1024 * 1024)

if (memoryMB > 10) {
  console.warn('缓存内存使用较高:', memoryMB.toFixed(2) + 'MB')
  window.cacheDebugTools.cleanupAndReport()
}
```

## 📊 生产环境监控

### 集成到应用中

```typescript
import { cacheMonitor } from '@/utils/cacheMonitor'
import { logger } from '@/utils/logger'

// 定期监控缓存状态
setInterval(() => {
  const stats = cacheMonitor.getCacheStats()
  const metrics = cacheMonitor.getPerformanceMetrics()
  
  // 记录关键指标
  logger.info('缓存监控', {
    totalEntries: stats.totalCacheEntries,
    memoryUsage: stats.memoryUsageEstimate,
    hitRate: metrics.hitRate,
    totalRequests: metrics.totalRequests
  })
  
  // 检查异常情况
  if (metrics.hitRate < 30 && metrics.totalRequests > 10) {
    logger.warn('缓存命中率异常低', metrics)
  }
  
  if (stats.memoryUsageEstimate > 50 * 1024 * 1024) { // 50MB
    logger.warn('缓存内存使用过高', stats)
    cacheMonitor.cleanupExpiredCache()
  }
}, 5 * 60 * 1000) // 每5分钟检查一次
```

### 用户体验监控

```typescript
// 在关键操作中记录性能
const measureCachePerformance = async (operation: string, fn: () => Promise<any>) => {
  const startTime = performance.now()
  
  try {
    const result = await fn()
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // 假设如果响应时间很短，可能是缓存命中
    if (duration < 50) {
      cacheMonitor.recordCacheHit(duration)
    } else {
      cacheMonitor.recordCacheMiss(duration)
    }
    
    logger.info(`操作 ${operation} 完成`, {
      duration: duration.toFixed(2) + 'ms',
      likelyCacheHit: duration < 50
    })
    
    return result
  } catch (error) {
    const endTime = performance.now()
    cacheMonitor.recordCacheMiss(endTime - startTime)
    throw error
  }
}

// 使用示例
const fetchUserSettings = () => measureCachePerformance(
  'fetchUserSettings',
  () => useSettingsStore.getState().fetchSettings()
)
```

## 📈 性能分析

### 生成详细报告

```typescript
const generatePerformanceReport = () => {
  const report = cacheMonitor.generateCacheReport()
  const stats = cacheMonitor.getCacheStats()
  const metrics = cacheMonitor.getPerformanceMetrics()
  
  // 分析缓存效率
  const efficiency = {
    isEfficient: metrics.hitRate > 70,
    memoryEfficient: stats.memoryUsageEstimate < 10 * 1024 * 1024, // 10MB
    responseTimeGood: metrics.averageResponseTime < 100, // 100ms
    cacheCountReasonable: stats.totalCacheEntries < 100
  }
  
  return {
    report,
    stats,
    metrics,
    efficiency,
    recommendations: generateRecommendations(efficiency, stats, metrics)
  }
}

const generateRecommendations = (efficiency: any, stats: any, metrics: any) => {
  const recommendations = []
  
  if (!efficiency.isEfficient) {
    recommendations.push('考虑增加缓存时间或优化缓存策略')
  }
  
  if (!efficiency.memoryEfficient) {
    recommendations.push('实施更积极的缓存清理策略')
  }
  
  if (!efficiency.responseTimeGood) {
    recommendations.push('检查网络请求或数据处理逻辑')
  }
  
  if (!efficiency.cacheCountReasonable) {
    recommendations.push('考虑实施缓存条目数量限制')
  }
  
  return recommendations
}
```

### 性能趋势分析

```typescript
class CacheTrendAnalyzer {
  private history: Array<{
    timestamp: number
    stats: any
    metrics: any
  }> = []
  
  recordSnapshot() {
    this.history.push({
      timestamp: Date.now(),
      stats: cacheMonitor.getCacheStats(),
      metrics: cacheMonitor.getPerformanceMetrics()
    })
    
    // 保持最近24小时的数据
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.history = this.history.filter(record => record.timestamp > oneDayAgo)
  }
  
  analyzeTrends() {
    if (this.history.length < 2) return null
    
    const latest = this.history[this.history.length - 1]
    const previous = this.history[this.history.length - 2]
    
    return {
      hitRateTrend: latest.metrics.hitRate - previous.metrics.hitRate,
      memoryTrend: latest.stats.memoryUsageEstimate - previous.stats.memoryUsageEstimate,
      responseTimeTrend: latest.metrics.averageResponseTime - previous.metrics.averageResponseTime,
      cacheCountTrend: latest.stats.totalCacheEntries - previous.stats.totalCacheEntries
    }
  }
}

const trendAnalyzer = new CacheTrendAnalyzer()

// 每小时记录一次快照
setInterval(() => {
  trendAnalyzer.recordSnapshot()
}, 60 * 60 * 1000)
```

## 🔍 故障排查

### 常见问题诊断

#### 问题1：缓存命中率低

```typescript
const diagnoseLowHitRate = () => {
  const metrics = cacheMonitor.getPerformanceMetrics()
  const stats = cacheMonitor.getCacheStats()
  
  if (metrics.hitRate < 50 && metrics.totalRequests > 10) {
    console.group('🔍 缓存命中率低诊断')
    
    // 检查缓存配置
    console.log('当前缓存条目数:', stats.totalCacheEntries)
    console.log('用户缓存状态:', stats.userCacheStatus)
    
    // 检查缓存年龄
    if (stats.oldestCacheEntry) {
      const ageMinutes = stats.oldestCacheEntry.age / (1000 * 60)
      console.log('最老缓存年龄:', ageMinutes.toFixed(2) + '分钟')
      
      if (ageMinutes < 1) {
        console.warn('缓存过期太快，建议增加缓存时间')
      }
    }
    
    // 检查缓存类型分布
    console.log('缓存类型分布:', stats.globalCacheByType)
    
    console.groupEnd()
  }
}
```

#### 问题2：内存使用过高

```typescript
const diagnoseHighMemoryUsage = () => {
  const stats = cacheMonitor.getCacheStats()
  const memoryMB = stats.memoryUsageEstimate / (1024 * 1024)
  
  if (memoryMB > 20) {
    console.group('🔍 内存使用过高诊断')
    
    console.log('总内存使用:', memoryMB.toFixed(2) + 'MB')
    console.log('缓存条目数:', stats.totalCacheEntries)
    console.log('平均每条目大小:', (stats.memoryUsageEstimate / stats.totalCacheEntries / 1024).toFixed(2) + 'KB')
    
    // 分析缓存类型
    Object.entries(stats.globalCacheByType).forEach(([type, count]) => {
      console.log(`${type} 类型缓存: ${count} 条`)
    })
    
    // 建议清理
    console.log('建议执行缓存清理:')
    const cleanedCount = cacheMonitor.cleanupExpiredCache()
    console.log('清理了', cleanedCount, '个过期缓存条目')
    
    console.groupEnd()
  }
}
```

#### 问题3：数据不一致

```typescript
const diagnoseDataInconsistency = () => {
  const stats = cacheMonitor.getCacheStats()
  
  console.group('🔍 数据一致性检查')
  
  // 检查用户缓存状态
  if (stats.userCacheStatus.hasCache && !stats.userCacheStatus.isValid) {
    console.warn('用户缓存已过期但未清理')
  }
  
  // 检查缓存年龄分布
  const now = Date.now()
  const store = useSettingsStore.getState()
  
  Object.entries(store.globalCache).forEach(([key, value]) => {
    const age = now - value.timestamp
    const ageMinutes = age / (1000 * 60)
    
    if (ageMinutes > 15) { // 超过15分钟的缓存
      console.warn(`缓存条目 ${key} 年龄过大: ${ageMinutes.toFixed(2)}分钟`)
    }
  })
  
  console.groupEnd()
}
```

## 💡 最佳实践

### 1. 定期监控

```typescript
// 在应用启动时设置定期监控
const setupCacheMonitoring = () => {
  // 每5分钟检查一次缓存状态
  setInterval(() => {
    const stats = cacheMonitor.getCacheStats()
    const metrics = cacheMonitor.getPerformanceMetrics()
    
    // 记录到日志系统
    logger.info('缓存状态检查', {
      hitRate: metrics.hitRate,
      totalEntries: stats.totalCacheEntries,
      memoryMB: (stats.memoryUsageEstimate / (1024 * 1024)).toFixed(2)
    })
    
    // 自动清理过期缓存
    if (stats.totalCacheEntries > 50) {
      cacheMonitor.cleanupExpiredCache()
    }
  }, 5 * 60 * 1000)
}
```

### 2. 性能基准测试

```typescript
const runCacheBenchmark = async () => {
  console.log('🚀 开始缓存性能基准测试')
  
  // 重置监控数据
  cacheMonitor.resetMetrics()
  
  const operations = [
    () => useSettingsStore.getState().fetchSettings(),
    () => useSettingsStore.getState().getCurrentUser(),
    () => useSettingsStore.getState().fetchExchangeRates()
  ]
  
  // 执行多次操作
  for (let i = 0; i < 10; i++) {
    for (const operation of operations) {
      const startTime = performance.now()
      await operation()
      const endTime = performance.now()
      
      // 记录性能数据
      if (endTime - startTime < 50) {
        cacheMonitor.recordCacheHit(endTime - startTime)
      } else {
        cacheMonitor.recordCacheMiss(endTime - startTime)
      }
    }
  }
  
  // 输出结果
  const metrics = cacheMonitor.getPerformanceMetrics()
  console.log('基准测试结果:', metrics)
  
  return metrics
}
```

### 3. 缓存预热

```typescript
const warmupCache = async () => {
  console.log('🔥 开始缓存预热')
  
  const store = useSettingsStore.getState()
  
  try {
    // 预加载关键数据
    await Promise.all([
      store.fetchSettings(),
      store.getCurrentUser(),
      store.fetchExchangeRates()
    ])
    
    console.log('✅ 缓存预热完成')
    
    // 检查预热效果
    const stats = cacheMonitor.getCacheStats()
    console.log('预热后缓存状态:', {
      totalEntries: stats.totalCacheEntries,
      userCacheValid: stats.userCacheStatus.isValid
    })
  } catch (error) {
    console.error('❌ 缓存预热失败:', error)
  }
}
```

### 4. 缓存策略优化

```typescript
const optimizeCacheStrategy = () => {
  const stats = cacheMonitor.getCacheStats()
  const metrics = cacheMonitor.getPerformanceMetrics()
  
  // 基于统计数据调整策略
  if (metrics.hitRate > 90 && stats.memoryUsageEstimate < 5 * 1024 * 1024) {
    console.log('💡 建议：可以进一步延长缓存时间')
  } else if (metrics.hitRate < 50) {
    console.log('💡 建议：检查缓存失效逻辑，可能过于频繁')
  } else if (stats.memoryUsageEstimate > 20 * 1024 * 1024) {
    console.log('💡 建议：实施更积极的缓存清理策略')
  }
  
  // 分析缓存类型使用情况
  const typeUsage = Object.entries(stats.globalCacheByType)
    .sort(([,a], [,b]) => b - a)
  
  console.log('缓存类型使用排序:', typeUsage)
  
  // 对使用频率低的类型建议缩短缓存时间
  typeUsage.forEach(([type, count]) => {
    if (count < 2) {
      console.log(`💡 建议：${type} 类型使用频率低，可考虑缩短缓存时间`)
    }
  })
}
```

## 📝 总结

缓存监控工具提供了全面的缓存性能分析能力，通过合理使用这些工具，可以：

1. **实时监控**缓存状态和性能指标
2. **快速诊断**缓存相关问题
3. **优化缓存策略**提升应用性能
4. **预防问题**通过趋势分析提前发现潜在问题

建议在开发和生产环境中都集成缓存监控，以确保缓存系统的最佳性能。