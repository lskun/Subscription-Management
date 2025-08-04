// @ts-ignore - Deno runtime imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno runtime imports  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 定义订阅类型接口，使用snake_case格式匹配Supabase返回的数据
interface Subscription {
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
 * 支付记录接口定义
 */
interface PaymentRecord {
  id: string;
  payment_date: string;
  amount_paid: string;
  currency: string;
  status: string;
}

/**
 * 分组后的支付记录接口
 */
interface GroupedPayments {
  monthly: Map<string, PaymentRecord[]>;    // key: "2025-01"
  quarterly: Map<string, PaymentRecord[]>;  // key: "2025-Q1"
  yearly: Map<string, PaymentRecord[]>;     // key: "2025"
}

/**
 * 期间统计信息接口
 */
interface PeriodStatistics {
  period: string;
  amount: number;
  change: number;
  currency: string;
  paymentCount: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

/**
 * 货币转换函数
 */
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRates: Record<string, number>): number {
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
 * 计算订阅的月度费用
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
 * 计算订阅的年度费用
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
 * 优化的汇率数据获取函数 - 只获取最新日期的汇率
 */
async function fetchLatestExchangeRates(supabaseClient: any): Promise<Record<string, number>> {
  try {
    console.log('获取最新汇率数据...');
    
    // 先获取最新日期
    const { data: latestDate, error: dateError } = await supabaseClient
      .from('exchange_rates')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (dateError) {
      console.error('Error fetching latest exchange rate date:', dateError);
      return {};
    }

    // 根据最新日期获取汇率数据
    const { data: exchangeRateData, error: exchangeRateError } = await supabaseClient
      .from('exchange_rates')
      .select('from_currency, to_currency, rate')
      .eq('date', latestDate?.date)
      .order('from_currency', { ascending: true });

    if (exchangeRateError) {
      console.error('Error fetching exchange rates:', exchangeRateError);
      return {};
    }

    // 构建汇率映射 - 支持双向转换
    const exchangeRates: Record<string, number> = {};
    if (exchangeRateData) {
      exchangeRateData.forEach(rate => {
        const fromCurrency = rate.from_currency;
        const toCurrency = rate.to_currency;
        const rateValue = parseFloat(rate.rate);

        // 存储正向汇率 (from -> to)
        const forwardKey = `${fromCurrency}_${toCurrency}`;
        exchangeRates[forwardKey] = rateValue;

        // 存储反向汇率 (to -> from)
        const reverseKey = `${toCurrency}_${fromCurrency}`;
        exchangeRates[reverseKey] = 1 / rateValue;
      });
      
      console.log(`成功映射 ${Object.keys(exchangeRates).length} 个汇率键值对`);
    }

    return exchangeRates;
  } catch (error) {
    console.error('获取汇率数据时出错:', error);
    return {};
  }
}

/**
 * 优化的支付记录获取函数 - 一次性获取最近3年的所有支付记录
 */
async function fetchAllPayments(
  supabaseClient: any,
  userId: string
): Promise<PaymentRecord[]> {
  try {
    console.log('一次性获取最近3年的支付记录...');
    
    // 计算查询范围：最近3年
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 3, 0, 1); // 3年前的1月1日
    const endDate = now;
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`查询支付记录范围: ${startDateStr} 到 ${endDateStr}`);

    const { data: payments, error: paymentError } = await supabaseClient
      .from('payment_history')
      .select('id, payment_date, amount_paid, currency, status')
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .gte('payment_date', startDateStr)
      .lte('payment_date', endDateStr)
      .order('payment_date', { ascending: false });

    if (paymentError) {
      console.error('获取支付记录失败:', paymentError);
      return [];
    }

    console.log(`成功获取 ${payments?.length || 0} 条支付记录`);
    return payments || [];
  } catch (error) {
    console.error('获取支付记录时出错:', error);
    return [];
  }
}

/**
 * 日期分类器类
 */
class DatePeriodClassifier {
  getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  getQuarterKey(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }
  
  getYearKey(date: Date): string {
    return date.getFullYear().toString();
  }
}

/**
 * 支付记录分组函数 - 根据日期将支付记录分组到不同时间段
 */
