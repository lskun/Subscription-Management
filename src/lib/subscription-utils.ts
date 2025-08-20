import { BillingCycle, Subscription, SubscriptionStatus } from '@/store/subscriptionStore'



/**
 * Calculate the next billing date based on the current date and billing cycle
 */
export function calculateNextBillingDate(
  currentDate: Date,
  billingCycle: BillingCycle
): string {
  const nextDate = new Date(currentDate)

  switch (billingCycle) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
  }

  return nextDate.toISOString().split('T')[0]
}

/**
 * Calculate the next billing date for a new subscription
 * For new subscriptions, next billing date should be start date + one billing cycle
 */
export function calculateNextBillingDateForNewSubscription(
  startDate: Date,
  billingCycle: BillingCycle
): string {
  const nextBilling = new Date(startDate)

  switch (billingCycle) {
    case 'monthly':
      nextBilling.setMonth(nextBilling.getMonth() + 1)
      break
    case 'yearly':
      nextBilling.setFullYear(nextBilling.getFullYear() + 1)
      break
    case 'quarterly':
      nextBilling.setMonth(nextBilling.getMonth() + 3)
      break
  }

  return nextBilling.toISOString().split('T')[0]
}

/**
 * Calculate the next billing date based on start date, current date and billing cycle
 * Calculates the next billing date that occurs after the current date, based on the billing cycle from start date
 * This function is used for existing subscriptions to find the next billing date after today
 */
export function calculateNextBillingDateFromStart(
  startDate: Date,
  currentDate: Date,
  billingCycle: BillingCycle
): string {
  const today = new Date(currentDate)
  const start = new Date(startDate)

  // Start with the start date as the base
  let nextBilling = new Date(start)

  // Keep adding billing cycles until we get a date after today
  while (nextBilling <= today) {
    switch (billingCycle) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1)
        break
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1)
        break
      case 'quarterly':
        nextBilling.setMonth(nextBilling.getMonth() + 3)
        break
    }
  }

  return nextBilling.toISOString().split('T')[0]
}

/**
 * Format a date as a readable string
 * 处理null/undefined值，避免显示错误日期
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) {
    return 'N/A'
  }
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
  
  return new Date(dateString).toLocaleDateString('en-US', options)
}

/**
 * Calculate time until next billing date
 */
export function getTimeUntilNextBilling(nextBillingDate: string): string {
  const today = new Date()
  const nextDate = new Date(nextBillingDate)
  const timeDiff = nextDate.getTime() - today.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

  if (daysDiff < 0) {
    return 'Overdue'
  } else if (daysDiff === 0) {
    return 'Today'
  } else if (daysDiff === 1) {
    return 'Tomorrow'
  } else if (daysDiff < 7) {
    return `${daysDiff} days`
  } else if (daysDiff < 30) {
    const weeks = Math.floor(daysDiff / 7)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
  } else {
    const months = Math.floor(daysDiff / 30)
    return `${months} ${months === 1 ? 'month' : 'months'}`
  }
}

/**
 * Calculate days until a given date
 */
export function daysUntil(dateString: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const targetDate = new Date(dateString)
  targetDate.setHours(0, 0, 0, 0)
  
  const timeDiff = targetDate.getTime() - today.getTime()
  return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)))
}

/**
 * Generate a status badge variant based on subscription status
 */
export function getStatusVariant(status: SubscriptionStatus): 'default' | 'secondary' | 'destructive' | 'warning' {
  switch (status) {
    case 'active':
      return 'default'
    case 'trial':
      return 'warning'
    case 'cancelled':
      return 'destructive'
    default:
      return 'secondary'
  }
}

/**
 * Get category value from subscription data with fallback to store data
 */
export function getCategoryLabel(
  subscription: any,
  categories: Array<{ id: string | number; value: string; label: string }>
): string {
  return subscription.category?.value ||
    categories.find(c => c.id === subscription.categoryId)?.value ||
    'Uncategorized'
}

/**
 * Get payment method value from subscription data with fallback to store data
 */
