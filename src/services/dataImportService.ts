import { supabase } from '@/lib/supabase'
import { supabaseSubscriptionService } from './supabaseSubscriptionService'
import { supabasePaymentHistoryService } from './supabasePaymentHistoryService'
import { supabaseCategoriesService } from './supabaseCategoriesService'
import { supabasePaymentMethodsService } from './supabasePaymentMethodsService'
import { parseCSVToSubscriptions } from '@/lib/subscription-utils'
import { SubscriptionImportData } from '@/components/imports/types'

// 导入进度回调类型
export type ImportProgressCallback = (progress: number, message: string) => void

// 导入结果类型
export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
  duplicates: string[]
  details: {
    subscriptions: number
    paymentHistory: number
    categories: number
    paymentMethods: number
  }
}

// 重复检测选项
export interface DuplicateDetectionOptions {
  checkByName: boolean
  checkByNameAndAmount: boolean
  checkByWebsite: boolean
  skipDuplicates: boolean // true: 跳过重复项, false: 更新重复项
}

// 导入选项
export interface ImportOptions {
  duplicateDetection: DuplicateDetectionOptions
  validateData: boolean
  createMissingCategories: boolean
  createMissingPaymentMethods: boolean
  onProgress?: ImportProgressCallback
}

// 默认导入选项
const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  duplicateDetection: {
    checkByName: true,
    checkByNameAndAmount: false,
    checkByWebsite: false,
    skipDuplicates: true
  },
  validateData: true,
  createMissingCategories: true,
  createMissingPaymentMethods: true
}

/**
 * 数据导入服务
 * 提供增强的数据导入功能，支持多租户、重复检测、数据验证等
 */
export class DataImportService {
  /**
   * 验证用户权限
   */
  private async validateUserPermission(): Promise<string> {
    const { UserCacheService } = await import('./userCacheService');
    const user = await UserCacheService.getCurrentUser();
    const error = null;
    
    if (error || !user) {
      throw new Error('用户未登录，无法导入数据')
    }
    
    return user.id
  }

  /**
   * 验证订阅数据
   */
  private validateSubscriptionData(subscription: SubscriptionImportData): string[] {
    const errors: string[] = []
    
    // 必填字段验证
    if (!subscription.name?.trim()) {
      errors.push('订阅名称不能为空')
    }
    
    if (!subscription.amount || subscription.amount <= 0) {
      errors.push('订阅金额必须大于0')
    }
    
    if (!subscription.currency?.trim()) {
      errors.push('货币类型不能为空')
    }
    
    if (!subscription.billingCycle) {
      errors.push('计费周期不能为空')
    } else if (!['monthly', 'yearly', 'quarterly'].includes(subscription.billingCycle)) {
      errors.push('计费周期必须是 monthly、yearly 或 quarterly')
    }
    
    if (!subscription.nextBillingDate) {
      errors.push('下次计费日期不能为空')
    } else {
      // 验证日期格式
      const date = new Date(subscription.nextBillingDate)
      if (isNaN(date.getTime())) {
        errors.push('下次计费日期格式无效')
      }
    }
    
    if (!subscription.status) {
      errors.push('订阅状态不能为空')
    } else if (!['active', 'trial', 'cancelled'].includes(subscription.status)) {
      errors.push('订阅状态必须是 active、trial 或 cancelled')
    }
    
    // 可选字段验证
    if (subscription.renewalType && !['auto', 'manual'].includes(subscription.renewalType)) {
      errors.push('续费类型必须是 auto 或 manual')
    }
    
    if (subscription.website && subscription.website.trim()) {
      try {
        new URL(subscription.website)
      } catch {
        errors.push('网站URL格式无效')
      }
    }
    
    return errors
  }

