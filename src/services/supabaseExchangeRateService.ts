import { supabase } from '@/lib/supabase'
import { supabaseGateway } from '@/utils/supabase-gateway'
import { logger } from '@/utils/logger'
import { getBaseCurrency } from '@/config/currency'

export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  date: string
  source?: string
  created_at: string
  updated_at?: string
}

export interface ExchangeRateHistory {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  date: string
  source: string
  created_at: string
  updated_at: string
}

export interface ExchangeRateUpdateLog {
  id: string
  update_type: 'scheduled' | 'manual' | 'api'
  status: 'success' | 'failed' | 'partial'
  rates_updated: number
  error_message?: string
  source: string
  started_at: string
  completed_at?: string
  created_at: string
}

export interface ExchangeRateStats {
  total_rates: number
  latest_update: string | null
  supported_currencies: string[]
  last_successful_update: string | null
  failed_updates_today: number
}

/**
 * Supabase汇率管理服务
 * 提供基于Supabase的汇率数据管理
 */
export class SupabaseExchangeRateService {
  /**
   * 获取所有汇率
   */
  async getAllRates(): Promise<ExchangeRate[]> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('date', { ascending: false })
        .order('from_currency', { ascending: true })

      if (error) {
        console.error('Error fetching exchange rates:', error)
        throw new Error(`获取汇率数据失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error fetching exchange rates:', error)
      throw error
    }
  }

  /**
   * 获取最新汇率
   */
  async getLatestRates(): Promise<ExchangeRate[]> {
    try {
      // 获取最新日期的汇率
      const { data: latestDate, error: dateError } = await supabase
        .from('exchange_rates')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (dateError || !latestDate) {
        return []
      }

      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('date', latestDate.date)
        .order('from_currency', { ascending: true })

      if (error) {
        console.error('Error fetching latest exchange rates:', error)
        throw new Error(`获取最新汇率数据失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error fetching latest exchange rates:', error)
      throw error
    }
  }

  /**
   * 获取特定汇率
   */
  async getRate(fromCurrency: string, toCurrency: string, date?: string): Promise<ExchangeRate | null> {
    try {
      let query = supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)

      if (date) {
        query = query.eq('date', date)
      } else {
        query = query.order('date', { ascending: false }).limit(1)
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // 汇率不存在
        }
        console.error('Error fetching exchange rate:', error)
        throw new Error(`获取汇率失败: ${error.message}`)
      }

