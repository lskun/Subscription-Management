/**
 * 统计计算逻辑
 * 基于分组数据计算月度、季度、年度统计信息
 * 实现支付次数统计功能，保持与现有数据结构的完全兼容性
 */

import { GroupedPayments, PaymentRecord, getPaymentCountForPeriod } from './paymentGrouper';

/**
 * 订阅接口定义（与现有Edge Function保持一致）
 */
export interface Subscription {
  id: string;
  name: string;
  amount: string | number;
  currency: string;
  billing_cycle: string;
  status: string;
  next_billing_date?: string;
  last_billing_date?: string;
  start_date?: string;
  category_id?: string;
  categories?: {
    value: string;
    label: string;
  };
}

/**
 * 期间统计信息接口（与现有API响应格式完全兼容）
 */
export interface PeriodStatistics {
  period: string;
  amount: number;
  change: number;
  currency: string;
  paymentCount: number;
}

/**
 * 统计计算结果接口
 */
export interface StatisticsResult {
  monthly: PeriodStatistics[];
  quarterly: PeriodStatistics[];
  yearly: PeriodStatistics[];
}

/**
 * 货币转换函数（与现有Edge Function保持一致）
 */
function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number>
): number {
  try {
    // 如果货币相同，直接返回原始金额
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rateKey = `${fromCurrency}_${toCurrency}`;
    if (exchangeRates[rateKey]) {
      const convertedAmount = amount * exchangeRates[rateKey];
      console.log(`货币转换: ${amount} ${fromCurrency} = ${convertedAmount} ${toCurrency} (汇率: ${exchangeRates[rateKey]})`);
      return convertedAmount;
    }

    // 通过CNY作为中间货币转换
    const fromToCNY = `${fromCurrency}_CNY`;
    const CNYToTarget = `CNY_${toCurrency}`;
    if (exchangeRates[fromToCNY] && exchangeRates[CNYToTarget]) {
      const convertedAmount = amount * exchangeRates[fromToCNY] * exchangeRates[CNYToTarget];
      console.log(`货币转换(通过CNY): ${amount} ${fromCurrency} = ${convertedAmount} ${toCurrency}`);
      return convertedAmount;
    }

    console.warn(`Missing exchange rate for ${fromCurrency} to ${toCurrency}`);
    return amount;
  } catch (error) {
    console.error(`货币转换出错 (${fromCurrency} 到 ${toCurrency}):`, error);
    return amount; // 出错时返回原始金额
  }
}

/**
 * 计算订阅的月度费用（与现有Edge Function保持一致）
 */
function calculateMonthlyAmount(amount: number, billingCycle: string): number {
  try {
    if (isNaN(amount)) {
      console.warn(`计算月度金额时遇到非数字金额: ${amount}，使用0`);
      return 0;
    }

    let result = 0;
    switch (billingCycle) {
      case 'monthly':
        result = amount;
        break;
      case 'yearly':
        result = amount / 12;
        break;
      case 'quarterly':
        result = amount / 3;
        break;
      case 'semi_annually':
        result = amount / 6;
        break;
      case 'weekly':
        result = amount * 4.33; // 平均每月4.33周
        break;
      case 'daily':
        result = amount * 30.44; // 平均每月30.44天
        break;
      default:
        console.warn(`未知的计费周期: ${billingCycle}，使用原始金额`);
        result = amount;
    }

    return result;
  } catch (error) {
    console.error(`计算月度金额时出错 (金额: ${amount}, 计费周期: ${billingCycle}):`, error);
    return 0; // 出错时返回0
  }
}

/**
 * 计算订阅的年度费用（与现有Edge Function保持一致）
 */
function calculateYearlyAmount(amount: number, billingCycle: string): number {
  try {
    if (isNaN(amount)) {
      console.warn(`计算年度金额时遇到非数字金额: ${amount}，使用0`);
      return 0;
    }

    let result = 0;
    switch (billingCycle) {
      case 'monthly':
        result = amount * 12;
        break;
      case 'quarterly':
        result = amount * 4;
        break;
      case 'yearly':
        result = amount;
        break;
      case 'semi_annually':
        result = amount * 2;
        break;
      case 'weekly':
        result = amount * 52;
        break;
      case 'daily':
        result = amount * 365;
        break;
      default:
        console.warn(`未知的计费周期: ${billingCycle}，使用原始金额`);
        result = amount;
    }

    return result;
  } catch (error) {
    console.error(`计算年度金额时出错 (金额: ${amount}, 计费周期: ${billingCycle}):`, error);
    return 0; // 出错时返回0
  }
}

