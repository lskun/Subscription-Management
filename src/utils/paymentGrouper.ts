/**
 * 支付记录分组逻辑
 * 用于将支付记录按时间段（月、季度、年）进行分组
 */

/**
 * 支付记录接口定义
 */
export interface PaymentRecord {
  id: string;
  payment_date: string;
  amount_paid: string;
  currency: string;
  status: string;
}

/**
 * 分组后的支付记录接口
 */
export interface GroupedPayments {
  monthly: Map<string, PaymentRecord[]>;    // key: "2025-01"
  quarterly: Map<string, PaymentRecord[]>;  // key: "2025-Q1"
  yearly: Map<string, PaymentRecord[]>;     // key: "2025"
}

/**
 * 日期分类器类 - 支持月、季度、年的分类
 */
export class DatePeriodClassifier {
  /**
   * 获取月份键值 - 格式: "YYYY-MM"
   */
  getMonthKey(date: Date): string {
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date provided: ${date}`);
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  /**
   * 获取季度键值 - 格式: "YYYY-QN"
   */
  getQuarterKey(date: Date): string {
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date provided: ${date}`);
    }
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }
  
  /**
   * 获取年份键值 - 格式: "YYYY"
   */
  getYearKey(date: Date): string {
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date provided: ${date}`);
    }
    return date.getFullYear().toString();
  }
}

/**
 * 辅助函数：将支付记录添加到分组中
 */
function addToGroup(groupMap: Map<string, PaymentRecord[]>, key: string, payment: PaymentRecord): void {
  if (!groupMap.has(key)) {
    groupMap.set(key, []);
  }
  groupMap.get(key)!.push(payment);
}

/**
 * 支付记录分组函数 - 根据日期将支付记录分组到不同时间段
 * 添加边界情况处理（无效日期、空数据等）
 */
export function groupPaymentsByPeriod(payments: PaymentRecord[]): GroupedPayments {
  // 处理空数据情况
  if (!payments || payments.length === 0) {
    console.log('支付记录为空，返回空分组');
    return {
      monthly: new Map(),
      quarterly: new Map(),
      yearly: new Map()
    };
  }

  const result: GroupedPayments = {
    monthly: new Map(),
    quarterly: new Map(),
    yearly: new Map()
  };
  
  const classifier = new DatePeriodClassifier();
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const payment of payments) {
    try {
      // 验证支付记录的基本字段
      if (!payment || !payment.id || !payment.payment_date) {
        console.warn(`跳过无效的支付记录: ${JSON.stringify(payment)}`);
        skippedCount++;
        continue;
      }

      const paymentDate = new Date(payment.payment_date);
      
      // 验证日期有效性
      if (isNaN(paymentDate.getTime())) {
        console.warn(`跳过无效日期的支付记录 ${payment.id}: ${payment.payment_date}`);
        skippedCount++;
        continue;
      }

      // 验证日期是否在合理范围内（不能是未来日期，不能太久远）
      const now = new Date();
      const minDate = new Date(now.getFullYear() - 10, 0, 1); // 10年前
      
      if (paymentDate > now) {
        console.warn(`跳过未来日期的支付记录 ${payment.id}: ${payment.payment_date}`);
        skippedCount++;
        continue;
      }
      
      if (paymentDate < minDate) {
        console.warn(`跳过过于久远的支付记录 ${payment.id}: ${payment.payment_date}`);
        skippedCount++;
        continue;
      }
      
      // 分组到不同时间段
      try {
        const monthKey = classifier.getMonthKey(paymentDate);
        const quarterKey = classifier.getQuarterKey(paymentDate);
        const yearKey = classifier.getYearKey(paymentDate);
        
        // 添加到对应的分组中
        addToGroup(result.monthly, monthKey, payment);
        addToGroup(result.quarterly, quarterKey, payment);
        addToGroup(result.yearly, yearKey, payment);
        
        processedCount++;
      } catch (classifierError) {
        console.error(`日期分类失败，支付记录 ${payment.id}:`, classifierError);
        skippedCount++;
      }
      
    } catch (error) {
      console.error(`处理支付记录 ${payment?.id || 'unknown'} 时出错:`, error);
      skippedCount++;
    }
  }
  
  console.log(`支付记录分组完成: 处理${processedCount}条，跳过${skippedCount}条`);
  console.log(`分组结果: 月度${result.monthly.size}个, 季度${result.quarterly.size}个, 年度${result.yearly.size}个`);
  
  return result;
}

/**
 * 获取指定时间段的支付记录数量
 */
export function getPaymentCountForPeriod(
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
 * 获取指定时间段的支付记录
 */
export function getPaymentsForPeriod(
  groupedPayments: GroupedPayments,
  periodType: 'monthly' | 'quarterly' | 'yearly',
  periodKey: string
): PaymentRecord[] {
  try {
    const group = groupedPayments[periodType];
    return group.get(periodKey) || [];
  } catch (error) {
    console.error(`获取时间段 ${periodType}:${periodKey} 的支付记录时出错:`, error);
    return [];
  }
}

/**
 * 验证分组结果的完整性
 */
export function validateGroupedPayments(
  originalPayments: PaymentRecord[],
  groupedPayments: GroupedPayments
): boolean {
  try {
    // 计算分组后的总记录数
    let totalGroupedCount = 0;
    
    // 统计月度分组的记录数
    for (const payments of groupedPayments.monthly.values()) {
      totalGroupedCount += payments.length;
    }
    
    // 验证记录数是否匹配（每条记录会被分到月、季度、年三个分组中，所以月度分组的总数应该等于原始记录数）
    const validPaymentsCount = originalPayments.filter(p => 
      p && p.id && p.payment_date && !isNaN(new Date(p.payment_date).getTime())
    ).length;
    
    if (totalGroupedCount !== validPaymentsCount) {
      console.warn(`分组验证失败: 原始有效记录${validPaymentsCount}条，月度分组${totalGroupedCount}条`);
      return false;
    }
    
    console.log(`分组验证成功: ${validPaymentsCount}条记录正确分组`);
    return true;
  } catch (error) {
    console.error('验证分组结果时出错:', error);
    return false;
  }
}