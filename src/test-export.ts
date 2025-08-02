// 测试导出功能的核心逻辑
import { dataExportService } from './services/dataExportService'

// 模拟测试数据
const mockSubscriptions = [
  {
    id: '1',
    name: 'Netflix',
    plan: 'Premium',
    billingCycle: 'monthly' as const,
    nextBillingDate: '2024-02-01',
    lastBillingDate: '2024-01-01',
    amount: 15.99,
    currency: 'USD',
    paymentMethodId: '1',
    startDate: '2023-01-01',
    status: 'active' as const,
    categoryId: '1',
    renewalType: 'auto' as const,
    notes: 'Premium subscription',
    website: 'https://netflix.com',
    category: { id: '1', value: 'entertainment', label: 'Entertainment' },
    paymentMethod: { id: '1', value: 'credit_card', label: 'Credit Card' }
  }
]

// 测试CSV转换
console.log('Testing CSV conversion...')
const csvContent = dataExportService['convertSubscriptionsToCSV'](mockSubscriptions)
console.log('CSV Output:')
console.log(csvContent)

// 测试JSON导出数据结构
console.log('\nTesting JSON structure...')
const exportData = {
  subscriptions: mockSubscriptions,
  paymentHistory: [],
  categories: [{ id: '1', value: 'entertainment', label: 'Entertainment', isDefault: false }],
  paymentMethods: [{ id: '1', value: 'credit_card', label: 'Credit Card', isDefault: true }],
  userSettings: { theme: 'light', currency: 'USD' },
  exportInfo: {
    exportDate: new Date().toISOString(),
    userId: 'test-user-id',
    version: '1.0.0',
    totalRecords: 1
  }
}

console.log('JSON Export Structure:')
console.log(JSON.stringify(exportData, null, 2))

console.log('\nExport functionality test completed successfully!')