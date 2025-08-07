import { CurrencyCode } from '@/types';

// Currency configuration
export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  CNY: 'Chinese Yuan',
  JPY: 'Japanese Yen',
  KRW: 'South Korean Won',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  INR: 'Indian Rupee',
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  JPY: '¥',
  KRW: '₩',
  CAD: 'C$',
  AUD: 'A$',
  INR: '₹',
};

// Chart colors
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
  'hsl(var(--chart-9))',
  'hsl(var(--chart-10))',
];

// Default values
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';
export const DEFAULT_REMINDER_DAYS = 7;
export const DEFAULT_PAGE_SIZE = 20;

// Status options
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

// Billing cycles
export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

// View modes
export const VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list',
} as const;

// Duplicate payment detection configuration
export const DUPLICATE_PAYMENT_CONFIG = {
  TIME_THRESHOLD_MINUTES: 5, // 短时间间隔阈值（分钟）
  AMOUNT_SIMILARITY_THRESHOLD: 0.95, // 金额相似度阈值
  ENABLE_STRICT_MODE: true, // 严格模式开关
  ALLOW_FORCE_ADD: true // 允许强制添加
} as const;