  /**
   * 检测重复订阅
   */
  private async detectDuplicates(
    subscriptions: SubscriptionImportData[],
    options: DuplicateDetectionOptions
  ): Promise<{ duplicates: string[], uniqueSubscriptions: SubscriptionImportData[] }> {
    const existingSubscriptions = await supabaseSubscriptionService.getAllSubscriptions()
    const duplicates: string[] = []
    const uniqueSubscriptions: SubscriptionImportData[] = []
    
    for (const subscription of subscriptions) {
      let isDuplicate = false
      let duplicateReason = ''
      
      for (const existing of existingSubscriptions) {
        // 按名称检查
        if (options.checkByName && 
            subscription.name.toLowerCase().trim() === existing.name.toLowerCase().trim()) {
          isDuplicate = true
          duplicateReason = `名称重复: ${subscription.name}`
          break
        }
        
        // 按名称和金额检查
        if (options.checkByNameAndAmount &&
            subscription.name.toLowerCase().trim() === existing.name.toLowerCase().trim() &&
            Math.abs(subscription.amount - existing.amount) < 0.01) {
          isDuplicate = true
          duplicateReason = `名称和金额重复: ${subscription.name} (${subscription.amount})`
          break
        }
        
        // 按网站检查
        if (options.checkByWebsite &&
            subscription.website && existing.website &&
            subscription.website.toLowerCase().trim() === existing.website.toLowerCase().trim()) {
          isDuplicate = true
          duplicateReason = `网站重复: ${subscription.website}`
          break
        }
      }
      
      if (isDuplicate) {
        duplicates.push(duplicateReason)
        if (!options.skipDuplicates) {
          // 如果不跳过重复项，仍然添加到导入列表中（后续会更新）
          uniqueSubscriptions.push(subscription)
        }
      } else {
        uniqueSubscriptions.push(subscription)
      }
    }
    
    return { duplicates, uniqueSubscriptions }
  }

  /**
   * 确保分类存在
   */
  private async ensureCategoriesExist(subscriptions: SubscriptionImportData[]): Promise<Map<string, string>> {
    const categoryMap = new Map<string, string>() // value -> id
    const existingCategories = await supabaseCategoriesService.getAllCategories()
    
    // 建立现有分类的映射
    for (const category of existingCategories) {
      categoryMap.set(category.value, category.id)
    }
    
    // 检查需要创建的新分类
    const newCategoryValues = new Set<string>()
    for (const subscription of subscriptions) {
      if (subscription.category?.value && !categoryMap.has(subscription.category.value)) {
        newCategoryValues.add(subscription.category.value)
      }
    }
    
    // 创建新分类
    for (const value of newCategoryValues) {
      try {
        const newCategory = await supabaseCategoriesService.createCategory({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1) // 首字母大写
        })
        categoryMap.set(value, newCategory.id)
      } catch (error) {
        console.warn(`Failed to create category ${value}:`, error)
        // 使用默认分类
        const defaultCategory = existingCategories.find(c => c.value === 'other')
        if (defaultCategory) {
          categoryMap.set(value, defaultCategory.id)
        }
      }
    }
    
