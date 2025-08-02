import { logger } from '@/utils/logger';
import { getBaseCurrency } from '@/config/currency';
import { supabase } from '@/lib/supabase';

export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRateStatus {
  isRunning: boolean;
  nextRun: string | null;
  hasApiKey: boolean;
}

/**
 * 汇率 API 服务
 */
export class ExchangeRateApi {
  /**
   * 获取所有汇率
   */
  static async getAllRates(): Promise<ExchangeRate[]> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('from_currency', { ascending: true });

      if (error) throw error;

      return data?.map(rate => ({
        id: rate.id,
        from_currency: rate.from_currency,
        to_currency: rate.to_currency,
        rate: rate.rate,
        created_at: rate.created_at,
        updated_at: rate.updated_at
      })) || [];
    } catch (error) {
      logger.error('Error fetching exchange rates:', error);
      throw error;
    }
  }

  /**
   * 获取特定汇率
   */
  static async getRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        from_currency: data.from_currency,
        to_currency: data.to_currency,
        rate: data.rate,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    } catch (error) {
      logger.error(`Error fetching exchange rate ${fromCurrency}->${toCurrency}:`, error);
      throw error;
    }
  }

  /**
   * 手动触发汇率更新
   */
  static async updateRates(): Promise<{ message: string; updatedAt: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('update-exchange-rates');

      if (error) throw error;

      return {
        message: data?.message || 'Exchange rates updated successfully',
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error updating exchange rates:', error);
      throw error;
    }
  }

  /**
   * 获取汇率调度器状态
   */
  static async getSchedulerStatus(): Promise<ExchangeRateStatus> {
    try {
      // 获取最新的汇率更新时间作为状态指示
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      return {
        isRunning: true,
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时后
        hasApiKey: true
      };
    } catch (error) {
      logger.error('Error fetching scheduler status:', error);
      throw error;
    }
  }

  /**
   * 将汇率数组转换为汇率映射对象
   */
  static ratesToMap(rates: ExchangeRate[]): Record<string, number> {
    const rateMap: Record<string, number> = {};
    const baseCurrency = getBaseCurrency();

    for (const rate of rates) {
      // 使用 from_currency 作为键，rate 作为值
      // 这样可以直接查找从基础货币到其他货币的汇率
      if (rate.from_currency === baseCurrency) {
        rateMap[rate.to_currency] = rate.rate;
      }
    }

    // 确保基础货币到自身的汇率为 1
    rateMap[baseCurrency] = 1;

    return rateMap;
  }
}
