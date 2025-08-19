/**
 * 货币系统中央配置
 * 统一管理基础货币设置，避免硬编码分散在各个文件中
 */
import { useSettingsStore } from '@/store/settingsStore'
// 支持的货币类型
export type CurrencyType = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CNY';

// 所有支持的货币列表（固定不变）
const ALL_SUPPORTED_CURRENCIES: CurrencyType[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];

// 基础货币配置 - 修改这里就能改变整个系统的基础货币
export const BASE_CURRENCY: CurrencyType = 'CNY';

// 支持的货币列表（基础货币在前，其他按字母排序）
export const SUPPORTED_CURRENCIES: CurrencyType[] = [
  BASE_CURRENCY,
  ...ALL_SUPPORTED_CURRENCIES.filter(currency => currency !== BASE_CURRENCY).sort()
];

// 货币信息映射（固定不变）
export const CURRENCY_INFO: Record<CurrencyType, { name: string; symbol: string }> = {
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  JPY: { name: 'Japanese Yen', symbol: '¥' }
};

// 基础汇率配置 - 根据基础货币动态生成
const BASE_RATES: Record<CurrencyType, Record<CurrencyType, number>> = {
  CNY: {
    CNY: 1,
    USD: 0.1538,
    EUR: 0.1308,
    GBP: 0.1154,
    CAD: 0.1923,
    AUD: 0.2077,
    JPY: 16.9231
  },
  USD: {
    USD: 1,
    CNY: 6.5000,
    EUR: 0.8500,
    GBP: 0.7500,
    CAD: 1.2500,
    AUD: 1.3500,
    JPY: 110.0000
  },
  EUR: {
    EUR: 1,
    USD: 1.1765,
    CNY: 7.6471,
    GBP: 0.8824,
    CAD: 1.4706,
    AUD: 1.5882,
    JPY: 129.4118
  },
  GBP: {
    GBP: 1,
    USD: 1.3333,
    CNY: 8.6667,
    EUR: 1.1333,
    CAD: 1.6667,
    AUD: 1.8000,
    JPY: 146.6667
  },
  CAD: {
    CAD: 1,
    USD: 0.8000,
    CNY: 5.2000,
    EUR: 0.6800,
    GBP: 0.6000,
    AUD: 1.0800,
    JPY: 88.0000
  },
  AUD: {
    AUD: 1,
    USD: 0.7407,
    CNY: 4.8148,
    EUR: 0.6296,
    GBP: 0.5556,
    CAD: 0.9259,
    JPY: 81.4815
  },
  JPY: {
    JPY: 1,
    USD: 0.0091,
    CNY: 0.0591,
    EUR: 0.0077,
    GBP: 0.0068,
    CAD: 0.0114,
    AUD: 0.0123
  }
};

/**
 * 生成完整的双向汇率映射
 * 支持任意货币对之间的转换，避免 convertCurrency 函数中的汇率缺失问题
 */
function generateCompleteExchangeRates(): Record<CurrencyType, number> {
  const baseRates = BASE_RATES[BASE_CURRENCY];
  const completeRates: Record<string, number> = {};
  
  // 添加所有支持的货币汇率
  SUPPORTED_CURRENCIES.forEach(currency => {
    if (baseRates[currency] !== undefined) {
      completeRates[currency] = baseRates[currency];
    } else {
      // 如果基础汇率中没有该货币，设置为1（避免undefined）
      console.warn(`Missing base rate for ${currency}, defaulting to 1`);
      completeRates[currency] = 1;
    }
  });
  
  return completeRates as Record<CurrencyType, number>;
}

// 默认汇率数据 - 完整的双向汇率映射，支持任意货币对转换
export const DEFAULT_EXCHANGE_RATES: Record<CurrencyType, number> = generateCompleteExchangeRates();

// 工具函数
export const isBaseCurrency = (currency: string): boolean => currency === BASE_CURRENCY;
export const getBaseCurrency = (): CurrencyType => {
  try {
    return useSettingsStore.getState().currency || BASE_CURRENCY;
  } catch (e) {
    // 在单元测试或初始化阶段，store 可能未初始化，返回默认基础货币
    return BASE_CURRENCY;
  }
};
export const getCurrencySymbol = (currency: CurrencyType): string => CURRENCY_INFO[currency]?.symbol || currency;
export const getCurrencyName = (currency: CurrencyType): string => CURRENCY_INFO[currency]?.name || currency;