export function getPaymentMethodLabel(
  subscription: any,
  paymentMethods: Array<{ id: string | number; value: string; label: string }>
): string {
  return subscription.paymentMethod?.value ||
    paymentMethods.find(p => p.id === subscription.paymentMethodId)?.value ||
    'Unknown Payment Method'
}

/**
 * Check if a subscription is due for renewal (today or overdue)
 */
export function isSubscriptionDue(nextBillingDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const billingDate = new Date(nextBillingDate)
  billingDate.setHours(0, 0, 0, 0)

  return billingDate <= today
}

/**
 * Process automatic renewal for a subscription that is due
 */
export function processSubscriptionRenewal(subscription: Subscription): Partial<Subscription> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Calculate next billing date based on current next billing date and billing cycle
  const currentNextBilling = new Date(subscription.nextBillingDate)
  const newNextBilling = calculateNextBillingDate(currentNextBilling, subscription.billingCycle)

  return {
    lastBillingDate: todayStr,
    nextBillingDate: newNextBilling
  }
}

/**
 * Get color for subscription status
 */
export function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'text-emerald-500'
    case 'trial':
      return 'text-amber-500'
    case 'cancelled':
      return 'text-rose-500'
    default:
      return 'text-slate-500'
  }
}

/**
 * Get a formatted label for billing cycle
 */
export function getBillingCycleLabel(billingCycle: BillingCycle): string {
  switch (billingCycle) {
    case 'monthly':
      return 'Monthly'
    case 'yearly':
      return 'Yearly'
    case 'quarterly':
      return 'Quarterly'
    default:
      return String(billingCycle)
  }
}

/**
 * Export subscriptions to JSON format
 */
export function exportSubscriptionsToJSON(subscriptions: Subscription[]): string {
  return JSON.stringify(subscriptions, null, 2)
}

/**
 * Download data as a file
 */