function groupPaymentsByPeriod(payments: PaymentRecord[]): GroupedPayments {
  const result: GroupedPayments = {
    monthly: new Map(),
    quarterly: new Map(),
    yearly: new Map()
  };
  
  const classifier = new DatePeriodClassifier();
  
  for (const payment of payments) {
    try {
      const paymentDate = new Date(payment.payment_date);
      
      // 验证日期有效性
      if (isNaN(paymentDate.getTime())) {
        console.warn(`Invalid payment date: ${payment.payment_date}`);
        continue;
      }
      
      // 分组到不同时间段
      const monthKey = classifier.getMonthKey(paymentDate);
      const quarterKey = classifier.getQuarterKey(paymentDate);
      const yearKey = classifier.getYearKey(paymentDate);
      
      // 添加到对应的分组中
      addToGroup(result.monthly, monthKey, payment);
      addToGroup(result.quarterly, quarterKey, payment);
      addToGroup(result.yearly, yearKey, payment);
      
    } catch (error) {
      console.error(`Error processing payment ${payment.id}:`, error);
    }
  }
  
  console.log(`支付记录分组完成: 月度${result.monthly.size}个, 季度${result.quarterly.size}个, 年度${result.yearly.size}个`);
  return result;
}

/**
 * 辅助函数：将支付记录添加到分组中
 */
function addToGroup(groupMap: Map<string, PaymentRecord[]>, key: string, payment: PaymentRecord) {
  if (!groupMap.has(key)) {
    groupMap.set(key, []);
  }
  groupMap.get(key)!.push(payment);
}

/**
 * 获取指定时间段的支付记录数量
 */
function getPaymentCountForPeriod(
  groupedPayments: GroupedPayments,
  periodType: 'monthly' | 'quarterly' | 'yearly',
  periodKey: string
): number {
  try {
    const group = groupedPayments[periodType];
    return group.get(periodKey)?.length || 0;
  } catch (error) {
    console.error(`获取时间段 ${periodType}:${periodKey} 的支付次数时出错:`, error);
    return 0;
  }
}

/**
 * 基于分组数据计算优化的费用信息
 */
