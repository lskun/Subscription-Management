// @ts-ignore - Deno runtime imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno runtime imports  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  const startTime = Date.now();

  try {
    // 获取用户认证信息
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header missing'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 创建 Supabase 客户端
    // @ts-ignore - Deno global is available in Edge Functions runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore - Deno global is available in Edge Functions runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 验证用户
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 解析请求参数 - 保持与原始函数一致的参数名
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
    } = await req.json().catch(() => ({}));


    // 构建响应数据 - 与原始函数保持一致的结构
    const response: any = {
      currency: targetCurrency,
      timestamp: new Date().toISOString()
    };

    console.log('开始调用优化的数据库函数...');
    
    // 使用优化的数据库函数获取基础数据
    const { data: optimizedData, error: dbError } = await supabaseClient
      .rpc('get_expense_summary_optimized', {
        p_user_id: user.id,
        p_target_currency: targetCurrency
      });

    if (dbError) {
      console.error('数据库函数调用错误:', dbError);
      throw dbError;
    }

    console.log('数据库函数调用成功，开始处理数据...');

    // 获取月度费用数据 - 合并基础数据和分类数据
    if (includeMonthlyExpenses) {
      try {
        console.log('处理月度费用数据（包含分类信息）...');
        
        // 确定锚点：优先使用monthlyEndDate，否则当前时间
        const anchor = monthlyEndDate ? new Date(monthlyEndDate) : new Date();
        
        // 生成最近12个月的键（从最早到最新）
        const monthKeys: string[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthKeys.push(mk);
        }
        
        // 从优化数据中提取月度基础数据
        const monthlyData = optimizedData?.monthly || [];
        const byMonth: Record<string, any> = {};
        monthlyData.forEach((item: any) => {
          byMonth[item.period] = item;
        });
        
        // 获取月度分类数据（如果需要分类信息）
        const monthCategoryMap: Record<string, Record<string, number>> = {};
        if (includeCategoryExpenses) {
          // 查询月度分类数据
          const { data: monthlyCategoryData, error: monthlyCategoryError } = await supabaseClient
            .from('payment_history')
            .select(`
              payment_date,
              amount_paid,
              currency,
              subscriptions!inner(
                name,
                category_id,
                categories!inner(value, label)
              )
            `)
            .eq('user_id', user.id)
            .eq('status', 'success')
            .gte('payment_date', `${monthKeys[0]}-01`)
            .lte('payment_date', `${monthKeys[monthKeys.length - 1]}-31`);

          if (!monthlyCategoryError && monthlyCategoryData) {
            // 获取汇率数据
            const { data: exchangeRates, error: ratesError } = await supabaseClient
              .from('exchange_rates')
              .select('date, from_currency, to_currency, rate')
              .order('date', { ascending: false })
              .order('updated_at', { ascending: false })
              .limit(7);

            // 获取最新汇率
            let latestRates: any[] = [];
            if (!ratesError && exchangeRates && exchangeRates.length > 0) {
              const latestDate = exchangeRates[0].date;
              latestRates = exchangeRates.filter(rate => rate.date === latestDate);
            }

            // 构建汇率映射表
            const rateMap: Record<string, number> = {};
            latestRates.forEach((rate: any) => {
              rateMap[`${rate.from_currency}_${rate.to_currency}`] = parseFloat(rate.rate);
            });

            // 初始化月份分类映射
            monthKeys.forEach(month => {
              monthCategoryMap[month] = {};
            });

            // 聚合分类数据
            monthlyCategoryData.forEach((payment: any) => {
              const paymentDate = new Date(payment.payment_date);
              const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
              
              if (monthCategoryMap[monthKey] && payment.subscriptions?.categories) {
                const category = payment.subscriptions.categories.value;
                const amount = parseFloat(payment.amount_paid) || 0;
                
                // 汇率转换逻辑
                let convertedAmount = amount;
                if (payment.currency !== targetCurrency) {
                  if (targetCurrency === 'CNY') {
                    const rateKey = `CNY_${payment.currency}`;
                    const rate = rateMap[rateKey];
                    if (rate && rate > 0) {
                      convertedAmount = amount / rate;
                    }
                  } else if (payment.currency === 'CNY') {
                    const rateKey = `CNY_${targetCurrency}`;
                    const rate = rateMap[rateKey];
                    if (rate && rate > 0) {
                      convertedAmount = amount * rate;
                    }
                  } else {
                    const fromRateKey = `CNY_${payment.currency}`;
                    const toRateKey = `CNY_${targetCurrency}`;
                    const fromRate = rateMap[fromRateKey];
                    const toRate = rateMap[toRateKey];
                    if (fromRate && toRate && fromRate > 0 && toRate > 0) {
                      const cnyAmount = amount / fromRate;
                      convertedAmount = cnyAmount * toRate;
                    }
                  }
                }
                
                monthCategoryMap[monthKey][category] = (monthCategoryMap[monthKey][category] || 0) + convertedAmount;
              }
            });
          }
        }
        
        // 构建统一的月度数据（包含基础信息和分类详情）
        const monthlyExpenses = monthKeys.map((mk) => {
          const item = byMonth[mk];
          const year = parseInt(mk.slice(0, 4));
          const categories = monthCategoryMap[mk] || {};
          const categoryTotal = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
          
          return {
            month: mk,
            year: year,
            total: item ? (item.paymentAmount || item.subscriptionAmount || 0) : 0,
            currency: targetCurrency,
            activeSubscriptionCount: item ? (item.activeSubscriptions || 0) : 0,
            categories: categories,
            categoryTotal: categoryTotal
          };
        });
        
        response.monthlyExpenses = monthlyExpenses;
        
        // 构建 expenseInfo.monthly - 只需要最近4个月（用于Monthly Expenses面板）
        if (includeExpenseInfo) {
          // 取最近4个月的数据用于expenseInfo
          const recentFourMonths = monthlyExpenses.slice(-4);
          const expenseMonthly = recentFourMonths.map((r: any, idx: number) => {
            const prev = idx > 0 ? recentFourMonths[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return {
              period: r.month,
              amount: cur,
              change: change,
              currency: targetCurrency,
              paymentCount: byMonth[r.month] ? (byMonth[r.month].paymentCount || 0) : 0
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

    // 获取季度费用数据 - 严格按原始逻辑：最近3个季度
    if (includeQuarterlyExpenses) {
      try {
        console.log('处理季度费用数据...');
        
        // 确定锚点：优先使用quarterlyEndDate，否则当前时间
        const qAnchor = quarterlyEndDate ? new Date(quarterlyEndDate) : new Date();
        const currentQuarter = Math.floor(qAnchor.getMonth() / 3) + 1;
        const anchorYear = qAnchor.getFullYear();
        
        // 计算最近3个季度键（从最早到最新）
        const quarterKeys: string[] = [];
        for (let i = 2; i >= 0; i--) {
          const totalQuartersFromYearStart = (currentQuarter - 1) - i;
          const yearOffset = Math.floor(totalQuartersFromYearStart / 4);
          const quarterIndex = ((totalQuartersFromYearStart % 4) + 4) % 4;
          const year = anchorYear + yearOffset;
          const quarterNum = quarterIndex + 1;
          quarterKeys.push(`${year}-Q${quarterNum}`);
        }
        
        // 从优化数据中提取季度数据
        const quarterlyData = optimizedData?.quarterly || [];
        const byQuarter: Record<string, any> = {};
        quarterlyData.forEach((item: any) => {
          byQuarter[item.period] = item;
        });
        
        // 按季度键顺序构建最近3个季度的数据
        const quarterlyExpenses = quarterKeys.map((qk) => {
          const item = byQuarter[qk];
          const [year, quarter] = qk.split('-Q').map(v => parseInt(v));
          return {
            quarter: quarter,
            year: year,
            total: item ? (item.amount || 0) : 0,
            currency: targetCurrency,
            activeSubscriptionCount: item ? (item.subscriptionCount || 0) : 0
          };
        });
        
        response.quarterlyExpenses = quarterlyExpenses;
        
        // 构建 expenseInfo.quarterly - 必须为最近3个季度
        if (includeExpenseInfo) {
          const expenseQuarterly = quarterlyExpenses.map((r: any, idx: number) => {
            const prev = idx > 0 ? quarterlyExpenses[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return {
              period: `${r.year}-Q${r.quarter}`,
              amount: cur,
              change: change,
              currency: targetCurrency,
              paymentCount: byQuarter[`${r.year}-Q${r.quarter}`] ? (byQuarter[`${r.year}-Q${r.quarter}`].paymentCount || 0) : 0
            };
          });
          response.expenseInfo = response.expenseInfo || { monthly: [], quarterly: [], yearly: [] };
          response.expenseInfo.quarterly = expenseQuarterly;
        }
      } catch (error) {
        console.error('计算季度费用数据时出错:', error);
        response.quarterlyExpenses = [];
      }
    }

    // 获取年度费用数据 - 严格按原始逻辑：最近3年
    if (includeYearlyExpenses) {
      try {
        console.log('处理年度费用数据...');
        
        // 确定锚点：优先使用yearlyEndDate，否则当前时间
        const yAnchor = yearlyEndDate ? new Date(yearlyEndDate) : new Date();
        const anchorY = yAnchor.getFullYear();
        
        // 计算最近3年（从最早到最新）
        const yearKeys: number[] = [anchorY - 2, anchorY - 1, anchorY];
        
        // 从优化数据中提取年度数据
        const yearlyData = optimizedData?.yearly || [];
        const byYear: Record<string, any> = {};
        yearlyData.forEach((item: any) => {
          byYear[String(item.year)] = item;
        });
        
        // 按年份键顺序构建最近3年的数据
        const yearlyExpenses = yearKeys.map((y) => {
          const item = byYear[String(y)];
          return {
            year: y,
            total: item ? (item.amount || 0) : 0,
            currency: targetCurrency,
            activeSubscriptionCount: item ? (item.subscriptionCount || 0) : 0
          };
        });
        
        response.yearlyExpenses = yearlyExpenses;
        
        // 构建 expenseInfo.yearly - 必须为最近3年
        if (includeExpenseInfo) {
          const expenseYearly = yearlyExpenses.map((r: any, idx: number) => {
            const prev = idx > 0 ? yearlyExpenses[idx - 1] : null;
            const cur = Number(r.total) || 0;
            const prevVal = prev ? Number(prev.total) || 0 : 0;
            const change = prevVal > 0 ? Math.round(((cur - prevVal) / prevVal) * 1000) / 10 : 0;
            return {
              period: String(r.year),
              amount: cur,
              change: change,
              currency: targetCurrency,
              paymentCount: byYear[String(r.year)] ? (byYear[String(r.year)].paymentCount || 0) : 0
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

    // 获取分类费用数据
    if (includeCategoryExpenses) {
      try {
        console.log('处理分类费用数据...');
        
        // 使用分类汇总函数
        const { data: categoryData, error: categoryError } = await supabaseClient
          .rpc('get_category_expense_summary', {
            p_user_id: user.id,
            p_target_currency: targetCurrency
          });

        if (!categoryError && categoryData?.categories) {
          response.categoryExpenses = categoryData.categories.map((item: any) => ({
            category: item.value,
            label: item.name,
            total: item.yearlyTotal || 0,
            currency: targetCurrency,
            subscriptionCount: item.subscriptionCount || 0
          }));
        } else {
          response.categoryExpenses = [];
        }
      } catch (error) {
        console.error('计算分类费用数据时出错:', error);
        response.categoryExpenses = [];
      }
    }

    // 生成兼容性的monthlyCategoryExpenses数据（基于新的monthlyExpenses）
    if (includeMonthlyExpenses && includeCategoryExpenses && response.monthlyExpenses) {
      response.monthlyCategoryExpenses = response.monthlyExpenses.map((monthData: any) => ({
        month: monthData.month,
        monthKey: monthData.month,
        year: monthData.year,
        categories: monthData.categories,
        total: monthData.categoryTotal
      }));
    }

    // 添加性能指标
    response.performance = {
      queryTime: Date.now() - startTime
    };


    console.log(`费用报告计算完成，耗时: ${Date.now() - startTime}ms`);
    
    // 返回与原始函数完全一致的格式
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
      message: error.message || 'Unknown error',
      performance: {
        queryTime: Date.now() - startTime
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});