export function downloadFile(data: string, filename: string, contentType: string): void {
  const blob = new Blob([data], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export subscriptions to CSV format
 */
export function exportSubscriptionsToCSV(subscriptions: Subscription[]): string {
  // Define the CSV headers
  const headers = [
    'name',
    'plan',
    'billingCycle',
    'nextBillingDate',
    'amount',
    'currency',
    'paymentMethod',
    'startDate',
    'status',
    'category',
    'renewalType',
    'notes',
    'website'
  ].join(',')
  
  // Convert each subscription to a CSV row
  const rows = subscriptions.map(sub => {
    return [
      `"${sub.name.replace(/"/g, '""')}"`,
      `"${sub.plan.replace(/"/g, '""')}"`,
      sub.billingCycle,
      sub.nextBillingDate,
      sub.amount,
      sub.currency,
      `"${(sub.paymentMethod?.label || 'Unknown').replace(/"/g, '""')}"`,
      sub.startDate,
      sub.status,
      sub.category?.value || 'other',
      sub.renewalType,
      `"${(sub.notes || '').replace(/"/g, '""')}"`,
      `"${(sub.website || '').replace(/"/g, '""')}"`
    ].join(',')
  })
  
  // Combine headers and rows
  return [headers, ...rows].join('\n')
}

/**
 * Parse CSV data into subscriptions
 * Returns an array of valid subscriptions and any errors encountered
 */
export function parseCSVToSubscriptions(
  csvData: string
): { subscriptions: Omit<Subscription, 'id' | 'lastBillingDate'>[]; errors: string[] } {
  const errors: string[] = []
  const subscriptions: Omit<Subscription, 'id' | 'lastBillingDate'>[] = []
  
  // Split the CSV into lines
  const lines = csvData.split('\n')
  if (lines.length < 2) {
    errors.push('CSV file does not contain enough data')
    return { subscriptions, errors }
  }
  
  // Parse headers to determine column indices
  const headers = parseCSVLine(lines[0])
  const requiredFields = ['name', 'amount', 'currency', 'billingCycle', 'nextBillingDate', 'status']
  
  // Check if all required fields are present
  for (const field of requiredFields) {
    if (!headers.includes(field)) {
      errors.push(`Required field '${field}' is missing from CSV headers`)
      return { subscriptions, errors }
    }
  }
  
  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue // Skip empty lines
    
    try {
      const values = parseCSVLine(lines[i])
      if (values.length !== headers.length) {
        errors.push(`Line ${i + 1}: Column count mismatch`)
        continue
      }
      
      // Create an object with the CSV values
      const subscription: any = {}
      headers.forEach((header, index) => {
        if (header === 'amount') {
          subscription[header] = parseFloat(values[index])
          if (isNaN(subscription[header])) {
            throw new Error(`Invalid amount value: ${values[index]}`)
          }
        } else {
          subscription[header] = values[index]
        }
      })
      
      // Validate required fields
      for (const field of requiredFields) {
        if (subscription[field] === undefined || subscription[field] === '') {
          throw new Error(`Missing required field: ${field}`)
        }
      }
      
      // Validate status field
      if (!['active', 'trial', 'cancelled'].includes(subscription.status)) {
        throw new Error(`Invalid status value: ${subscription.status}. Must be 'active', 'trial', or 'cancelled'.`)
      }
      
      // Validate billing cycle
      if (!['monthly', 'yearly', 'quarterly'].includes(subscription.billingCycle)) {
        throw new Error(`Invalid billingCycle value: ${subscription.billingCycle}. Must be 'monthly', 'yearly', or 'quarterly'.`)
      }

      // Validate renewal type (optional field with default)
      if (subscription.renewalType && !['auto', 'manual'].includes(subscription.renewalType)) {
        throw new Error(`Invalid renewalType value: ${subscription.renewalType}. Must be 'auto' or 'manual'.`)
      }

      // Set default values for optional fields
      if (!subscription.renewalType) {
        subscription.renewalType = 'manual'
      }
      if (!subscription.plan) {
        subscription.plan = ''
      }
      if (!subscription.startDate) {
        subscription.startDate = subscription.nextBillingDate
      }
      if (!subscription.notes) {
        subscription.notes = ''
      }
      if (!subscription.website) {
        subscription.website = ''
      }

      // Ensure required foreign key fields have default values
      if (!subscription.paymentMethodId) {
        subscription.paymentMethodId = 1 // Default to first payment method
      }
      if (!subscription.categoryId) {
        subscription.categoryId = 10 // Default to 'other' category
      }

      subscriptions.push(subscription as Omit<Subscription, 'id' | 'lastBillingDate'>)
    } catch (error: any) {
      errors.push(`Line ${i + 1}: ${error.message}`)
    }
  }
  
  return { subscriptions, errors }
}

/**
 * Parse a CSV line considering quotes
 */
function parseCSVLine(line: string): string[] {
  const result = []
  let inQuotes = false
  let currentValue = ''
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      // Check if this is an escaped quote (double quote inside quoted field)
      if (inQuotes && line[i + 1] === '"') {
        currentValue += '"'
        i++ // Skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(currentValue)
      currentValue = ''
    } else {
      // Add character to current field
      currentValue += char
    }
  }
  
  // Add the last field
  result.push(currentValue)
  
  return result
}

/**
 * 验证支付记录的账单周期是否与订阅的账单周期匹配
 * @param billingPeriodStart - 账单周期开始日期
 * @param billingPeriodEnd - 账单周期结束日期
 * @param subscriptionBillingCycle - 订阅的账单周期
 * @returns 是否匹配
 */
export function validateBillingCycle(
  billingPeriodStart: string,
  billingPeriodEnd: string,
  subscriptionBillingCycle: BillingCycle
): boolean {
  const startDate = new Date(billingPeriodStart)
  const endDate = new Date(billingPeriodEnd)
  
  // 计算实际的账单周期天数
  const actualDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  // 根据订阅的账单周期确定期望的天数范围
  let expectedDaysRange: { min: number; max: number }
  
  switch (subscriptionBillingCycle) {
    case 'monthly':
      // 月度账单：28-31天
      expectedDaysRange = { min: 28, max: 31 }
      break
    case 'quarterly':
      // 季度账单：89-92天（3个月）
      expectedDaysRange = { min: 89, max: 92 }
      break
    case 'yearly':
      // 年度账单：365-366天
      expectedDaysRange = { min: 365, max: 366 }
      break
    default:
      return false
  }
  
  return actualDays >= expectedDaysRange.min && actualDays <= expectedDaysRange.max
}

