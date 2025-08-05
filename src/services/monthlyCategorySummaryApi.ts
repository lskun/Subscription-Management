import { logger } from '@/utils/logger';
import { supabase } from '@/lib/supabase';

// API响应类型定义
export interface MonthlyCategorySummaryApiResponse {
  year: number;
  month: number;
  monthKey: string;
  categoryId: number;
  categoryValue: string;
  categoryLabel: string;
  totalAmount: number;
  baseCurrency: string;
  transactionsCount: number;
  updatedAt: string;
}

export interface MonthCategorySummaryResponse {
  year: number;
  month: number;
  categories: CategorySummary[];
  totalAmount: number;
  totalTransactions: number;
  baseCurrency: string;
}

export interface CategorySummary {
  categoryId: number;
  categoryValue: string;
  categoryLabel: string;
  totalAmount: number;
  baseCurrency: string;
  transactionsCount: number;
  updatedAt: string;
}

export interface TotalSummaryResponse {
  dateRange: {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
  };
  totalAmount: number;
  totalTransactions: number;
  baseCurrency: string;
}

export interface MonthlyCategorySummariesResponse {
  summaries: MonthlyCategorySummaryApiResponse[];
  summary: {
    totalRecords: number;
    dateRange: {
      startYear: number;
      startMonth: number;
      endYear: number;
      endMonth: number;
    };
  };
}

/**
 * 获取月度分类汇总数据
 */
export async function getMonthlyCategorySummaries(
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
): Promise<MonthlyCategorySummariesResponse> {
  try {
    logger.debug('Fetching monthly category summaries with params:', { startYear, startMonth, endYear, endMonth });

    let query = supabase
      .from('monthly_category_summary')
      .select(`
        year,
        month,
        category_id,
        total_amount_in_base_currency,
        base_currency,
        transactions_count,
        updated_at,
        categories!inner(value, label)
      `)
      .eq('user_id', (await (await import('@/store/settingsStore')).useSettingsStore.getState().getCurrentUser())?.id);

    // 添加日期范围过滤
    if (startYear && startMonth) {
      query = query.gte('year', startYear);
      if (startYear === endYear) {
        query = query.gte('month', startMonth);
      }
    }
    if (endYear && endMonth) {
      query = query.lte('year', endYear);
      if (startYear === endYear) {
        query = query.lte('month', endMonth);
      }
    }

    const { data, error } = await query.order('year', { ascending: true }).order('month', { ascending: true });

    if (error) throw error;

    // 转换数据格式
    const summaries: MonthlyCategorySummaryApiResponse[] = (data || []).map((item: any) => ({
      year: item.year,
      month: item.month,
      monthKey: `${item.year}-${item.month.toString().padStart(2, '0')}`,
      categoryId: item.category_id,
      categoryValue: item.categories?.value || '',
      categoryLabel: item.categories?.label || '',
      totalAmount: item.total_amount_in_base_currency,
      baseCurrency: item.base_currency,
      transactionsCount: item.transactions_count,
      updatedAt: item.updated_at
    }));

    // 计算汇总信息
    const years = Array.from(new Set(summaries.map(s => s.year)));
    const months = Array.from(new Set(summaries.map(s => s.month)));

    return {
      summaries,
      summary: {
        totalRecords: summaries.length,
        dateRange: {
          startYear: Math.min(...years) || startYear || new Date().getFullYear(),
          startMonth: Math.min(...months) || startMonth || 1,
          endYear: Math.max(...years) || endYear || new Date().getFullYear(),
          endMonth: Math.max(...months) || endMonth || 12
        }
      }
    };
  } catch (error) {
    logger.error('Error fetching monthly category summaries:', error);
    throw error;
  }
}

/**
 * 获取指定月份的分类汇总
 */
