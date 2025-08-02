/**
 * 汇率自动更新调度服务
 * 在前端实现定时任务调度功能
 */

import { supabaseExchangeRateService } from './supabaseExchangeRateService'
import { logger } from '@/utils/logger'

export interface SchedulerStatus {
  isRunning: boolean
  nextUpdate: string | null
  lastUpdate: string | null
  updateInterval: number // 毫秒
  failedAttempts: number
}

export interface UpdateResult {
  success: boolean
  ratesUpdated: number
  error?: string
  timestamp: string
}

class ExchangeRateScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private status: SchedulerStatus = {
    isRunning: false,
    nextUpdate: null,
    lastUpdate: null,
    updateInterval: 6 * 60 * 60 * 1000, // 6小时
    failedAttempts: 0
  }
  private maxRetries = 3
  private retryDelay = 5 * 60 * 1000 // 5分钟

  /**
   * 启动定时任务
   */
  start(): void {
    if (this.status.isRunning) {
      logger.warn('Scheduler is already running')
      return
    }

    this.status.isRunning = true
    this.status.nextUpdate = new Date(Date.now() + this.status.updateInterval).toISOString()
    
    // 设置定时器
    this.intervalId = setInterval(() => {
      this.performScheduledUpdate()
    }, this.status.updateInterval)

    logger.info('Exchange rate scheduler started')
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.status.isRunning = false
    this.status.nextUpdate = null
    
    logger.info('Exchange rate scheduler stopped')
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus {
    return { ...this.status }
  }

  /**
   * 手动触发更新
   */
  async triggerUpdate(): Promise<UpdateResult> {
    logger.info('Manual exchange rate update triggered')
    return await this.updateExchangeRates('manual')
  }

  /**
   * 执行定时更新
   */
  private async performScheduledUpdate(): Promise<void> {
    logger.info('Performing scheduled exchange rate update')
    
    try {
      const result = await this.updateExchangeRates('scheduled')
      
      if (result.success) {
        this.status.failedAttempts = 0
        this.status.lastUpdate = result.timestamp
        this.status.nextUpdate = new Date(Date.now() + this.status.updateInterval).toISOString()
      } else {
        this.handleUpdateFailure()
      }
    } catch (error) {
      logger.error('Scheduled update failed:', error)
      this.handleUpdateFailure()
    }
  }

  /**
   * 处理更新失败
   */
  private handleUpdateFailure(): void {
    this.status.failedAttempts++
    
    if (this.status.failedAttempts >= this.maxRetries) {
      logger.error(`Exchange rate update failed ${this.maxRetries} times, stopping scheduler`)
      this.stop()
    } else {
      // 设置重试
      setTimeout(() => {
        this.performScheduledUpdate()
      }, this.retryDelay)
      
      logger.warn(`Update failed, will retry in ${this.retryDelay / 1000} seconds (attempt ${this.status.failedAttempts}/${this.maxRetries})`)
    }
  }

  /**
   * 执行汇率更新
   */
  private async updateExchangeRates(updateType: 'manual' | 'scheduled'): Promise<UpdateResult> {
    const timestamp = new Date().toISOString()
    
    try {
      // 模拟汇率数据（实际应用中应该从API获取）
      const mockRates = [
        { from_currency: 'CNY', to_currency: 'USD', rate: 0.1373, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'EUR', rate: 0.1267, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'GBP', rate: 0.1089, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'CAD', rate: 0.1923, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'AUD', rate: 0.2156, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'JPY', rate: 21.45, date: timestamp.split('T')[0], source: 'api' },
        { from_currency: 'CNY', to_currency: 'CNY', rate: 1.0, date: timestamp.split('T')[0], source: 'system' }
      ]

      // 使用服务更新汇率
      const result = await supabaseExchangeRateService.batchUpdateRates(
        mockRates,
        updateType,
        'scheduler'
      )

      logger.info(`Successfully updated ${result.updated} exchange rates`)

      return {
        success: true,
        ratesUpdated: result.updated,
        timestamp
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Exchange rate update failed:', errorMessage)

      return {
        success: false,
        ratesUpdated: 0,
        error: errorMessage,
        timestamp
      }
    }
  }

  /**
   * 设置更新间隔
   */
  setUpdateInterval(intervalMs: number): void {
    this.status.updateInterval = intervalMs
    
    if (this.status.isRunning) {
      // 重启调度器以应用新间隔
      this.stop()
      this.start()
    }
  }

  /**
   * 获取下次更新时间
   */
  getNextUpdateTime(): Date | null {
    return this.status.nextUpdate ? new Date(this.status.nextUpdate) : null
  }

  /**
   * 获取上次更新时间
   */
  getLastUpdateTime(): Date | null {
    return this.status.lastUpdate ? new Date(this.status.lastUpdate) : null
  }

  /**
   * 重置失败计数
   */
  resetFailedAttempts(): void {
    this.status.failedAttempts = 0
  }
}

// 导出单例实例
export const exchangeRateScheduler = new ExchangeRateScheduler()

// 自动启动调度器（在生产环境中）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // 延迟启动，避免在页面加载时立即执行
  setTimeout(() => {
    exchangeRateScheduler.start()
  }, 30000) // 30秒后启动
}

export default ExchangeRateScheduler