/**
 * 基于分组数据计算月度统计信息
 */
export function calculateMonthlyStatistics(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: Record<string, number>,
  targetCurrency: string
): PeriodStatistics[] {
  try {
    console.log('开始计算月度统计信息...');
    const now = new Date();
    const monthlyInfo: PeriodStatistics[] = [];

    // 生成最近4个月的数据（与现有逻辑保持一致）
    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      // 创建当前月份的日期对象，用于比较
      const currentMonthDate = new Date(year, month - 1, 1);

      // 计算该月的总费用，只考虑在该月已经开始的订阅
      const monthlyAmount = activeSubscriptions.reduce((acc, sub: Subscription) => {
        // 获取订阅开始日期
        const startDate = sub.start_date ? new Date(sub.start_date) : null;

        // 只计算在当前月份之前已经开始的订阅
        if (!startDate || startDate <= currentMonthDate) {
          const amount = parseFloat(sub.amount as string) || 0;
          const monthlySubAmount = calculateMonthlyAmount(amount, sub.billing_cycle);
          const convertedAmount = convertCurrency(monthlySubAmount, sub.currency || 'CNY', targetCurrency, exchangeRates);
          return acc + convertedAmount;
        }
        return acc;
      }, 0);

      // 从分组数据中获取支付次数（这是优化的核心）
      const paymentCount = getPaymentCountForPeriod(groupedPayments, 'monthly', monthKey);

      monthlyInfo.unshift({
        period: monthKey,
        amount: Math.round(monthlyAmount * 100) / 100,
        change: 0, // 月度数据不计算变化百分比
        currency: targetCurrency,
        paymentCount: paymentCount
      });
    }

    console.log(`月度统计计算完成: ${monthlyInfo.length}个月`);
    return monthlyInfo;
  } catch (error) {
    console.error('计算月度统计信息时出错:', error);
    return [];
  }
}

/**
 * 基于分组数据计算季度统计信息
 */
export function calculateQuarterlyStatistics(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: Record<string, number>,
  targetCurrency: string
): PeriodStatistics[] {
  try {
    console.log('开始计算季度统计信息...');
    const now = new Date();
    const quarterlyInfo: PeriodStatistics[] = [];

    // 生成最近4个季度的数据（与现有逻辑保持一致）
    for (let i = 0; i < 4; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i * 3);
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const year = date.getFullYear();
      const quarterKey = `${year}-Q${quarter}`;

      // 创建当前季度的第一天日期对象，用于比较
      const quarterStartMonth = (quarter - 1) * 3;
      const currentQuarterDate = new Date(year, quarterStartMonth, 1);

      // 计算该季度的总费用，只考虑在该季度已经开始的订阅
      const quarterlyAmount = activeSubscriptions.reduce((acc, sub: Subscription) => {
        const startDate = sub.start_date ? new Date(sub.start_date) : null;

        if (!startDate || startDate <= currentQuarterDate) {
          const amount = parseFloat(sub.amount as string) || 0;
          const monthlyAmount = calculateMonthlyAmount(amount, sub.billing_cycle);
          const quarterlySubAmount = monthlyAmount * 3;
          const convertedAmount = convertCurrency(quarterlySubAmount, sub.currency || 'CNY', targetCurrency, exchangeRates);
          return acc + convertedAmount;
        }
        return acc;
      }, 0);

      // 从分组数据中获取支付次数（这是优化的核心）
      const paymentCount = getPaymentCountForPeriod(groupedPayments, 'quarterly', quarterKey);

      quarterlyInfo.unshift({
        period: quarterKey,
        amount: Math.round(quarterlyAmount * 100) / 100,
        change: 0, // 季度数据不计算变化百分比
        currency: targetCurrency,
        paymentCount: paymentCount
      });
    }

    console.log(`季度统计计算完成: ${quarterlyInfo.length}个季度`);
    return quarterlyInfo;
  } catch (error) {
    console.error('计算季度统计信息时出错:', error);
    return [];
  }
}

/**
 * 基于分组数据计算年度统计信息
 */
