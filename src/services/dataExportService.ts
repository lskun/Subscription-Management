import { supabase } from '@/lib/supabase'
import { supabaseSubscriptionService } from './supabaseSubscriptionService'
import { supabasePaymentHistoryService } from './supabasePaymentHistoryService'
import { supabaseCategoriesService } from './supabaseCategoriesService'
import { supabasePaymentMethodsService } from './supabasePaymentMethodsService'
import { supabaseUserSettingsService } from './supabaseUserSettingsService'

// 导出数据类型
export interface ExportData {
  subscriptions: any[]
  paymentHistory: any[]
  categories: any[]
  paymentMethods: any[]
  userSettings: any
  exportInfo: {
    exportDate: string
    userId: string
    version: string
    totalRecords: number
  }
}

// 导出格式类型
export type ExportFormat = 'csv' | 'json'

// 导出进度回调类型
export type ProgressCallback = (progress: number, message: string) => void

// 导出选项
export interface ExportOptions {
  format: ExportFormat
  includePaymentHistory?: boolean
  includeCategories?: boolean
  includePaymentMethods?: boolean
  includeUserSettings?: boolean
  onProgress?: ProgressCallback
}

/**
 * 数据导出服务
 * 提供用户数据的安全导出功能，支持CSV和JSON格式
 */
export class DataExportService {
  /**
   * 验证用户权限
   */
  private async validateUserPermission(): Promise<string> {
    const { UserCacheService } = await import('./userCacheService');
    const user = await UserCacheService.getCurrentUser();
    const error = null;
    
    if (error || !user) {
      throw new Error('用户未登录，无法导出数据')
    }
    
    return user.id
  }

  /**
   * 获取用户的所有数据
   */
  private async getUserData(options: ExportOptions): Promise<ExportData> {
    const userId = await this.validateUserPermission()
    let progress = 0
    const totalSteps = 5 // 基础步骤数
    
    // 更新进度
    const updateProgress = (step: number, message: string) => {
      progress = Math.round((step / totalSteps) * 100)
      options.onProgress?.(progress, message)
    }

    updateProgress(1, '正在获取订阅数据...')
    
    // 获取订阅数据
    const subscriptions = await supabaseSubscriptionService.getAllSubscriptions()
    
    updateProgress(2, '正在获取支付历史...')
    
    // 获取支付历史（如果需要）
    let paymentHistory: any[] = []
    if (options.includePaymentHistory) {
      paymentHistory = await supabasePaymentHistoryService.getAllPaymentHistory()
    }
    
    updateProgress(3, '正在获取分类数据...')
    
    // 获取分类数据（如果需要）
    let categories: any[] = []
    if (options.includeCategories) {
      categories = await supabaseCategoriesService.getAllCategories()
    }
    
    updateProgress(4, '正在获取支付方式...')
    
    // 获取支付方式（如果需要）
    let paymentMethods: any[] = []
    if (options.includePaymentMethods) {
      paymentMethods = await supabasePaymentMethodsService.getAllPaymentMethods()
    }
    
    // 获取用户设置（如果需要）
    let userSettings: any = null
    if (options.includeUserSettings) {
      userSettings = await supabaseUserSettingsService.getUserSettings()
    }
    
    updateProgress(5, '正在整理导出数据...')
    
    const exportData: ExportData = {
      subscriptions,
      paymentHistory,
      categories,
      paymentMethods,
      userSettings,
      exportInfo: {
        exportDate: new Date().toISOString(),
        userId,
        version: '1.0.0',
        totalRecords: subscriptions.length + paymentHistory.length + categories.length + paymentMethods.length
      }
    }
    
    return exportData
  }

  /**
   * 将数据转换为CSV格式
   */
  private convertToCSV(data: ExportData): string {
    const csvSections: string[] = []
    
    // 导出订阅数据
    if (data.subscriptions.length > 0) {
      csvSections.push('# 订阅数据')
      csvSections.push(this.convertSubscriptionsToCSV(data.subscriptions))
      csvSections.push('')
    }
    
    // 导出支付历史
    if (data.paymentHistory.length > 0) {
      csvSections.push('# 支付历史')
      csvSections.push(this.convertPaymentHistoryToCSV(data.paymentHistory))
      csvSections.push('')
    }
    
    // 导出分类数据
    if (data.categories.length > 0) {
      csvSections.push('# 分类数据')
      csvSections.push(this.convertCategoriesToCSV(data.categories))
      csvSections.push('')
    }
    
    // 导出支付方式
    if (data.paymentMethods.length > 0) {
      csvSections.push('# 支付方式')
      csvSections.push(this.convertPaymentMethodsToCSV(data.paymentMethods))
      csvSections.push('')
    }
    
    // 添加导出信息
    csvSections.push('# 导出信息')
    csvSections.push(`导出日期,${data.exportInfo.exportDate}`)
    csvSections.push(`用户ID,${data.exportInfo.userId}`)
    csvSections.push(`版本,${data.exportInfo.version}`)
    csvSections.push(`总记录数,${data.exportInfo.totalRecords}`)
    
    return csvSections.join('\n')
  }