function calculateOptimizedExpenseInfo(
  groupedPayments: GroupedPayments,
  activeSubscriptions: Subscription[],
  exchangeRates: Record<string, number>,
  targetCurrency: string
): {
  monthly: PeriodStatistics[];
  quarterly: PeriodStatistics[];
  yearly: PeriodStatistics[];
} {
  const now = new Date();
  const monthlyInfo: PeriodStatistics[] = [];
  const quarterlyInfo: PeriodStatistics[] = [];
  const yearlyInfo: PeriodStatistics[] = [];

  // 生成最近4个月的数据
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
      change: 0,
      currency: targetCurrency,
      paymentCount: paymentCount
    });
  }

  // 生成最近4个季度的数据
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
      change: 0,
      currency: targetCurrency,
      paymentCount: paymentCount
    });
  }

  // 生成最近3年的数据
  const years = [];
  for (let i = 0; i < 3; i++) {
    years.push(now.getFullYear() - i);
  }

  for (const year of years) {
    let yearlyAmount = 0;

    // 根据年份计算费用
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

  console.log(`优化计算完成: 月度${monthlyInfo.length}个, 季度${quarterlyInfo.length}个, 年度${yearlyInfo.length}个`);

  return {
    monthly: monthlyInfo,
    quarterly: quarterlyInfo,
    yearly: yearlyInfo
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // 创建 Supabase 客户端
    // @ts-ignore - Deno runtime environment
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });

    // 验证用户身份
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 解析请求参数
    const requestData = req.method === 'POST' ? await req.json() : Object.fromEntries(new URL(req.url).searchParams.entries());
    const { 
      targetCurrency = 'CNY', 
      monthlyStartDate, 
      monthlyEndDate, 
      yearlyStartDate, 
      yearlyEndDate, 
      quarterlyStartDate, 
      quarterlyEndDate, 
      includeMonthlyExpenses = true, 
      includeYearlyExpenses = true, 
      includeQuarterlyExpenses = false, 
      includeCategoryExpenses = true, 
      includeExpenseInfo = true 
    } = requestData;

    console.log(`Expense reports request for user ${user.id}, currency: ${targetCurrency}`);

    // 步骤1: 并行获取所有需要的数据（优化的核心）
    const [exchangeRates, payments, subscriptionsResult] = await Promise.all([
      fetchLatestExchangeRates(supabaseClient),
      fetchAllPayments(supabaseClient, user.id),
      supabaseClient.from('subscriptions').select(`
        id,
        name,
        amount,
        currency,
        billing_cycle,
        status,
        next_billing_date,
        last_billing_date,
        start_date,
        category_id,
        categories (
          value,
          label
        )
      `).eq('user_id', user.id).eq('status', 'active')
    ]);

    // 处理订阅数据
    let activeSubscriptions: Subscription[] = [];
    if (subscriptionsResult.error) {
      console.error(`获取订阅数据失败: ${subscriptionsResult.error.message}`);
      activeSubscriptions = [];
    } else {
      activeSubscriptions = subscriptionsResult.data || [];
      console.log(`成功获取 ${activeSubscriptions.length} 个活跃订阅`);

      // 验证订阅数据的完整性
      activeSubscriptions.forEach((sub, index) => {
        if (!sub.amount || isNaN(parseFloat(sub.amount as string))) {
          console.warn(`订阅 ${sub.id} 的金额无效: ${sub.amount}，将使用0`);
          activeSubscriptions[index].amount = '0';
        }

        if (!sub.currency) {
          console.warn(`订阅 ${sub.id} 没有指定货币，将使用默认货币 CNY`);
          activeSubscriptions[index].currency = 'CNY';
        }

        if (!sub.billing_cycle) {
          console.warn(`订阅 ${sub.id} 没有指定计费周期，将使用默认周期 monthly`);
          activeSubscriptions[index].billing_cycle = 'monthly';
        }
      });
    }

    // 步骤2: 将支付记录按时间段分组（避免重复查询）
    const groupedPayments = groupPaymentsByPeriod(payments);

    // 构建响应数据
    const response: any = {
      currency: targetCurrency,
      timestamp: new Date().toISOString()
    };

    // 步骤3: 使用优化的逻辑计算 expenseInfo（如果需要）
    if (includeExpenseInfo) {
      try {
        console.log('计算优化的费用信息...');
        const expenseInfo = calculateOptimizedExpenseInfo(
          groupedPayments,
          activeSubscriptions,
          exchangeRates,
          targetCurrency
        );
        response.expenseInfo = expenseInfo;
        console.log('费用信息计算完成');
      } catch (error) {
        console.error('计算费用信息时出错:', error);
        response.expenseInfo = {
          monthly: [],
          quarterly: [],
          yearly: []
        };
      }
    }

    // 获取月度费用数据（保持原有逻辑以确保兼容性）
    if (includeMonthlyExpenses && monthlyStartDate && monthlyEndDate) {
      try {
        console.log('计算月度费用数据...');
        const monthlyExpenses: any[] = [];
        const monthlyMap = new Map();
        const startDate = new Date(monthlyStartDate);
        const endDate = new Date(monthlyEndDate);

        // 生成月份范围
        const current = new Date(startDate);
        while (current <= endDate) {
          const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          monthlyMap.set(monthKey, 0);
          current.setMonth(current.getMonth() + 1);
        }

        console.log(`生成了 ${monthlyMap.size} 个月的范围`);

        // 计算每个月的总费用和支付数量（使用分组数据优化）
        for (const [monthKey, _] of monthlyMap.entries()) {
          try {
            const [yearStr, monthStr] = monthKey.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            // 创建当前月份的日期对象，用于比较
            const currentMonthDate = new Date(year, month - 1, 1);

            // 计算该月的理论费用（基于订阅）
            const totalMonthlyExpense = activeSubscriptions.reduce((acc, sub: Subscription) => {
              const startDate = sub.start_date ? new Date(sub.start_date) : null;

              if (!startDate || startDate <= currentMonthDate) {
                const amount = parseFloat(sub.amount as string) || 0;
                const monthlyAmount = calculateMonthlyAmount(amount, sub.billing_cycle);
                const convertedAmount = convertCurrency(monthlyAmount, sub.currency || 'CNY', targetCurrency, exchangeRates);
                return acc + convertedAmount;
              }
              return acc;
            }, 0);

            // 从分组数据中获取支付次数（优化：避免数据库查询）
            const paymentCount = getPaymentCountForPeriod(groupedPayments, 'monthly', monthKey);

            monthlyExpenses.push({
              month: monthKey,
              year: parseInt(yearStr),
              total: Math.round(totalMonthlyExpense * 100) / 100,
              currency: targetCurrency,
              paymentCount: paymentCount
            });
          } catch (monthError) {
            console.error(`计算 ${monthKey} 月份费用时出错:`, monthError);
            const [year, month] = monthKey.split('-');
            monthlyExpenses.push({
              month: monthKey,
              year: parseInt(year),
              total: 0,
              currency: targetCurrency,
              paymentCount: 0
            });
          }
        }

        console.log(`生成了 ${monthlyExpenses.length} 个月的费用数据`);
        response.monthlyExpenses = monthlyExpenses.sort((a, b) => a.month.localeCompare(b.month));
      } catch (error) {
        console.error('计算月度费用数据时出错:', error);
        response.monthlyExpenses = [];
      }
    }

    // 获取季度费用数据（使用优化逻辑）
    if (includeQuarterlyExpenses && quarterlyStartDate && quarterlyEndDate) {
      try {
        console.log('计算季度费用数据...');
        const quarterlyExpenses: any[] = [];
        const quarterlyMap = new Map();

        // 生成季度范围
        let currentDate = new Date(quarterlyStartDate);
        const endDate = new Date(quarterlyEndDate);

        while (currentDate <= endDate) {
          const year = currentDate.getFullYear();
          const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
          const key = `${year}-Q${quarter}`;
          quarterlyMap.set(key, 0);

          // 移动到下个季度
          currentDate.setMonth(currentDate.getMonth() + 3);
        }

        // 计算每季度的总费用和支付数量（使用分组数据优化）
        for (const [quarterKey, _] of quarterlyMap.entries()) {
          const [yearStr, quarterStr] = quarterKey.split('-');
          const year = parseInt(yearStr);
          const quarter = parseInt(quarterStr.substring(1));

          // 创建当前季度的第一天日期对象，用于比较
          const quarterStartMonth = (quarter - 1) * 3;
          const currentQuarterDate = new Date(year, quarterStartMonth, 1);

          const totalQuarterlyExpense = activeSubscriptions.reduce((acc, sub: Subscription) => {
            const startDate = sub.start_date ? new Date(sub.start_date) : null;

            if (!startDate || startDate <= currentQuarterDate) {
              const amount = parseFloat(sub.amount as string) || 0;
              const monthlyAmount = calculateMonthlyAmount(amount, sub.billing_cycle);
              const quarterlyAmount = monthlyAmount * 3;
              const convertedAmount = convertCurrency(quarterlyAmount, sub.currency || 'CNY', targetCurrency, exchangeRates);
              return acc + convertedAmount;
            }
            return acc;
          }, 0);

          // 从分组数据中获取支付次数（优化：避免数据库查询）
          const paymentCount = getPaymentCountForPeriod(groupedPayments, 'quarterly', quarterKey);

          quarterlyExpenses.push({
            year,
            quarter,
            total: Math.round(totalQuarterlyExpense * 100) / 100,
            currency: targetCurrency,
            paymentCount: paymentCount
          });
        }

        console.log(`生成了 ${quarterlyExpenses.length} 个季度的费用数据`);
        response.quarterlyExpenses = quarterlyExpenses.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.quarter - b.quarter;
        });
      } catch (error) {
        console.error('计算季度费用数据时出错:', error);
        response.quarterlyExpenses = [];
      }
    }

    // 获取年度费用数据（使用优化逻辑）
    if (includeYearlyExpenses && yearlyStartDate && yearlyEndDate) {
      try {
        console.log('计算年度费用数据...');
        const yearlyExpenses: any[] = [];
        const yearlyMap = new Map();
        const startYear = new Date(yearlyStartDate).getFullYear();
        const endYear = new Date(yearlyEndDate).getFullYear();

        // 生成年份范围
        for (let year = startYear; year <= endYear; year++) {
          yearlyMap.set(year, 0);
        }

        // 计算每年的总费用（使用分组数据优化）
        for (const [year, _] of yearlyMap.entries()) {
          let totalYearlyExpense = 0;

          if (year === 2023) {
            // 2023年没有订阅，费用为0
            totalYearlyExpense = 0;
          } else {
            // 2024年及以后的年份，计算当年及之前年份开始的订阅
            totalYearlyExpense = activeSubscriptions.reduce((acc, sub: Subscription) => {
              const startDate = sub.start_date ? new Date(sub.start_date) : new Date();
              const startYear = startDate.getFullYear();

              if (startYear <= year) {
                const amount = parseFloat(sub.amount as string) || 0;
                const yearlyAmount = calculateYearlyAmount(amount, sub.billing_cycle);
                const convertedAmount = convertCurrency(yearlyAmount, sub.currency || 'CNY', targetCurrency, exchangeRates);
                return acc + convertedAmount;
              }
              return acc;
            }, 0);
          }

          // 从分组数据中获取支付次数（优化：避免数据库查询）
          const paymentCount = getPaymentCountForPeriod(groupedPayments, 'yearly', year.toString());

          yearlyExpenses.push({
            year,
            total: Math.round(totalYearlyExpense * 100) / 100,
            currency: targetCurrency,
            paymentCount: paymentCount
          });
        }

        console.log(`生成了 ${yearlyExpenses.length} 年的费用数据`);
        response.yearlyExpenses = yearlyExpenses.sort((a, b) => a.year - b.year);
      } catch (error) {
        console.error('计算年度费用数据时出错:', error);
        response.yearlyExpenses = [];
      }
    }

    // 获取分类费用数据（保持原有逻辑）
    if (includeCategoryExpenses) {
      try {
        console.log('计算分类费用数据...');
        const categoryMap = new Map();

        // 获取当前年份
        const currentYear = new Date().getFullYear();

        activeSubscriptions.forEach((subscription: Subscription) => {
          try {
            // 获取订阅开始日期
            const startDate = subscription.start_date ? new Date(subscription.start_date) : new Date();
            const startYear = startDate.getFullYear();

            // 根据当前年份采用不同的计算逻辑
            let includeSubscription = false;

            if (currentYear === 2023) {
              // 2023年没有订阅，费用为0
              includeSubscription = false;
            } else {
              // 2024年及以后的年份，计算当年及之前年份开始的订阅
              includeSubscription = (startYear <= currentYear);
            }

            if (includeSubscription) {
              const amount = parseFloat(subscription.amount as string) || 0;
              const yearlyAmount = calculateYearlyAmount(amount, subscription.billing_cycle);
              const convertedAmount = convertCurrency(yearlyAmount, subscription.currency || 'CNY', targetCurrency, exchangeRates);
              const categoryValue = subscription.categories?.value || 'other';
              const categoryLabel = subscription.categories?.label || '其他';

              if (!categoryMap.has(categoryValue)) {
                categoryMap.set(categoryValue, {
                  category: categoryValue,
                  label: categoryLabel,
                  total: 0,
                  currency: targetCurrency,
                  subscriptions: []
                });
              }

              const categoryData = categoryMap.get(categoryValue);
              categoryData.total += convertedAmount;
              categoryData.subscriptions.push({
                id: subscription.id,
                name: subscription.name,
                amount: convertedAmount,
                currency: targetCurrency,
                billing_cycle: subscription.billing_cycle
              });
            }
          } catch (subscriptionError) {
            console.error(`处理订阅 ${subscription.id} 时出错:`, subscriptionError);
          }
        });

        // 转换为数组并排序
        const categoryExpenses = Array.from(categoryMap.values())
          .map(category => ({
            ...category,
            total: Math.round(category.total * 100) / 100
          }))
          .sort((a, b) => b.total - a.total);

        console.log(`生成了 ${categoryExpenses.length} 个分类的费用数据`);
        response.categoryExpenses = categoryExpenses;
      } catch (error) {
        console.error('计算分类费用数据时出错:', error);
        response.categoryExpenses = [];
      }
    }

    console.log('费用报告计算完成，返回响应');
    return new Response(JSON.stringify({
      success: true,
      data: response
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('处理费用报告请求时出错:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});