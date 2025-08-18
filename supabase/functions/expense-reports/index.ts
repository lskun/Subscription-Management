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
  subscription_id?: string | null;
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
      .select('id, payment_date, amount_paid, currency, status, subscription_id')
      .eq('user_id', userId)
      .eq('status', 'success')
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
 * 计算指定时间段内基于“实际支付流水”的总额（按目标货币换算）
 */
function sumPaymentsForPeriod(
  groupedPayments: GroupedPayments,
  periodType: 'monthly' | 'quarterly' | 'yearly',
  periodKey: string,
  targetCurrency: string,
  exchangeRates: Record<string, number>
): number {
  try {
    const payments = groupedPayments[periodType].get(periodKey) || [];
    let total = 0;
    for (const p of payments) {
      const amountNum = parseFloat(p.amount_paid as unknown as string) || 0;
      total += convertCurrency(amountNum, p.currency || 'CNY', targetCurrency, exchangeRates);
    }
    return Math.round(total * 100) / 100;
  } catch (e) {
    console.error('sumPaymentsForPeriod error:', e);
    return 0;
  }
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
  _activeSubscriptions: Subscription[],
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

    // 实际支付口径：直接汇总该月的支付流水（按目标货币换算）
    const monthlyAmount = sumPaymentsForPeriod(
      groupedPayments,
      'monthly',
      monthKey,
      targetCurrency,
      exchangeRates
    );

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

    // 实际支付口径：该季度支付流水合计
    const quarterlyAmount = sumPaymentsForPeriod(
      groupedPayments,
      'quarterly',
      quarterKey,
      targetCurrency,
      exchangeRates
    );

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
  // 关键修复：显式标注 years 的类型为 number[]，避免在严格模式下被推断为 never[] 导致后续 year.toString() 报错
  const years: number[] = [];
  for (let i = 0; i < 3; i++) {
    years.push(now.getFullYear() - i);
  }

  for (const year of years) {
    // 实际支付口径：该年的支付流水合计
    let yearlyAmount = sumPaymentsForPeriod(
      groupedPayments,
      'yearly',
      year.toString(),
      targetCurrency,
      exchangeRates
    );
    // 保留硬编码：2023 年金额置 0
    if (year === 2023) {
      yearlyAmount = 0;
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
      includeQuarterlyExpenses = true, 
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

    // 步骤3: expenseInfo 将在获取 SQL 聚合后统一基于 SQL 结果构建，以确保口径一致

    // 获取月度费用数据（改为 SQL 聚合函数）
    if (includeMonthlyExpenses && monthlyStartDate && monthlyEndDate) {
      try {
        console.log('计算月度费用数据（SQL 聚合）...');
        console.time('expense-reports:monthly_sql')
        const mStart = String(monthlyStartDate).slice(0, 10);
        const mEnd = String(monthlyEndDate).slice(0, 10);
        const { data: monthlyRows, error: monthlyErr } = await supabaseClient
          .rpc('expense_monthly_aggregate', {
            p_user_id: user.id,
            p_target_currency: targetCurrency,
            p_start: mStart,
            p_end: mEnd,
          });
        console.timeEnd('expense-reports:monthly_sql')
        if (monthlyErr) throw monthlyErr;
        // 归一：按最近4个月（锚定 mEnd 或当前日期）补全为0
        const anchor = mEnd ? new Date(mEnd) : new Date();
        const monthKeys: string[] = [];
        for (let i = 3; i >= 0; i--) {
          const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthKeys.push(mk);
        }
        const byMonth: Record<string, any> = {};
        const byMonthPaymentCount: Record<string, number> = {};
        (monthlyRows || []).forEach((r: any) => { byMonth[r.month] = r; byMonthPaymentCount[r.month] = Number(r.payment_count) || 0; });
        // 计算每月活跃订阅数（定义：该月发生过成功支付的去重订阅数）
        const { data: phRows, error: phErr } = await supabaseClient
          .from('payment_history')
          .select('payment_date, subscription_id')
          .eq('user_id', user.id)
          .eq('status', 'success')
          .gte('payment_date', mStart)
          .lte('payment_date', mEnd);
        if (phErr) {
          console.warn('拉取支付记录用于计算活跃订阅数时出错，将默认0：', phErr);
        }
        const activeSubsSets: Record<string, Set<string>> = {};
        (phRows || []).forEach((row: any) => {
          const d = new Date(row.payment_date);
          if (isNaN(d.getTime())) return;
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!activeSubsSets[mk]) activeSubsSets[mk] = new Set<string>();
          if (row.subscription_id) activeSubsSets[mk].add(row.subscription_id);
        });
        const activeSubsByMonth: Record<string, number> = {};
        Object.keys(activeSubsSets).forEach((mk) => { activeSubsByMonth[mk] = activeSubsSets[mk].size; });
        const filledMonthly = monthKeys.map((mk) => {
          const row = byMonth[mk];
          const year = parseInt(mk.slice(0, 4));
          return {
            month: mk,
            year,
            total: row ? (Number(row.total) || 0) : 0,
            currency: row?.currency || targetCurrency,
            activeSubscriptionCount: activeSubsByMonth[mk] || 0,
          };
        });
        response.monthlyExpenses = filledMonthly;
        // 基于补全后的 monthly 构建 expenseInfo.monthly
        if (includeExpenseInfo) {
          const expenseMonthly = filledMonthly.map((r: any, idx: number) => {
            const prev = idx > 0 ? filledMonthly[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return {
              period: r.month,
              amount: cur,
              change,
              currency: r.currency || targetCurrency,
              // 产品含义为“活跃订阅数”，这里将 paymentCount 字段返回为当月发生过成功支付的去重订阅数
              paymentCount: r.activeSubscriptionCount || 0,
            };
          });
          response.expenseInfo = response.expenseInfo || { monthly: [], quarterly: [], yearly: [] };
          response.expenseInfo.monthly = expenseMonthly;
        }
      } catch (error) {
        console.error('计算月度费用数据时出错:', error);
        response.monthlyExpenses = [];
      }
    }

    // 获取季度费用数据（使用优化逻辑；未提供时间范围时按锚点自动推导最近3个季度并补0）
    if (includeQuarterlyExpenses) {
      try {
        console.log('计算季度费用数据（基于月度聚合，并补全最近3个季度）...');
        // 确定锚点：优先 quarterlyEndDate，否则当前时间
        const qAnchor = quarterlyEndDate ? new Date(String(quarterlyEndDate).slice(0, 10)) : new Date();
        const currentQuarter = Math.floor(qAnchor.getMonth() / 3) + 1;
        const anchorYear = qAnchor.getFullYear();
        // 计算最近3个季度键（升序）
        const quarterKeys: string[] = [];
        for (let i = 2; i >= 0; i--) {
          const totalQuartersFromYearStart = (currentQuarter - 1) - i;
          const yearOffset = Math.floor(totalQuartersFromYearStart / 4);
          const quarterIndex = ((totalQuartersFromYearStart % 4) + 4) % 4; // 0..3
          const year = anchorYear + yearOffset;
          const quarterNum = quarterIndex + 1;
          quarterKeys.push(`${year}-Q${quarterNum}`);
        }
        // 计算查询窗口：从最早季度的起始月到当前季度的结束月
        const firstQ = quarterKeys[0];
        const [fy, fq] = firstQ.split('-Q').map((v) => parseInt(v, 10));
        const firstStart = new Date(fy, (fq - 1) * 3, 1);
        const lastQ = quarterKeys[quarterKeys.length - 1];
        const [ly, lq] = lastQ.split('-Q').map((v) => parseInt(v, 10));
        const lastEnd = new Date(ly, lq * 3, 0); // 季度末日
        const qStartStr = firstStart.toISOString().slice(0, 10);
        const qEndStr = lastEnd.toISOString().slice(0, 10);
        // 拉取该窗口的月度聚合
        const { data: monthlyRowsForQ, error: qErr } = await supabaseClient.rpc('expense_monthly_aggregate', {
          p_user_id: user.id,
          p_target_currency: targetCurrency,
          p_start: qStartStr,
          p_end: qEndStr,
        });
        if (qErr) throw qErr;
        // 按季度汇总
        const grouped: Record<string, { amount: number; count: number; currency: string }> = {};
        (monthlyRowsForQ || []).forEach((r: any) => {
          const [y, m] = String(r.month).split('-').map((v: string) => parseInt(v, 10));
          const q = Math.floor((m - 1) / 3) + 1;
          const key = `${y}-Q${q}`;
          if (!grouped[key]) grouped[key] = { amount: 0, count: 0, currency: r.currency || targetCurrency };
          grouped[key].amount += Number(r.total) || 0;
          grouped[key].count += Number(r.payment_count) || 0;
        });
        const quarterlyExpenses = quarterKeys.map((k) => {
          const g = grouped[k];
          const [yy, qq] = k.split('-Q').map((v) => parseInt(v, 10));
          return {
            year: yy,
            quarter: qq,
            total: Math.round((g?.amount || 0) * 100) / 100,
            currency: g?.currency || targetCurrency,
            paymentCount: g?.count || 0,
          };
        });
        response.quarterlyExpenses = quarterlyExpenses;
        // 关键修复：在季度计算处直接构建 expenseInfo.quarterly，避免依赖分类分支
        if (includeExpenseInfo) {
          const expenseQuarterly = quarterlyExpenses.map((r, idx) => {
            const prev = idx > 0 ? quarterlyExpenses[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return { period: `${r.year}-Q${r.quarter}`, amount: cur, change, currency: r.currency || targetCurrency, paymentCount: r.paymentCount || 0 };
          });
          response.expenseInfo = response.expenseInfo || { monthly: [], quarterly: [], yearly: [] };
          response.expenseInfo.quarterly = expenseQuarterly;
        }
      } catch (error) {
        console.error('计算季度费用数据时出错:', error);
        response.quarterlyExpenses = [];
      }
    }

    // 获取年度费用数据（改为 SQL 聚合函数；未提供时间范围时按当前年份锚定返回最近3年并补0）
    if (includeYearlyExpenses) {
      try {
        console.log('计算年度费用数据（SQL 聚合）...');
        console.time('expense-reports:yearly_sql')
        // 允许不传 yearlyStartDate/yearlyEndDate：
        // 当未提供时，以锚点年（yearlyEndDate 或 当前年）构造覆盖最近3年的查询窗口
        const nowForYear = new Date();
        const providedStart = yearlyStartDate ? String(yearlyStartDate).slice(0, 10) : null;
        const providedEnd = yearlyEndDate ? String(yearlyEndDate).slice(0, 10) : null;
        const anchorYear = providedEnd ? new Date(providedEnd).getFullYear() : nowForYear.getFullYear();
        const yStart = providedStart || new Date(anchorYear - 2, 0, 1).toISOString().slice(0, 10);
        const yEnd = providedEnd || new Date(anchorYear, 11, 31).toISOString().slice(0, 10);
        const { data: yearlyRows, error: yearlyErr } = await supabaseClient
          .rpc('expense_yearly_aggregate', {
            p_user_id: user.id,
            p_target_currency: targetCurrency,
            p_start: yStart,
            p_end: yEnd,
          });
        console.timeEnd('expense-reports:yearly_sql')
        if (yearlyErr) throw yearlyErr;
        // 计算每年“活跃订阅数”（定义：该年内发生过成功支付的去重订阅数）
        const { data: phYearRows, error: phYearErr } = await supabaseClient
          .from('payment_history')
          .select('payment_date, subscription_id')
          .eq('user_id', user.id)
          .eq('status', 'success')
          .gte('payment_date', yStart)
          .lte('payment_date', yEnd);
        if (phYearErr) {
          console.warn('拉取支付记录用于计算年度活跃订阅数时出错，将默认0：', phYearErr);
        }
        const activeSubsYearSets: Record<string, Set<string>> = {};
        (phYearRows || []).forEach((row: any) => {
          const d = new Date(row.payment_date);
          if (isNaN(d.getTime())) return;
          const yk = String(d.getFullYear());
          if (!activeSubsYearSets[yk]) activeSubsYearSets[yk] = new Set<string>();
          if (row.subscription_id) activeSubsYearSets[yk].add(row.subscription_id);
        });
        const activeSubsByYear: Record<string, number> = {};
        Object.keys(activeSubsYearSets).forEach((yk) => { activeSubsByYear[yk] = activeSubsYearSets[yk].size; });
        // 补全最近3年（锚定 yEnd 或当前年份）
        const yAnchor = new Date(yEnd);
        const anchorY = yAnchor.getFullYear();
        const yearKeys: number[] = [anchorY - 2, anchorY - 1, anchorY];
        const byYear: Record<string, any> = {};
        (yearlyRows || []).forEach((r: any) => { byYear[String(r.year)] = r; });
        const filledYearly = yearKeys.map((y) => {
          const row = byYear[String(y)];
          const total = row ? (Number(row.total) || 0) : 0;
          return {
            year: y,
            total,
            currency: row?.currency || targetCurrency,
            activeSubscriptionCount: activeSubsByYear[String(y)] || 0,
          };
        });
        response.yearlyExpenses = filledYearly;
        // 基于补全后的 yearly 构建 expenseInfo.yearly
        if (includeExpenseInfo) {
          const expenseYearly = filledYearly.map((r: any, idx: number) => {
            const prev = idx > 0 ? filledYearly[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return {
              period: String(r.year),
              amount: cur,
              change,
              currency: r.currency || targetCurrency,
              // 产品含义为“活跃订阅数”，这里将 paymentCount 字段返回为当年发生过成功支付的去重订阅数
              paymentCount: r.activeSubscriptionCount || 0,
            };
          });
          response.expenseInfo = response.expenseInfo || { monthly: [], quarterly: [], yearly: [] };
          response.expenseInfo.yearly = expenseYearly;
        }
      } catch (error) {
        console.error('计算年度费用数据时出错:', error);
        response.yearlyExpenses = [];
      }
    }

    // 获取分类费用数据（改为 SQL 聚合函数）
    if (includeCategoryExpenses) {
      try {
        console.log('计算分类费用数据（SQL 聚合）...');
        console.time('expense-reports:category_sql')
        // 选择分类计算窗口：优先使用 monthlyStart/end，其次 yearlyStart/end，最后 fallback 为最近一年
        let cStart = monthlyStartDate ? String(monthlyStartDate).slice(0, 10) : null;
        let cEnd = monthlyEndDate ? String(monthlyEndDate).slice(0, 10) : null;
        if (!cStart || !cEnd) {
          cStart = yearlyStartDate ? String(yearlyStartDate).slice(0, 10) : new Date(new Date().getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
          cEnd = yearlyEndDate ? String(yearlyEndDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
        }
        const { data: catRows, error: catErr } = await supabaseClient
          .rpc('expense_category_aggregate', {
            p_user_id: user.id,
            p_target_currency: targetCurrency,
            p_start: cStart,
            p_end: cEnd,
          });
        console.timeEnd('expense-reports:category_sql')
        if (catErr) throw catErr;
        response.categoryExpenses = (catRows || []).map((r: any) => ({
          category: r.category,
          label: r.label,
          total: Number(r.total) || 0,
          currency: r.currency || targetCurrency,
          subscriptionCount: Number(r.subscription_count) || 0,
        }));
        // expenseInfo.quarterly 已在季度分支构建
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