import { useSettingsStore } from "@/store/settingsStore"
import { CURRENCY_INFO } from "@/config/currency"

// Currency symbols for supported currencies only
// Uses central configuration to ensure consistency
export const currencySymbols: Record<string, string> = Object.fromEntries(
  Object.entries(CURRENCY_INFO).map(([code, info]) => [code, info.symbol])
)

/**
 * Format amount in the specified currency
 */
export function formatCurrencyAmount(
  amount: number, 
  currency: string = 'CNY',
  showSymbol: boolean = true
): string {
  // Ensure amount is a valid number
  if (typeof amount !== 'number' || isNaN(amount)) {
    amount = 0
  }
  
  // Ensure currency is a valid string
  if (typeof currency !== 'string' || !currency) {
    currency = 'CNY'
  }
  
  // Get the currency symbol, or use currency code if not found
  const symbol = showSymbol ? (currencySymbols[currency] || currency) : ''
  
  // Format the number based on currency
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  })
  
  const formattedAmount = formatter.format(amount)
  
  // Return formatted amount with symbol
  return symbol + ' ' + formattedAmount
}

/**
 * Convert an amount from one currency to another
 * @param amount 金额
 * @param fromCurrency 源货币
 * @param toCurrency 目标货币
 * @param customRates 可选的自定义汇率，如果不提供则从store获取
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRates?: Record<string, number>
): number {
  // Ensure amount is a valid number
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.warn(`Invalid amount for currency conversion: ${amount}`)
    return 0
  }
  
  // Ensure currencies are valid strings
  if (typeof fromCurrency !== 'string' || !fromCurrency) {
    console.warn(`Invalid fromCurrency: ${fromCurrency}`)
    fromCurrency = 'CNY'
  }
  
  if (typeof toCurrency !== 'string' || !toCurrency) {
    console.warn(`Invalid toCurrency: ${toCurrency}`)
    toCurrency = 'CNY'
  }
  
  // 获取汇率数据，优先使用自定义汇率，否则从store获取
  const exchangeRates = customRates || useSettingsStore.getState().exchangeRates
  
  // If currencies are the same, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount
  }
  
  // Check if we have exchange rates for both currencies
  if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
    console.warn(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`)
    return amount // Return original amount if we can't convert
  }
  
  // Direct calculation using the ratio of the exchange rates
  // This is more accurate than converting to base currency and back
  const conversionRate = exchangeRates[toCurrency] / exchangeRates[fromCurrency]
  return amount * conversionRate
}

/**
 * Format amount in user's preferred currency, with optional original display
 */
export function formatWithUserCurrency(
  amount: number,
  originalCurrency: string,
): string {
  const { currency: userCurrency, showOriginalCurrency } = useSettingsStore.getState()
  
  // Convert to user's preferred currency
  const convertedAmount = convertCurrency(amount, originalCurrency, userCurrency)
  
  // Format the converted amount
  const formattedConverted = formatCurrencyAmount(convertedAmount, userCurrency)
  
  // If the currencies are the same or we don't want to show original, just return the converted
  if (originalCurrency === userCurrency ||  !showOriginalCurrency) {
    return formattedConverted
  }
  
  // Format the original amount
  const formattedOriginal = formatCurrencyAmount(amount, originalCurrency)
  
  // Return both the converted and original amounts
  return `${formattedConverted} (${formattedOriginal})`
}

export function formatCurrency(
  amount: number,
  originalCurrency: string,
  convertedAmount: number,
): string {
  const { currency: userCurrency, showOriginalCurrency } = useSettingsStore.getState()

  if (amount === convertedAmount) {
    return formatCurrencyAmount(amount, originalCurrency)
  }

  if (originalCurrency === userCurrency || !showOriginalCurrency) {
    return formatCurrencyAmount(convertedAmount, userCurrency)
  }
  return `${formatCurrencyAmount(convertedAmount, userCurrency)} (${formatCurrencyAmount(amount, originalCurrency)})`
}