    return categoryMap
  }

  /**
   * 确保支付方式存在
   */
  private async ensurePaymentMethodsExist(subscriptions: SubscriptionImportData[]): Promise<Map<string, string>> {
    const paymentMethodMap = new Map<string, string>() // value -> id
    const existingPaymentMethods = await supabasePaymentMethodsService.getAllPaymentMethods()
    
    // 建立现有支付方式的映射
    for (const method of existingPaymentMethods) {
      paymentMethodMap.set(method.value, method.id)
    }
    
    // 检查需要创建的新支付方式
    const newPaymentMethodValues = new Set<string>()
    for (const subscription of subscriptions) {
      if (subscription.paymentMethod?.value && !paymentMethodMap.has(subscription.paymentMethod.value)) {
        newPaymentMethodValues.add(subscription.paymentMethod.value)
      }
    }
    
    // 创建新支付方式
    for (const value of newPaymentMethodValues) {
      try {
        const newPaymentMethod = await supabasePaymentMethodsService.createPaymentMethod({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1) // 首字母大写
        })
        paymentMethodMap.set(value, newPaymentMethod.id)
      } catch (error) {
        console.warn(`Failed to create payment method ${value}:`, error)
        // 使用默认支付方式
        const defaultMethod = existingPaymentMethods.find(m => m.value === 'credit_card')
        if (defaultMethod) {
          paymentMethodMap.set(value, defaultMethod.id)
        }
      }
    }
    
    return paymentMethodMap
  }

  /**
   * 处理订阅数据的ID映射
   */
  private mapSubscriptionIds(
    subscriptions: SubscriptionImportData[],
    categoryMap: Map<string, string>,
    paymentMethodMap: Map<string, string>
  ): SubscriptionImportData[] {
    return subscriptions.map(subscription => {
      // 映射分类ID
      if (subscription.category?.value) {
        const categoryId = categoryMap.get(subscription.category.value)
        if (categoryId) {
          subscription.categoryId = categoryId
        }
      }
      
      // 映射支付方式ID
      if (subscription.paymentMethod?.value) {
        const paymentMethodId = paymentMethodMap.get(subscription.paymentMethod.value)
        if (paymentMethodId) {
          subscription.paymentMethodId = paymentMethodId
        }
      }
      
      // 设置默认值
      if (!subscription.categoryId) {
        const defaultCategory = Array.from(categoryMap.entries()).find(([value]) => value === 'other')
        subscription.categoryId = defaultCategory?.[1] || '1'
      }
      
      if (!subscription.paymentMethodId) {
        const defaultPaymentMethod = Array.from(paymentMethodMap.entries()).find(([value]) => value === 'credit_card')
        subscription.paymentMethodId = defaultPaymentMethod?.[1] || '1'
      }
      
      // 设置默认的续费类型
      if (!subscription.renewalType) {
        subscription.renewalType = 'manual'
      }
      
      return subscription
    })
  }

  /**
   * 解析CSV文件内容
   */
  async parseCSVFile(content: string): Promise<{
    subscriptions: SubscriptionImportData[]
    errors: string[]
  }> {
    try {
      const result = parseCSVToSubscriptions(content)
      return {
        subscriptions: result.subscriptions,
        errors: result.errors
      }
    } catch (error: any) {
      return {
        subscriptions: [],
        errors: [`CSV解析失败: ${error.message}`]
      }
    }
  }

  /**
   * 解析JSON文件内容
   */
  async parseJSONFile(content: string): Promise<{
    subscriptions: SubscriptionImportData[]
    errors: string[]
  }> {
    try {
      const data = JSON.parse(content)
      const errors: string[] = []
      let subscriptions: SubscriptionImportData[] = []
      
      // 检查不同的JSON格式
      if (data.subscriptions && Array.isArray(data.subscriptions)) {
        // 导出的完整格式
        subscriptions = data.subscriptions
      } else if (data.state?.subscriptions && Array.isArray(data.state.subscriptions)) {
        // Zustand状态格式
        subscriptions = data.state.subscriptions
      } else if (Array.isArray(data)) {
        // 直接的订阅数组
        subscriptions = data
      } else {
        errors.push('无法识别的JSON格式，请确保包含订阅数据')
        return { subscriptions: [], errors }
      }
      
      // 验证和转换数据格式
      const validSubscriptions: SubscriptionImportData[] = []
      subscriptions.forEach((sub: any, index: number) => {
        try {
          const subscription: SubscriptionImportData = {
            name: sub.name || `未知订阅 ${index + 1}`,
            plan: sub.plan || 'Basic',
            billingCycle: sub.billingCycle || 'monthly',
            nextBillingDate: sub.nextBillingDate || new Date().toISOString().split('T')[0],
            amount: Number(sub.amount) || 0,
            currency: sub.currency || 'USD',
            paymentMethodId: sub.paymentMethodId || '1',
            startDate: sub.startDate || new Date().toISOString().split('T')[0],
            status: sub.status || 'active',
            categoryId: sub.categoryId || '1',
            renewalType: sub.renewalType || 'manual',
            notes: sub.notes || '',
            website: sub.website || '',
            // 保留关联数据用于ID映射
            category: sub.category,
            paymentMethod: sub.paymentMethod
          }
          validSubscriptions.push(subscription)
        } catch (error: any) {
          errors.push(`第${index + 1}条记录格式错误: ${error.message}`)
        }
      })
      
      return { subscriptions: validSubscriptions, errors }
    } catch (error: any) {
      return {
        subscriptions: [],
        errors: [`JSON解析失败: ${error.message}`]
      }
    }
  }

  /**
   * 导入订阅数据
   */
  async importSubscriptions(
    subscriptions: SubscriptionImportData[],
    options: Partial<ImportOptions> = {}
  ): Promise<ImportResult> {
    const userId = await this.validateUserPermission()
    const finalOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }
    
    let progress = 0
    const updateProgress = (step: number, message: string) => {
      progress = Math.round((step / 10) * 100)
      finalOptions.onProgress?.(progress, message)
    }
    
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      duplicates: [],
      details: {
        subscriptions: 0,
        paymentHistory: 0,
        categories: 0,
        paymentMethods: 0
      }
    }
    
    try {
      updateProgress(1, '验证导入数据...')
      
      // 数据验证
      if (finalOptions.validateData) {
        const validationErrors: string[] = []
        subscriptions.forEach((subscription, index) => {
          const errors = this.validateSubscriptionData(subscription)
          if (errors.length > 0) {
            validationErrors.push(`第${index + 1}条记录: ${errors.join(', ')}`)
          }
        })
        
        if (validationErrors.length > 0) {
          result.errors = validationErrors
          return result
        }
      }
      
      updateProgress(2, '检测重复数据...')
      
      // 重复检测
      const { duplicates, uniqueSubscriptions } = await this.detectDuplicates(
        subscriptions,
        finalOptions.duplicateDetection
      )
      result.duplicates = duplicates
      result.skipped = duplicates.length
      
      if (uniqueSubscriptions.length === 0) {
        result.success = true
        return result
      }
      
      updateProgress(3, '处理分类数据...')
      
      // 确保分类存在
      let categoryMap = new Map<string, string>()
      if (finalOptions.createMissingCategories) {
        categoryMap = await this.ensureCategoriesExist(uniqueSubscriptions)
      }
      
      updateProgress(4, '处理支付方式...')
      
      // 确保支付方式存在
      let paymentMethodMap = new Map<string, string>()
      if (finalOptions.createMissingPaymentMethods) {
        paymentMethodMap = await this.ensurePaymentMethodsExist(uniqueSubscriptions)
      }
      
      updateProgress(5, '映射数据关系...')
      
      // 处理ID映射
      const mappedSubscriptions = this.mapSubscriptionIds(
        uniqueSubscriptions,
        categoryMap,
        paymentMethodMap
      )
      
      updateProgress(6, '导入订阅数据...')
      
      // 批量导入订阅
      const importedSubscriptions = await supabaseSubscriptionService.bulkCreateSubscriptions(
        mappedSubscriptions
      )
      
      result.imported = importedSubscriptions.length
      result.details.subscriptions = importedSubscriptions.length
      result.success = true
      
      updateProgress(10, '导入完成')
      
    } catch (error: any) {
      console.error('Import failed:', error)
      result.errors.push(`导入失败: ${error.message}`)
    }
    
    return result
  }

  /**
   * 从文件导入数据
   */
  async importFromFile(
    file: File,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportResult> {
    const finalOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }
    
    try {
      finalOptions.onProgress?.(10, '读取文件内容...')
      
      const content = await this.readFileContent(file)
      
      finalOptions.onProgress?.(20, '解析文件数据...')
      
      let parseResult: { subscriptions: SubscriptionImportData[], errors: string[] }
      
      if (file.name.endsWith('.csv')) {
        parseResult = await this.parseCSVFile(content)
      } else if (file.name.endsWith('.json')) {
        parseResult = await this.parseJSONFile(content)
      } else {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: ['不支持的文件格式，请上传CSV或JSON文件'],
          duplicates: [],
          details: { subscriptions: 0, paymentHistory: 0, categories: 0, paymentMethods: 0 }
        }
      }
      
      if (parseResult.errors.length > 0) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          errors: parseResult.errors,
          duplicates: [],
          details: { subscriptions: 0, paymentHistory: 0, categories: 0, paymentMethods: 0 }
        }
      }
      
      // 调整进度回调，为导入过程预留80%的进度
      const adjustedOptions = {
        ...finalOptions,
        onProgress: (progress: number, message: string) => {
          const adjustedProgress = 20 + (progress * 0.8)
          finalOptions.onProgress?.(adjustedProgress, message)
        }
      }
      
      return await this.importSubscriptions(parseResult.subscriptions, adjustedOptions)
      
    } catch (error: any) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [`文件处理失败: ${error.message}`],
        duplicates: [],
        details: { subscriptions: 0, paymentHistory: 0, categories: 0, paymentMethods: 0 }
      }
    }
  }

  /**
   * 读取文件内容
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * 获取导入预览信息
   */
  async getImportPreview(file: File): Promise<{
    fileName: string
    fileSize: string
    estimatedRecords: number
    format: string
    errors: string[]
  }> {
    try {
      const content = await this.readFileContent(file)
      let estimatedRecords = 0
      const errors: string[] = []
      
      if (file.name.endsWith('.csv')) {
        const lines = content.split('\n').filter(line => line.trim())
        estimatedRecords = Math.max(0, lines.length - 1) // 减去标题行
      } else if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content)
          if (data.subscriptions && Array.isArray(data.subscriptions)) {
            estimatedRecords = data.subscriptions.length
          } else if (data.state?.subscriptions && Array.isArray(data.state.subscriptions)) {
            estimatedRecords = data.state.subscriptions.length
          } else if (Array.isArray(data)) {
            estimatedRecords = data.length
          }
        } catch {
          errors.push('JSON格式无效')
        }
      } else {
        errors.push('不支持的文件格式')
      }
      
      return {
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        estimatedRecords,
        format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
        errors
      }
    } catch (error: any) {
      return {
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        estimatedRecords: 0,
        format: 'Unknown',
        errors: [`文件预览失败: ${error.message}`]
      }
    }
  }
}

// 导出单例实例
export const dataImportService = new DataImportService()