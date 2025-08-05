/**
 * 缓存监控和性能分析工具
 * 用于监控settingsStore中缓存的使用情况和性能表现
 */

import { useSettingsStore } from '@/store/settingsStore'
import { logger } from '@/utils/logger'

/**
 * 缓存统计信息接口
 */
interface CacheStats {
  totalCacheEntries: number // 总缓存条目数
  userCacheStatus: {
    hasCache: boolean
    cacheAge: number
    isValid: boolean
  }
  globalCacheByType: Record<string, number> // 按类型统计的缓存数量
  oldestCacheEntry: {
    key: string
    age: number
  } | null
  newestCacheEntry: {
    key: string
    age: number
  } | null
  memoryUsageEstimate: number // 内存使用估算（字节）
}

/**
 * 缓存性能指标接口
 */
interface CachePerformanceMetrics {
  hitRate: number // 缓存命中率
  missRate: number // 缓存未命中率
  averageResponseTime: number // 平均响应时间
  totalRequests: number // 总请求数
  cacheHits: number // 缓存命中数
  cacheMisses: number // 缓存未命中数
}

/**
 * 缓存监控类
 */
class CacheMonitor {
  private performanceMetrics: CachePerformanceMetrics = {
    hitRate: 0,
    missRate: 0,
    averageResponseTime: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  }

  private requestTimes: number[] = []

