import { supabase } from '@/lib/supabase'
import { supabaseSubscriptionService } from './supabaseSubscriptionService'
import { supabasePaymentHistoryService } from './supabasePaymentHistoryService'
import { supabaseCategoriesService } from './supabaseCategoriesService'
import { supabasePaymentMethodsService } from './supabasePaymentMethodsService'
import { parseCSVToSubscriptions } from '@/lib/subscription-utils'
import { SubscriptionImportData } from '@/components/imports/types'

// Import progress callback type
export type ImportProgressCallback = (progress: number, message: string) => void

// Import result type
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

// Duplicate detection options
export interface DuplicateDetectionOptions {
  checkByName: boolean
  checkByNameAndAmount: boolean
  checkByWebsite: boolean
  skipDuplicates: boolean // true: skip duplicates, false: update duplicates
}

// Import options
export interface ImportOptions {
  duplicateDetection: DuplicateDetectionOptions
  validateData: boolean
  createMissingCategories: boolean
  createMissingPaymentMethods: boolean
  onProgress?: ImportProgressCallback
}

// Default import options
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
 * Data import service
 * Provides enhanced data import functionality, supports multi-tenancy, duplicate detection, data validation, etc.
 */
export class DataImportService {
  /**
   * Validate user permission
   */
  private async validateUserPermission(): Promise<string> {
    const { useSettingsStore } = await import('@/store/settingsStore');
    const user = await useSettingsStore.getState().getCurrentUser();
    const error = null;
    
    if (error || !user) {
      throw new Error('User not logged in, cannot import data')
    }
    
    return user.id
  }

  /**
   * Validate subscription data
   */
  private validateSubscriptionData(subscription: SubscriptionImportData): string[] {
    const errors: string[] = []
    
    // Required field validation
    if (!subscription.name?.trim()) {
      errors.push('Subscription name cannot be empty')
    }
    
    if (!subscription.amount || subscription.amount <= 0) {
      errors.push('Subscription amount must be greater than 0')
    }
    
    if (!subscription.currency?.trim()) {
      errors.push('Currency type cannot be empty')
    }
    
    if (!subscription.billingCycle) {
      errors.push('Billing cycle cannot be empty')
    } else if (!['monthly', 'yearly', 'quarterly'].includes(subscription.billingCycle)) {
      errors.push('Billing cycle must be monthly, yearly, or quarterly')
    }
    
    if (!subscription.nextBillingDate) {
      errors.push('Next billing date cannot be empty')
    } else {
      // Validate date format
      const date = new Date(subscription.nextBillingDate)
      if (isNaN(date.getTime())) {
        errors.push('Next billing date format is invalid')
      }
    }
    
    if (!subscription.status) {
      errors.push('Subscription status cannot be empty')
    } else if (!['active', 'trial', 'cancelled'].includes(subscription.status)) {
      errors.push('Subscription status must be active, trial, or cancelled')
    }
    
    // Optional field validation
    if (subscription.renewalType && !['auto', 'manual'].includes(subscription.renewalType)) {
      errors.push('Renewal type must be auto or manual')
    }
    
    if (subscription.website && subscription.website.trim()) {
      try {
        new URL(subscription.website)
      } catch {
        errors.push('Website URL format is invalid')
      }
    }
    
    return errors
  }

  /**
   * Detect duplicate subscriptions
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
        // Check by name
        if (options.checkByName && 
            subscription.name.toLowerCase().trim() === existing.name.toLowerCase().trim()) {
          isDuplicate = true
          duplicateReason = `Name duplicate: ${subscription.name}`
          break
        }
        
        // Check by name and amount
        if (options.checkByNameAndAmount &&
            subscription.name.toLowerCase().trim() === existing.name.toLowerCase().trim() &&
            Math.abs(subscription.amount - existing.amount) < 0.01) {
          isDuplicate = true
          duplicateReason = `Name and amount duplicate: ${subscription.name} (${subscription.amount})`
          break
        }
        
        // Check by website
        if (options.checkByWebsite &&
            subscription.website && existing.website &&
            subscription.website.toLowerCase().trim() === existing.website.toLowerCase().trim()) {
          isDuplicate = true
          duplicateReason = `Website duplicate: ${subscription.website}`
          break
        }
      }
      
      if (isDuplicate) {
        duplicates.push(duplicateReason)
        if (!options.skipDuplicates) {
          // If not skipping duplicates, still add to import list (will be updated later)
          uniqueSubscriptions.push(subscription)
        }
      } else {
        uniqueSubscriptions.push(subscription)
      }
    }
    
    return { duplicates, uniqueSubscriptions }
  }

  /**
   * Ensure categories exist
   */
  private async ensureCategoriesExist(subscriptions: SubscriptionImportData[]): Promise<Map<string, string>> {
    const categoryMap = new Map<string, string>() // value -> id
    const existingCategories = await supabaseCategoriesService.getAllCategories()
    
    // Build mapping of existing categories
    for (const category of existingCategories) {
      categoryMap.set(category.value, category.id)
    }
    
    // Check for new categories that need to be created
    const newCategoryValues = new Set<string>()
    for (const subscription of subscriptions) {
      if (subscription.category?.value && !categoryMap.has(subscription.category.value)) {
        newCategoryValues.add(subscription.category.value)
      }
    }
    
    // Create new categories
    for (const value of newCategoryValues) {
      try {
        const newCategory = await supabaseCategoriesService.createCategory({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1) // Capitalize first letter
        })
        categoryMap.set(value, newCategory.id)
      } catch (error) {
        console.warn(`Failed to create category ${value}:`, error)
        // Use default category
        const defaultCategory = existingCategories.find(c => c.value === 'other')
        if (defaultCategory) {
          categoryMap.set(value, defaultCategory.id)
        }
      }
    }
    