/**
 * 支付记录更新结果类型
 */
export interface PaymentUpdateResult {
  shouldUpdate: boolean
  reason: string
  isHistoricalRecord: boolean
}

/**
 * 检查支付记录是否应该更新订阅的 last_billing_date，并返回详细的原因说明
 * @param paymentDate - 支付日期
 * @param paymentStatus - 支付状态
 * @param billingPeriodStart - 账单周期开始日期
 * @param billingPeriodEnd - 账单周期结束日期
 * @param currentLastBillingDate - 当前的 last_billing_date
 * @param subscriptionBillingCycle - 订阅的账单周期
 * @returns 更新结果和详细原因
 */
export function shouldUpdateLastBillingDateWithReason(
  paymentDate: string,
  paymentStatus: string,
  billingPeriodStart: string,
  billingPeriodEnd: string,
  currentLastBillingDate: string | null,
  subscriptionBillingCycle: BillingCycle
): PaymentUpdateResult {
  const paymentDateTime = new Date(paymentDate)
  const billingPeriodStartDate = new Date(billingPeriodStart)
  const now = new Date()
  
  // 1. 只有成功的支付才能更新 last_billing_date
  if (paymentStatus !== 'success') {
    return {
      shouldUpdate: false,
      reason: 'Only successful payment records will update the last billing date',
      isHistoricalRecord: false
    }
  }
  
  // 2. 支付日期不能是未来日期
  if (paymentDateTime > now) {
    return {
      shouldUpdate: false,
      reason: 'Future payment records will not update the last billing date',
      isHistoricalRecord: false
    }
  }
  
  // 3. 计费周期开始日期必须晚于当前的 last_billing_date
  if (currentLastBillingDate) {
    const currentLastBillingDateTime = new Date(currentLastBillingDate)
    if (billingPeriodStartDate <= currentLastBillingDateTime) {
      return {
        shouldUpdate: false,
        reason: 'This payment record billing period is earlier than the current last billing date, and will be added as a historical record',
        isHistoricalRecord: true
      }
    }
  }
  
  // 4. 验证账单周期是否匹配
  if (!validateBillingCycle(billingPeriodStart, billingPeriodEnd, subscriptionBillingCycle)) {
    return {
      shouldUpdate: false,
      reason: 'The billing cycle of this payment record does not match the subscription billing cycle. Please check the billing cycle dates.',
      isHistoricalRecord: false
    }
  }
  
  return {
    shouldUpdate: true,
    reason: 'This payment record has been successfully added, and the subscription last billing date has been updated to the billing period start date.',
    isHistoricalRecord: false
  }
}

/**
 * 检查支付记录是否应该更新订阅的 last_billing_date
 * @param paymentDate - 支付日期
 * @param paymentStatus - 支付状态
 * @param billingPeriodStart - 账单周期开始日期
 * @param billingPeriodEnd - 账单周期结束日期
 * @param currentLastBillingDate - 当前的 last_billing_date
 * @param subscriptionBillingCycle - 订阅的账单周期
 * @returns 是否应该更新 last_billing_date
 */
export function shouldUpdateLastBillingDate(
  paymentDate: string,
  paymentStatus: string,
  billingPeriodStart: string,
  billingPeriodEnd: string,
  currentLastBillingDate: string | null,
  subscriptionBillingCycle: BillingCycle
): boolean {
  const result = shouldUpdateLastBillingDateWithReason(
    paymentDate,
    paymentStatus,
    billingPeriodStart,
    billingPeriodEnd,
    currentLastBillingDate,
    subscriptionBillingCycle
  )
  return result.shouldUpdate
}