  /**
   * 获取当前缓存统计信息
   */
  getCacheStats(): CacheStats {
    const store = useSettingsStore.getState()
    const globalCache = store.globalCache
    const now = Date.now()

    // 统计全局缓存
    const cacheEntries = Object.entries(globalCache)
    const totalCacheEntries = cacheEntries.length

    // 按类型统计缓存
    const globalCacheByType: Record<string, number> = {}
    let oldestEntry: { key: string; age: number } | null = null
    let newestEntry: { key: string; age: number } | null = null
    let totalMemorySize = 0

    cacheEntries.forEach(([key, value]) => {
      // 提取缓存类型（key格式：type:id）
      const type = key.split(':')[0]
      globalCacheByType[type] = (globalCacheByType[type] || 0) + 1

      // 计算缓存年龄
      const age = now - value.timestamp

      // 找到最老和最新的缓存条目
      if (!oldestEntry || age > oldestEntry.age) {
        oldestEntry = { key, age }
      }
      if (!newestEntry || age < newestEntry.age) {
        newestEntry = { key, age }
      }

      // 估算内存使用（简单的JSON字符串长度估算）
      try {
        totalMemorySize += JSON.stringify(value.data).length * 2 // 假设每个字符2字节
      } catch (error) {
        // 如果数据无法序列化，使用固定估算值
        totalMemorySize += 1024 // 1KB估算
      }
    })

    return {
      totalCacheEntries,
      userCacheStatus: store.getUserCacheStatus(),
      globalCacheByType,
      oldestCacheEntry: oldestEntry,
      newestCacheEntry: newestEntry,
      memoryUsageEstimate: totalMemorySize
    }
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit(responseTime: number = 0): void {
    this.performanceMetrics.cacheHits++
    this.performanceMetrics.totalRequests++
    this.requestTimes.push(responseTime)
    this.updateMetrics()
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(responseTime: number = 0): void {
    this.performanceMetrics.cacheMisses++
    this.performanceMetrics.totalRequests++
    this.requestTimes.push(responseTime)
    this.updateMetrics()
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    const { totalRequests, cacheHits, cacheMisses } = this.performanceMetrics
    
    if (totalRequests > 0) {
      this.performanceMetrics.hitRate = (cacheHits / totalRequests) * 100
      this.performanceMetrics.missRate = (cacheMisses / totalRequests) * 100
    }

    if (this.requestTimes.length > 0) {
      const totalTime = this.requestTimes.reduce((sum, time) => sum + time, 0)
      this.performanceMetrics.averageResponseTime = totalTime / this.requestTimes.length
    }

    // 保持最近100次请求的记录
    if (this.requestTimes.length > 100) {
      this.requestTimes = this.requestTimes.slice(-100)
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): CachePerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      hitRate: 0,
      missRate: 0,
      averageResponseTime: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0
    }
    this.requestTimes = []
  }

  /**
   * 生成缓存报告
   */
  generateCacheReport(): string {
    const stats = this.getCacheStats()
    const metrics = this.getPerformanceMetrics()

    const report = `
=== 缓存监控报告 ===
生成时间: ${new Date().toLocaleString()}

--- 缓存统计 ---
总缓存条目数: ${stats.totalCacheEntries}
内存使用估算: ${(stats.memoryUsageEstimate / 1024).toFixed(2)} KB

用户缓存状态:
- 是否有缓存: ${stats.userCacheStatus.hasCache ? '是' : '否'}
- 缓存年龄: ${(stats.userCacheStatus.cacheAge / 1000).toFixed(2)} 秒
- 缓存是否有效: ${stats.userCacheStatus.isValid ? '是' : '否'}

按类型统计的缓存:
${Object.entries(stats.globalCacheByType)
  .map(([type, count]) => `- ${type}: ${count} 条`)
  .join('\n')}

最老缓存条目: ${stats.oldestCacheEntry ? 
  `${stats.oldestCacheEntry.key} (${(stats.oldestCacheEntry.age / 1000).toFixed(2)} 秒前)` : 
  '无'}
最新缓存条目: ${stats.newestCacheEntry ? 
  `${stats.newestCacheEntry.key} (${(stats.newestCacheEntry.age / 1000).toFixed(2)} 秒前)` : 
  '无'}

--- 性能指标 ---
总请求数: ${metrics.totalRequests}
缓存命中数: ${metrics.cacheHits}
缓存未命中数: ${metrics.cacheMisses}
缓存命中率: ${metrics.hitRate.toFixed(2)}%
缓存未命中率: ${metrics.missRate.toFixed(2)}%
平均响应时间: ${metrics.averageResponseTime.toFixed(2)} ms

--- 建议 ---
${this.generateRecommendations(stats, metrics)}
`

    return report
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(stats: CacheStats, metrics: CachePerformanceMetrics): string {
    const recommendations: string[] = []

    // 基于命中率的建议
    if (metrics.totalRequests > 10) {
      if (metrics.hitRate < 50) {
        recommendations.push('缓存命中率较低，考虑增加缓存时间或优化缓存策略')
      } else if (metrics.hitRate > 90) {
        recommendations.push('缓存命中率很高，当前缓存策略效果良好')
      }
    }

    // 基于内存使用的建议
    const memoryMB = stats.memoryUsageEstimate / (1024 * 1024)
    if (memoryMB > 10) {
      recommendations.push('缓存内存使用较高，考虑实施缓存清理策略')
    }

    // 基于缓存条目数的建议
    if (stats.totalCacheEntries > 100) {
      recommendations.push('缓存条目数较多，建议定期清理过期缓存')
    }

    // 基于用户缓存状态的建议
    if (!stats.userCacheStatus.isValid && stats.userCacheStatus.hasCache) {
      recommendations.push('用户缓存已过期，将在下次请求时自动刷新')
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '当前缓存状态良好，无特殊建议'
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache(): number {
    const store = useSettingsStore.getState()
    const now = Date.now()
    let cleanedCount = 0

    // 清理过期的全局缓存（超过缓存时间的2倍）
    const CLEANUP_THRESHOLD = 600000 * 2 // 20分钟
    
    Object.keys(store.globalCache).forEach(key => {
      const cacheEntry = store.globalCache[key]
      if (now - cacheEntry.timestamp > CLEANUP_THRESHOLD) {
        store.clearGlobalCache(key)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      logger.info(`缓存清理完成，清理了 ${cleanedCount} 个过期缓存条目`)
    }

    return cleanedCount
  }
}

// 导出单例实例
export const cacheMonitor = new CacheMonitor()

/**
 * 开发环境下的缓存调试工具
 */
export const cacheDebugTools = {
  /**
   * 在控制台打印缓存报告
   */
  printCacheReport(): void {
    console.log(cacheMonitor.generateCacheReport())
  },

  /**
   * 在控制台打印缓存统计
   */
  printCacheStats(): void {
    console.table(cacheMonitor.getCacheStats())
  },

  /**
   * 在控制台打印性能指标
   */
  printPerformanceMetrics(): void {
    console.table(cacheMonitor.getPerformanceMetrics())
  },

  /**
   * 清理过期缓存并报告结果
   */
  cleanupAndReport(): void {
    const cleanedCount = cacheMonitor.cleanupExpiredCache()
    console.log(`缓存清理完成，清理了 ${cleanedCount} 个过期缓存条目`)
  },

  /**
   * 重置所有监控数据
   */
  resetMonitoring(): void {
    cacheMonitor.resetMetrics()
    console.log('缓存监控数据已重置')
  }
}

// 在开发环境下将调试工具挂载到window对象
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).cacheDebugTools = cacheDebugTools
  console.log('缓存调试工具已挂载到 window.cacheDebugTools')
}