    return categoryMap
  }

  /**
   * Ensure payment methods exist
   */
  private async ensurePaymentMethodsExist(subscriptions: SubscriptionImportData[]): Promise<Map<string, string>> {
    const paymentMethodMap = new Map<string, string>() // value -> id
    const existingPaymentMethods = await supabasePaymentMethodsService.getAllPaymentMethods()
    
    // Build mapping of existing payment methods
    for (const method of existingPaymentMethods) {
      paymentMethodMap.set(method.value, method.id)
    }
    
    // Check for new payment methods that need to be created
    const newPaymentMethodValues = new Set<string>()
    for (const subscription of subscriptions) {
      if (subscription.paymentMethod?.value && !paymentMethodMap.has(subscription.paymentMethod.value)) {
        newPaymentMethodValues.add(subscription.paymentMethod.value)
      }
    }
    
    // Create new payment methods
    for (const value of newPaymentMethodValues) {
      try {
        const newPaymentMethod = await supabasePaymentMethodsService.createPaymentMethod({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1) // Capitalize first letter
        })
        paymentMethodMap.set(value, newPaymentMethod.id)
      } catch (error) {
        console.warn(`Failed to create payment method ${value}:`, error)
        // Use default payment method
        const defaultMethod = existingPaymentMethods.find(m => m.value === 'credit_card')
        if (defaultMethod) {
          paymentMethodMap.set(value, defaultMethod.id)
        }
      }
    }
    
    return paymentMethodMap
  }

  /**
   * Handle ID mapping for subscription data
   */
  private mapSubscriptionIds(
    subscriptions: SubscriptionImportData[],
    categoryMap: Map<string, string>,
    paymentMethodMap: Map<string, string>
  ): SubscriptionImportData[] {
    return subscriptions.map(subscription => {
      // Map category ID
      if (subscription.category?.value) {
        const categoryId = categoryMap.get(subscription.category.value)
        if (categoryId) {
          subscription.categoryId = categoryId
        }
      }
      
      // Map payment method ID
      if (subscription.paymentMethod?.value) {
        const paymentMethodId = paymentMethodMap.get(subscription.paymentMethod.value)
        if (paymentMethodId) {
          subscription.paymentMethodId = paymentMethodId
        }
      }
      
      // Set default values
      if (!subscription.categoryId) {
        const defaultCategory = Array.from(categoryMap.entries()).find(([value]) => value === 'other')
        subscription.categoryId = defaultCategory?.[1] || '1'
      }
      
      if (!subscription.paymentMethodId) {
        const defaultPaymentMethod = Array.from(paymentMethodMap.entries()).find(([value]) => value === 'credit_card')
        subscription.paymentMethodId = defaultPaymentMethod?.[1] || '1'
      }
      
      // Set default renewal type
      if (!subscription.renewalType) {
        subscription.renewalType = 'manual'
      }
      
      return subscription
    })
  }

  /**
   * Parse CSV file content
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
        errors: [`CSV parsing failed: ${error.message}`]
      }
    }
  }

  /**
   * Parse JSON file content
   */
  async parseJSONFile(content: string): Promise<{
    subscriptions: SubscriptionImportData[]
    errors: string[]
  }> {
    try {
      const data = JSON.parse(content)
      const errors: string[] = []
      let subscriptions: SubscriptionImportData[] = []
      
      // Check different JSON formats
      if (data.subscriptions && Array.isArray(data.subscriptions)) {
        // Complete export format
        subscriptions = data.subscriptions
      } else if (data.state?.subscriptions && Array.isArray(data.state.subscriptions)) {
        // Zustand state format
        subscriptions = data.state.subscriptions
      } else if (Array.isArray(data)) {
        // Direct subscription array
        subscriptions = data
      } else {
        errors.push('Unrecognized JSON format, please ensure it contains subscription data')
        return { subscriptions: [], errors }
      }
      
      // Validate and convert data format
      const validSubscriptions: SubscriptionImportData[] = []
      subscriptions.forEach((sub: any, index: number) => {
        try {
          const subscription: SubscriptionImportData = {
            name: sub.name || `Unknown Subscription ${index + 1}`,
            plan: sub.plan || 'Basic',
            billingCycle: sub.billingCycle || 'monthly',
            nextBillingDate: sub.nextBillingDate || new Date().toISOString().split('T')[0],
            amount: Number(sub.amount) || 0,
            currency: sub.currency || 'USD',
            convertedAmount: Number(sub.convertedAmount) || 0,
            paymentMethodId: sub.paymentMethodId || '1',
            startDate: sub.startDate || new Date().toISOString().split('T')[0],
            status: sub.status || 'active',
            categoryId: sub.categoryId || '1',
            renewalType: sub.renewalType || 'manual',
            notes: sub.notes || '',
            website: sub.website || '',
            // Preserve related data for ID mapping
            category: sub.category,
            paymentMethod: sub.paymentMethod
          }
          validSubscriptions.push(subscription)
        } catch (error: any) {
          errors.push(`Record ${index + 1} format error: ${error.message}`)
        }
      })
      
      return { subscriptions: validSubscriptions, errors }
    } catch (error: any) {
      return {
        subscriptions: [],
        errors: [`JSON parsing failed: ${error.message}`]
      }
    }
  }

  /**
   * Import subscription data
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
      updateProgress(1, 'Validating import data...')
      
      // Data validation
      if (finalOptions.validateData) {
        const validationErrors: string[] = []
        subscriptions.forEach((subscription, index) => {
          const errors = this.validateSubscriptionData(subscription)
          if (errors.length > 0) {
            validationErrors.push(`Record ${index + 1}: ${errors.join(', ')}`)
          }
        })
        
        if (validationErrors.length > 0) {
          result.errors = validationErrors
          return result
        }
      }
      
      updateProgress(2, 'Detecting duplicate data...')
      
      // Duplicate detection
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
      
      updateProgress(3, 'Processing category data...')
      
      // Ensure categories exist
      let categoryMap = new Map<string, string>()
      if (finalOptions.createMissingCategories) {
        categoryMap = await this.ensureCategoriesExist(uniqueSubscriptions)
      }
      
      updateProgress(4, 'Processing payment methods...')
      
      // Ensure payment methods exist
      let paymentMethodMap = new Map<string, string>()
      if (finalOptions.createMissingPaymentMethods) {
        paymentMethodMap = await this.ensurePaymentMethodsExist(uniqueSubscriptions)
      }
      
      updateProgress(5, 'Mapping data relationships...')
      
      // Handle ID mapping
      const mappedSubscriptions = this.mapSubscriptionIds(
        uniqueSubscriptions,
        categoryMap,
        paymentMethodMap
      )
      
      updateProgress(6, 'Importing subscription data...')
      
      // Bulk import subscriptions
      const importedSubscriptions = await supabaseSubscriptionService.bulkCreateSubscriptions(
        mappedSubscriptions
      )
      
      result.imported = importedSubscriptions.length
      result.details.subscriptions = importedSubscriptions.length
      result.success = true
      
      updateProgress(10, 'Import completed')
      
    } catch (error: any) {
      console.error('Import failed:', error)
      result.errors.push(`Import failed: ${error.message}`)
    }
    
    return result
  }

  /**
   * Import data from file
   */
  async importFromFile(
    file: File,
    options: Partial<ImportOptions> = {}
  ): Promise<ImportResult> {
    const finalOptions = { ...DEFAULT_IMPORT_OPTIONS, ...options }
    
    try {
      finalOptions.onProgress?.(10, 'Reading file content...')
      
      const content = await this.readFileContent(file)
      
      finalOptions.onProgress?.(20, 'Parsing file data...')
      
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
          errors: ['Unsupported file format, please upload CSV or JSON files'],
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
      
      // Adjust progress callback, reserve 80% progress for import process
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
        errors: [`File processing failed: ${error.message}`],
        duplicates: [],
        details: { subscriptions: 0, paymentHistory: 0, categories: 0, paymentMethods: 0 }
      }
    }
  }

  /**
   * Read file content
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      
      reader.onerror = () => {
        reject(new Error('File reading failed'))
      }
      
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * Get import preview information
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
        estimatedRecords = Math.max(0, lines.length - 1) // Subtract header row
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
          errors.push('Invalid JSON format')
        }
      } else {
        errors.push('Unsupported file format')
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
        errors: [`File preview failed: ${error.message}`]
      }
    }
  }
}

// Export singleton instance
export const dataImportService = new DataImportService()