export function calculateYearlyStatistics(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: Record<string, number>,
  targetCurrency: string
): PeriodStatistics[] {
  try {
    console.log('开始计算年度统计信息...');
    const now = new Date();
    const yearlyInfo: PeriodStatistics[] = [];

    // 生成最近3年的数据（与现有逻辑保持一致）
    const years = [];
    for (let i = 0; i < 3; i++) {
      years.push(now.getFullYear() - i);
    }

    for (const year of years) {
      let yearlyAmount = 0;

      // 根据年份计算费用（与现有逻辑保持一致）
      if (year === 2023) {
        // 2023年没有订阅，费用为0
        yearlyAmount = 0;
      } else {
        // 2024年及以后的年份，计算当年及之前年份开始的订阅
        activeSubscriptions.forEach((subscription) => {
          const startDate = subscription.start_date ? new Date(subscription.start_date) : new Date();
          const startYear = startDate.getFullYear();

          if (startYear <= year) {
            const amount = parseFloat(subscription.amount as string) || 0;
            const yearlySubAmount = calculateYearlyAmount(amount, subscription.billing_cycle);
            const convertedAmount = convertCurrency(yearlySubAmount, subscription.currency || 'CNY', targetCurrency, exchangeRates);
            yearlyAmount += convertedAmount;
          }
        });
      }

      // 计算与上一年的变化百分比
      let change = 0;
      if (yearlyInfo.length > 0) {
        const prevYearAmount = yearlyInfo[0].amount;
        if (prevYearAmount > 0) {
          change = ((yearlyAmount - prevYearAmount) / prevYearAmount) * 100;
          change = Math.round(change * 10) / 10; // 保留一位小数
        }
      }

      // 从分组数据中获取支付次数（这是优化的核心）
      const paymentCount = getPaymentCountForPeriod(groupedPayments, 'yearly', year.toString());

      yearlyInfo.unshift({
        period: year.toString(),
        amount: Math.round(yearlyAmount * 100) / 100,
        change: change,
        currency: targetCurrency,
        paymentCount: paymentCount
      });
    }

    console.log(`年度统计计算完成: ${yearlyInfo.length}年`);
    return yearlyInfo;
  } catch (error) {
    console.error('计算年度统计信息时出错:', error);
    return [];
  }
}

/**
 * 基于分组数据计算所有统计信息的主函数
 * 保持与现有数据结构的完全兼容性
 */
export function calculateOptimizedStatistics(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: Record<string, number>,
  targetCurrency: string
): StatisticsResult {
  try {
    console.log('开始计算优化的统计信息...');

    // 验证输入参数
    if (!groupedPayments) {
      throw new Error('分组支付数据不能为空');
    }

    if (!activeSubscriptions) {
      console.warn('活跃订阅列表为空，将使用空数组');
      activeSubscriptions = [];
    }

    if (!exchangeRates) {
      console.warn('汇率数据为空，将使用空对象');
      exchangeRates = {};
    }

    if (!targetCurrency) {
      console.warn('目标货币为空，将使用默认货币CNY');
      targetCurrency = 'CNY';
    }

    // 分别计算各个时间段的统计信息
    const monthly = calculateMonthlyStatistics(groupedPayments, activeSubscriptions, exchangeRates, targetCurrency);
    const quarterly = calculateQuarterlyStatistics(groupedPayments, activeSubscriptions, exchangeRates, targetCurrency);
    const yearly = calculateYearlyStatistics(groupedPayments, activeSubscriptions, exchangeRates, targetCurrency);

    const result: StatisticsResult = {
      monthly,
      quarterly,
      yearly
    };

    console.log(`优化统计计算完成: 月度${monthly.length}个, 季度${quarterly.length}个, 年度${yearly.length}个`);
    return result;
  } catch (error) {
    console.error('计算优化统计信息时出错:', error);
    // 返回空结果以保持系统稳定性
    return {
      monthly: [],
      quarterly: [],
      yearly: []
    };
  }
}

/**
 * 验证统计结果的完整性
 */
export function validateStatisticsResult(result: StatisticsResult): boolean {
  try {
    // 检查基本结构
    if (!result || typeof result !== 'object') {
      console.error('统计结果不是有效对象');
      return false;
    }

    if (!Array.isArray(result.monthly) || !Array.isArray(result.quarterly) || !Array.isArray(result.yearly)) {
      console.error('统计结果缺少必要的数组字段');
      return false;
    }

    // 检查数据完整性
    const checkPeriodData = (data: PeriodStatistics[], periodType: string): boolean => {
      for (const item of data) {
        if (!item.period || typeof item.amount !== 'number' || typeof item.paymentCount !== 'number') {
          console.error(`${periodType}统计数据格式不正确:`, item);
          return false;
        }
      }
      return true;
    };

    if (!checkPeriodData(result.monthly, '月度') ||
        !checkPeriodData(result.quarterly, '季度') ||
        !checkPeriodData(result.yearly, '年度')) {
      return false;
    }

    console.log('统计结果验证通过');
    return true;
  } catch (error) {
    console.error('验证统计结果时出错:', error);
    return false;
  }
}