  /**
   * 将订阅数据转换为CSV
   */
  private convertSubscriptionsToCSV(subscriptions: any[]): string {
    const headers = [
      'ID', '名称', '计划', '计费周期', '下次计费日期', '上次计费日期',
      '金额', '货币', '支付方式', '开始日期', '状态', '分类',
      '续费类型', '备注', '网站'
    ].join(',')
    
    const rows = subscriptions.map(sub => [
      sub.id,
      `"${(sub.name || '').replace(/"/g, '""')}"`,
      `"${(sub.plan || '').replace(/"/g, '""')}"`,
      sub.billingCycle,
      sub.nextBillingDate,
      sub.lastBillingDate || '',
      sub.amount,
      sub.currency,
      `"${(sub.paymentMethod?.label || '').replace(/"/g, '""')}"`,
      sub.startDate,
      sub.status,
      `"${(sub.category?.label || '').replace(/"/g, '""')}"`,
      sub.renewalType,
      `"${(sub.notes || '').replace(/"/g, '""')}"`,
      `"${(sub.website || '').replace(/"/g, '""')}"`
    ].join(','))
    
    return [headers, ...rows].join('\n')
  }

  /**
   * 将支付历史转换为CSV
   */
  private convertPaymentHistoryToCSV(paymentHistory: any[]): string {
    const headers = [
      'ID', '订阅名称', '支付日期', '支付金额', '货币',
      '计费周期开始', '计费周期结束', '状态', '备注'
    ].join(',')
    
    const rows = paymentHistory.map(payment => [
      payment.id,
      `"${(payment.subscription?.name || '').replace(/"/g, '""')}"`,
      payment.paymentDate,
      payment.amountPaid,
      payment.currency,
      payment.billingPeriodStart,
      payment.billingPeriodEnd,
      payment.status,
      `"${(payment.notes || '').replace(/"/g, '""')}"`
    ].join(','))
    
    return [headers, ...rows].join('\n')
  }

  /**
   * 将分类数据转换为CSV
   */
  private convertCategoriesToCSV(categories: any[]): string {
    const headers = ['ID', '值', '标签', '是否默认'].join(',')
    
    const rows = categories.map(category => [
      category.id,
      category.value,
      `"${category.label.replace(/"/g, '""')}"`,
      category.isDefault ? '是' : '否'
    ].join(','))
    
    return [headers, ...rows].join('\n')
  }

  /**
   * 将支付方式转换为CSV
   */
  private convertPaymentMethodsToCSV(paymentMethods: any[]): string {
    const headers = ['ID', '值', '标签', '是否默认'].join(',')
    
    const rows = paymentMethods.map(method => [
      method.id,
      method.value,
      `"${method.label.replace(/"/g, '""')}"`,
      method.isDefault ? '是' : '否'
    ].join(','))
    
    return [headers, ...rows].join('\n')
  }

  /**
   * 下载文件
   */
  private downloadFile(content: string, filename: string, contentType: string): void {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 清理URL对象
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  /**
   * 导出用户数据
   */
  async exportUserData(options: ExportOptions): Promise<void> {
    try {
      // 获取用户数据
      const data = await this.getUserData(options)
      
      // 生成文件名
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `subscription-data-${timestamp}.${options.format}`
      
      if (options.format === 'csv') {
        // 导出CSV格式
        const csvContent = this.convertToCSV(data)
        this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8')
      } else {
        // 导出JSON格式
        const jsonContent = JSON.stringify(data, null, 2)
        this.downloadFile(jsonContent, filename, 'application/json;charset=utf-8')
      }
      
      options.onProgress?.(100, '导出完成')
      
    } catch (error: any) {
      console.error('Export failed:', error)
      throw new Error(`导出失败: ${error.message}`)
    }
  }

  /**
   * 导出订阅数据（兼容现有功能）
   */
  async exportSubscriptions(format: ExportFormat = 'csv'): Promise<void> {
    await this.exportUserData({
      format,
      includePaymentHistory: false,
      includeCategories: false,
      includePaymentMethods: false,
      includeUserSettings: false
    })
  }

  /**
   * 导出完整数据
   */
  async exportAllData(format: ExportFormat = 'json', onProgress?: ProgressCallback): Promise<void> {
    await this.exportUserData({
      format,
      includePaymentHistory: true,
      includeCategories: true,
      includePaymentMethods: true,
      includeUserSettings: true,
      onProgress
    })
  }

  /**
   * 获取导出数据预览（不下载文件）
   */
  async getExportPreview(): Promise<{
    subscriptionCount: number
    paymentHistoryCount: number
    categoryCount: number
    paymentMethodCount: number
    estimatedSize: string
  }> {
    const userId = await this.validateUserPermission()
    
    // 获取各类数据的数量
    const [subscriptions, paymentHistory, categories, paymentMethods] = await Promise.all([
      supabaseSubscriptionService.getAllSubscriptions(),
      supabasePaymentHistoryService.getAllPaymentHistory(),
      supabaseCategoriesService.getAllCategories(),
      supabasePaymentMethodsService.getAllPaymentMethods()
    ])
    
    // 估算文件大小（粗略计算）
    const totalRecords = subscriptions.length + paymentHistory.length + categories.length + paymentMethods.length
    const estimatedSizeKB = Math.max(1, Math.round(totalRecords * 0.5)) // 每条记录约0.5KB
    const estimatedSize = estimatedSizeKB < 1024 
      ? `${estimatedSizeKB} KB` 
      : `${Math.round(estimatedSizeKB / 1024 * 10) / 10} MB`
    
    return {
      subscriptionCount: subscriptions.length,
      paymentHistoryCount: paymentHistory.length,
      categoryCount: categories.length,
      paymentMethodCount: paymentMethods.length,
      estimatedSize
    }
  }
}

// 导出单例实例
export const dataExportService = new DataExportService()