      return data
    } catch (error) {
      logger.error(`Error fetching exchange rate ${fromCurrency}->${toCurrency}:`, error)
      throw error
    }
  }

  /**
   * 批量插入或更新汇率
   */
  async upsertRates(rates: Omit<ExchangeRate, 'id' | 'created_at'>[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(rates, {
          onConflict: 'from_currency,to_currency,date'
        })

      if (error) {
        console.error('Error upserting exchange rates:', error)
        throw new Error(`更新汇率数据失败: ${error.message}`)
      }
    } catch (error) {
      logger.error('Error upserting exchange rates:', error)
      throw error
    }
  }

  /**
   * 插入单个汇率
   */
  async insertRate(rate: Omit<ExchangeRate, 'id' | 'created_at'>): Promise<ExchangeRate> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .insert(rate)
        .select()
        .single()

      if (error) {
        console.error('Error inserting exchange rate:', error)
        throw new Error(`插入汇率数据失败: ${error.message}`)
      }

      return data
    } catch (error) {
      logger.error('Error inserting exchange rate:', error)
      throw error
    }
  }

  /**
   * 删除指定日期之前的旧汇率数据
   */
  async deleteOldRates(beforeDate: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .delete()
        .lt('date', beforeDate)

      if (error) {
        console.error('Error deleting old exchange rates:', error)
        throw new Error(`删除旧汇率数据失败: ${error.message}`)
      }
    } catch (error) {
      logger.error('Error deleting old exchange rates:', error)
      throw error
    }
  }

  /**
   * 将汇率数组转换为汇率映射对象
   */
  static ratesToMap(rates: ExchangeRate[]): Record<string, number> {
    const rateMap: Record<string, number> = {}
    const baseCurrency = getBaseCurrency()

    for (const rate of rates) {
      // 使用 from_currency 作为键，rate 作为值
      // 这样可以直接查找从基础货币到其他货币的汇率
      if (rate.from_currency === baseCurrency) {
        // 确保 rate 是数字类型
        const rateValue = typeof rate.rate === 'number' ? rate.rate : parseFloat(rate.rate) || 0
        rateMap[rate.to_currency] = rateValue
      }
    }

    // 确保基础货币到自身的汇率为 1
    rateMap[baseCurrency] = 1

    return rateMap
  }

  /**
   * 获取汇率历史记录
   */
  async getRateHistory(
    fromCurrency?: string,
    toCurrency?: string,
    limit: number = 100
  ): Promise<ExchangeRateHistory[]> {
    try {
      let query = supabase
        .from('exchange_rate_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fromCurrency) {
        query = query.eq('from_currency', fromCurrency)
      }
      if (toCurrency) {
        query = query.eq('to_currency', toCurrency)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching exchange rate history:', error)
        throw new Error(`获取汇率历史失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error fetching exchange rate history:', error)
      throw error
    }
  }

  /**
   * 获取汇率更新日志
   */
  async getUpdateLogs(limit: number = 50): Promise<ExchangeRateUpdateLog[]> {
    try {
      const { data, error } = await supabase
        .from('exchange_rate_update_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching update logs:', error)
        throw new Error(`获取更新日志失败: ${error.message}`)
      }

      return data || []
    } catch (error) {
      logger.error('Error fetching update logs:', error)
      throw error
    }
  }

  /**
   * 记录汇率更新日志
   */
  async logUpdateStart(updateType: 'scheduled' | 'manual' | 'api', source: string = 'system'): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('exchange_rate_update_logs')
        .insert({
          update_type: updateType,
          status: 'success', // 临时状态，稍后更新
          source,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error logging update start:', error)
        throw new Error(`记录更新开始失败: ${error.message}`)
      }

      return data.id
    } catch (error) {
      logger.error('Error logging update start:', error)
      throw error
    }
  }

  /**
   * 更新汇率更新日志
   */
  async logUpdateComplete(
    logId: string,
    status: 'success' | 'failed' | 'partial',
    ratesUpdated: number = 0,
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('exchange_rate_update_logs')
        .update({
          status,
          rates_updated: ratesUpdated,
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', logId)

      if (error) {
        console.error('Error logging update complete:', error)
        throw new Error(`记录更新完成失败: ${error.message}`)
      }
    } catch (error) {
      logger.error('Error logging update complete:', error)
      throw error
    }
  }

  /**
   * 使用数据库函数获取最新汇率
   */
  async getLatestRate(fromCurrency: string, toCurrency: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_exchange_rate', {
          p_from_currency: fromCurrency,
          p_to_currency: toCurrency
        })

      if (error) {
        console.error('Error getting latest rate:', error)
        throw new Error(`获取最新汇率失败: ${error.message}`)
      }

      return parseFloat(data) || 1.0
    } catch (error) {
      logger.error(`Error getting latest rate ${fromCurrency}->${toCurrency}:`, error)
      return 1.0 // 返回默认值
    }
  }

  /**
   * 获取汇率统计信息
   */
  async getRateStats(): Promise<ExchangeRateStats> {
    try {
      const { data, error } = await supabase
        .rpc('get_exchange_rate_stats')

      if (error) {
        console.error('Error fetching rate stats:', error)
        throw new Error(`获取汇率统计失败: ${error.message}`)
      }

      return data || {
        total_rates: 0,
        latest_update: null,
        supported_currencies: [],
        last_successful_update: null,
        failed_updates_today: 0
      }
    } catch (error) {
      logger.error('Error fetching rate stats:', error)
      // 返回默认统计信息
      return {
        total_rates: 0,
        latest_update: null,
        supported_currencies: [],
        last_successful_update: null,
        failed_updates_today: 0
      }
    }
  }

  /**
   * 清理旧的汇率历史记录
   */
  async cleanupOldHistory(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const { error } = await supabase
        .from('exchange_rate_history')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (error) {
        console.error('Error cleaning up old history:', error)
        throw new Error(`清理历史记录失败: ${error.message}`)
      }
    } catch (error) {
      logger.error('Error cleaning up old history:', error)
      throw error
    }
  }

  /**
   * 批量更新汇率（带日志记录）
   */
  async batchUpdateRates(
    rates: Omit<ExchangeRate, 'id' | 'created_at'>[],
    updateType: 'scheduled' | 'manual' | 'api' = 'manual',
    source: string = 'system'
  ): Promise<{ success: boolean; updated: number; logId: string }> {
    let logId: string | null = null

    try {
      // 记录更新开始
      logId = await this.logUpdateStart(updateType, source)

      // 执行批量更新
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(rates.map(rate => ({
          ...rate,
          source,
          updated_at: new Date().toISOString()
        })), {
          onConflict: 'from_currency,to_currency,date'
        })

      if (error) {
        if (logId) {
          await this.logUpdateComplete(logId, 'failed', 0, error.message)
        }
        throw new Error(`批量更新汇率失败: ${error.message}`)
      }

      // 记录更新成功
      if (logId) {
        await this.logUpdateComplete(logId, 'success', rates.length)
      }

      return {
        success: true,
        updated: rates.length,
        logId: logId || ''
      }
    } catch (error) {
      if (logId) {
        await this.logUpdateComplete(logId, 'failed', 0, error instanceof Error ? error.message : '未知错误')
      }
      logger.error('Error in batch update rates:', error)
      throw error
    }
  }

  /**
   * 通过Edge Function触发汇率更新
   */
  async triggerExchangeRateUpdate(
    updateType: 'manual' | 'scheduled' = 'manual',
    currencies?: string[]
  ): Promise<{ success: boolean; rates_updated: number; log_id: string }> {
    try {
      const { data, error } = await supabaseGateway.invokeFunction('update-exchange-rates', {
        body: {
          updateType,
          currencies: currencies || ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']
        }
      })

      if (error) {
        throw new Error(`Edge Function调用失败: ${error.message}`)
      }

      if (!data?.success) {
        throw new Error(data?.error || '汇率更新失败')
      }

      return data
    } catch (error) {
      logger.error('Error triggering exchange rate update:', error)
      throw error
    }
  }

  /**
   * 获取调度器状态
   */
  async getSchedulerStatus(): Promise<any> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL 或 API Key 未配置')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/update-exchange-rates?action=status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Error getting scheduler status:', error)
      throw error
    }
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<{ success: boolean; message: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL 或 API Key 未配置')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/update-exchange-rates?action=cleanup&days=${daysToKeep}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '数据清理失败')
      }

      return data
    } catch (error) {
      logger.error('Error cleaning up old data:', error)
      throw error
    }
  }
}

// 导出单例实例
export const supabaseExchangeRateService = new SupabaseExchangeRateService()