export async function getMonthCategorySummary(
  year: number,
  month: number
): Promise<MonthCategorySummaryResponse> {
  try {
    logger.debug('Fetching month category summary for:', year, month);

    const { data, error } = await supabase
      .from('monthly_category_summary')
      .select(`
        year,
        month,
        category_id,
        total_amount_in_base_currency,
        base_currency,
        transactions_count,
        updated_at,
        categories!inner(value, label)
      `)
      .eq('year', year)
      .eq('month', month)
      .eq('user_id', (await (await import('@/store/settingsStore')).useSettingsStore.getState().getCurrentUser())?.id);

    if (error) throw error;

    // 转换数据格式
    const categories: CategorySummary[] = (data || []).map((item: any) => ({
      categoryId: item.category_id,
      categoryValue: item.categories?.value || '',
      categoryLabel: item.categories?.label || '',
      totalAmount: item.total_amount_in_base_currency,
      baseCurrency: item.base_currency,
      transactionsCount: item.transactions_count,
      updatedAt: item.updated_at
    }));

    const totalAmount = categories.reduce((sum, cat) => sum + cat.totalAmount, 0);
    const totalTransactions = categories.reduce((sum, cat) => sum + cat.transactionsCount, 0);
    const baseCurrency = categories[0]?.baseCurrency || 'CNY';

    return {
      year,
      month,
      categories,
      totalAmount,
      totalTransactions,
      baseCurrency
    };
  } catch (error) {
    logger.error('Error fetching month category summary:', error);
    throw error;
  }
}

/**
 * 获取总计汇总数据
 */
export async function getTotalSummary(
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
): Promise<TotalSummaryResponse> {
  try {
    logger.debug('Fetching total summary with params:', { startYear, startMonth, endYear, endMonth });

    let query = supabase
      .from('monthly_category_summary')
      .select('total_amount_in_base_currency, base_currency, transactions_count, year, month')
      .eq('user_id', (await (await import('@/store/settingsStore')).useSettingsStore.getState().getCurrentUser())?.id);

    // 添加日期范围过滤
    if (startYear && startMonth) {
      query = query.gte('year', startYear);
      if (startYear === endYear) {
        query = query.gte('month', startMonth);
      }
    }
    if (endYear && endMonth) {
      query = query.lte('year', endYear);
      if (startYear === endYear) {
        query = query.lte('month', endMonth);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const totalAmount = data?.reduce((sum, item) => sum + item.total_amount_in_base_currency, 0) || 0;
    const totalTransactions = data?.reduce((sum, item) => sum + item.transactions_count, 0) || 0;
    const baseCurrency = data?.[0]?.base_currency || 'CNY';

    // 计算实际的日期范围
    const years = data?.map(item => item.year) || [];
    const months = data?.map(item => item.month) || [];

    return {
      dateRange: {
        startYear: Math.min(...years) || startYear || new Date().getFullYear(),
        startMonth: Math.min(...months) || startMonth || 1,
        endYear: Math.max(...years) || endYear || new Date().getFullYear(),
        endMonth: Math.max(...months) || endMonth || 12
      },
      totalAmount,
      totalTransactions,
      baseCurrency
    };
  } catch (error) {
    logger.error('Error fetching total summary:', error);
    throw error;
  }
}

/**
 * 重新计算所有月度分类汇总数据
 */
export async function recalculateAllSummaries(): Promise<{ message: string; timestamp: string }> {
  try {
    logger.debug('Recalculating all summaries');

    // 使用Supabase函数重新计算汇总数据
    const { error } = await supabase.rpc('recalculate_monthly_summaries');

    if (error) throw error;

    return {
      message: 'Monthly summaries recalculated successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error recalculating summaries:', error);
    throw error;
  }
}

/**
 * 处理新支付记录
 */
export async function processPayment(paymentId: number): Promise<{ message: string; paymentId: number; timestamp: string }> {
  try {
    logger.debug('Processing payment:', paymentId);

    // 使用Supabase函数处理支付
    const { error } = await supabase.rpc('process_payment_summary', {
      payment_id: paymentId
    });

    if (error) throw error;

    return {
      message: 'Payment processed successfully',
      paymentId: paymentId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error processing payment:', error);
    throw error;
  }
}

