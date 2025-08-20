import { useState, useCallback, useEffect } from "react"
import { 
  Calendar, 
  Plus, 
  Search, 
  Tags,
  Check,
  Download,
  Upload,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { useToast } from "@/hooks/use-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useConfirmation } from "@/hooks/use-confirmation"
import { addMonths, addQuarters, addYears } from "date-fns"

import { 
  useSubscriptionStore, 
  Subscription, 
  SubscriptionStatus,
  BillingCycle
} from "@/store/subscriptionStore"

import { useSubscriptionsData } from "@/hooks/useSubscriptionsData"
import { SubscriptionData } from "@/services/subscriptionsEdgeFunctionService"


import { SubscriptionCard } from "@/components/subscription/SubscriptionCard"
import { SubscriptionForm } from "@/components/subscription/SubscriptionForm"
import { SubscriptionDetailDialog } from "@/components/subscription/SubscriptionDetailDialog"
import { SubscriptionSuccessDialog } from "@/components/subscription/SubscriptionSuccessDialog"
import { ImportModal } from "@/components/imports/ImportModal"
import { ExportModal } from "@/components/exports/ExportModal"
import { PaymentHistorySheet } from "@/components/subscription/PaymentHistorySheet"
import { DuplicatePaymentConfirmDialog } from "@/components/subscription/payment/DuplicatePaymentConfirmDialog"
import { DuplicatePaymentDetectionResult } from "@/services/duplicatePaymentDetectionService"
import { usePaymentRecordOperations } from "@/hooks/usePaymentRecordOperations"
import { AddPaymentRecordParams, PaymentRecordService, AutoGenerateSubscriptionInfo } from "@/services/paymentRecordService"

export function SubscriptionsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [currentView, setCurrentView] = useState<"all" | "active" | "cancelled">("all")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<BillingCycle[]>([])
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false)
  const [billingCycleFilterOpen, setBillingCycleFilterOpen] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  
  // 订阅成功对话框相关状态
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [newlyCreatedSubscription, setNewlyCreatedSubscription] = useState<Subscription | null>(null)
  
  // 支付记录表单相关状态
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [detailSubscription, setDetailSubscription] = useState<Subscription | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  
  // 重复支付检测相关状态（保留用于兼容现有的DuplicatePaymentWarningDialog）
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [duplicateDetectionResult, setDuplicateDetectionResult] = useState<DuplicatePaymentDetectionResult | null>(null)
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null)
  
  // 统一的支付记录操作hook
  const {
    isLoading: isAddingPayment,
    addPaymentRecord,
    confirmDuplicatePayment,
    cancelDuplicatePayment,
    showDuplicateWarning: showDuplicateWarningNew,
    duplicateDetectionResult: duplicateDetectionResultNew
  } = usePaymentRecordOperations({
    onSuccess: (result) => {
      // 关闭表单
      setShowPaymentForm(false)
      setSelectedSubscription(null)
      
      // 如果是从成功对话框来的，也关闭成功对话框
      if (showSuccessDialog) {
        setShowSuccessDialog(false)
        setNewlyCreatedSubscription(null)
      }
    },
    onError: (error) => {
      console.error('支付记录添加失败:', error)
    },
    onDuplicateDetected: (result, pendingData) => {
      // 使用旧的状态管理方式来兼容现有的DuplicatePaymentWarningDialog
      setDuplicateDetectionResult(result)
      setPendingPaymentData(pendingData)
      setShowDuplicateWarning(true)
    }
  })
  // 管理整个订阅区域的loading状态
  const [operationLoading, setOperationLoadingState] = useState<{ isLoading: boolean; action?: string; message?: string }>({ isLoading: false })
  
  /**
   * 设置操作loading状态
   * @param action - 执行的操作类型
   * @param message - loading消息
   */
  const setOperationLoading = useCallback((action: string, message: string) => {
    setOperationLoadingState({ isLoading: true, action, message })
  }, [])

  /**
   * 清除操作loading状态
   */
  const clearOperationLoading = useCallback(() => {
    setOperationLoadingState({ isLoading: false })
  }, [])
  
  // Use the new subscriptions data hook
  const {
    subscriptions,
    categories,
    isLoading,
    updateLocalSubscription,
    deleteLocalSubscription,
    addLocalSubscription
  } = useSubscriptionsData()

  // Still need subscription store for CRUD operations
  const {
    addSubscription,
    bulkAddSubscriptions,
    updateSubscription,
    deleteSubscription,
    fetchSubscriptions,
    manualRenewSubscription
  } = useSubscriptionStore()
  
  // 本地筛选状态：分离原始数据和显示数据
  const [allSubscriptions, setAllSubscriptions] = useState<SubscriptionData[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionData[]>([])
  
  // Get categories from Edge Function data - 只显示有订阅的分类
  const usedCategories = categories
    .map(cat => ({
      id: cat.id,
      value: cat.value,
      label: cat.label
    }))
    .filter(category => 
      subscriptions.some(s => s.category?.value === category.value)
    )
  
  // Get unique billing cycles in use - 基于原始数据计算
  const getUniqueBillingCycles = () => {
    const billingCycles = allSubscriptions.map(sub => sub.billingCycle)
    return Array.from(new Set(billingCycles)).map(cycle => ({
      value: cycle,
      label: cycle.charAt(0).toUpperCase() + cycle.slice(1)
    }))
  }
  
  const usedBillingCycles = getUniqueBillingCycles()

  /**
   * 本地状态筛选函数 - 根据状态筛选订阅
   * @param subscriptions - 订阅数据数组
   * @param status - 筛选状态
   * @returns 筛选后的订阅数据
   */
  const filterByStatusLocal = useCallback((subscriptions: SubscriptionData[], status: string) => {
    if (status === 'all') return subscriptions
    return subscriptions.filter(sub => sub.status === status)
  }, [])

  /**
   * 本地分类筛选函数 - 根据分类筛选订阅
   * @param subscriptions - 订阅数据数组
   * @param categories - 筛选分类数组
   * @returns 筛选后的订阅数据
   */
  const filterByCategoriesLocal = useCallback((subscriptions: SubscriptionData[], categories: string[]) => {
    if (categories.length === 0) return subscriptions
    return subscriptions.filter(sub => 
      sub.category && categories.includes(sub.category.value)
    )
  }, [])

  /**
   * 本地账单周期筛选函数 - 根据账单周期筛选订阅
   * @param subscriptions - 订阅数据数组
   * @param cycles - 账单周期数组
   * @returns 筛选后的订阅数据
   */
  const filterByBillingCyclesLocal = useCallback((subscriptions: SubscriptionData[], cycles: BillingCycle[]) => {
    if (cycles.length === 0) return subscriptions
    return subscriptions.filter(sub => cycles.includes(sub.billingCycle as BillingCycle))
  }, [])

  /**
   * 本地搜索筛选函数 - 根据搜索词筛选订阅
   * @param subscriptions - 订阅数据数组
   * @param searchTerm - 搜索词
   * @returns 筛选后的订阅数据
   */
  const filterBySearchLocal = useCallback((subscriptions: SubscriptionData[], searchTerm: string) => {
    if (!searchTerm.trim()) return subscriptions
    const term = searchTerm.toLowerCase()
    return subscriptions.filter(sub => 
      sub.name.toLowerCase().includes(term) ||
      sub.notes?.toLowerCase().includes(term) ||
      sub.category?.label.toLowerCase().includes(term)
    )
  }, [])

  /**
   * 组合所有筛选逻辑 - 应用所有筛选条件
   * @param subscriptions - 原始订阅数据
   * @returns 经过所有筛选条件处理后的订阅数据
   */
  const applyAllFilters = useCallback((subscriptions: SubscriptionData[]) => {
    let filtered = subscriptions
    
    // 应用状态筛选
    filtered = filterByStatusLocal(filtered, currentView)
    
    // 应用分类筛选
    filtered = filterByCategoriesLocal(filtered, selectedCategories)
    
    // 应用账单周期筛选
    filtered = filterByBillingCyclesLocal(filtered, selectedBillingCycles)
    
    // 应用搜索筛选
    filtered = filterBySearchLocal(filtered, searchTerm)
    
    return filtered
  }, [currentView, selectedCategories, selectedBillingCycles, searchTerm, filterByStatusLocal, filterByCategoriesLocal, filterByBillingCyclesLocal, filterBySearchLocal])

  // 数据同步逻辑：初始数据加载
  useEffect(() => {
    if (subscriptions.length > 0) {
      setAllSubscriptions(subscriptions)
    }
  }, [subscriptions])

  // 筛选触发机制：当原始数据或筛选条件变化时，重新计算显示数据
  useEffect(() => {
    const filtered = applyAllFilters(allSubscriptions)
    setFilteredSubscriptions(filtered)
  }, [allSubscriptions, applyAllFilters])

  // 使用筛选后的数据作为显示数据
  const sortedSubscriptions = filteredSubscriptions

  // Handler for adding new subscription
  const handleAddSubscription = useCallback(async (subscription: Omit<Subscription, "id" | "lastBillingDate">) => {
    // 设置loading状态
    setOperationLoading('add', `Adding ${subscription.name}...`)
    
    const { data: newSubscription, error } = await addSubscription(subscription)
    
    if (error) {
      toast({
        title: "Error adding subscription",
        description: error.message || "Failed to add subscription",
        variant: "destructive"
      })
      clearOperationLoading()
      return
    }
    
    console.debug('添加新订阅:', newSubscription)

    // 直接在本地状态中添加新订阅，避免重新获取所有数据
    if (newSubscription) {
      // 将Subscription类型转换为SubscriptionData类型
      const subscriptionData: SubscriptionData = {
        id: newSubscription.id,
        name: newSubscription.name,
        plan: newSubscription.plan || '',
        amount: newSubscription.amount,
        currency: newSubscription.currency,
        convertedAmount: newSubscription.convertedAmount || newSubscription.amount,
        billingCycle: newSubscription.billingCycle,
        nextBillingDate: newSubscription.nextBillingDate,
        lastBillingDate: newSubscription.lastBillingDate,
        status: newSubscription.status,
        categoryId: newSubscription.categoryId,
        paymentMethodId: newSubscription.paymentMethodId,
        startDate: newSubscription.startDate || new Date().toISOString(),
        renewalType: newSubscription.renewalType || 'auto',
        notes: newSubscription.notes || '',
        website: newSubscription.website
      }
      addLocalSubscription(subscriptionData)
      // 同步更新本地原始数据
      setAllSubscriptions(prev => [...prev, subscriptionData])
    }
    
    // 显示成功对话框而不是简单的 toast
    setNewlyCreatedSubscription(newSubscription)
    setShowSuccessDialog(true)
    
    clearOperationLoading()
  }, [addSubscription, addLocalSubscription, toast, setOperationLoading, clearOperationLoading])

  /**
   * 处理从成功对话框添加支付记录
   */
  const handleAddPaymentFromSuccess = useCallback(() => {
    if (newlyCreatedSubscription) {
      setSelectedSubscription(newlyCreatedSubscription)
      setShowPaymentForm(true)
    }
  }, [newlyCreatedSubscription])

  /**
   * 处理从成功对话框导入支付记录
   */
  const handleImportPaymentsFromSuccess = useCallback(() => {
    if (newlyCreatedSubscription) {
      // TODO 可以在这里实现导入支付记录的逻辑
      // 暂时显示提示信息
      toast({
        title: "Import Feature",
        description: "Payment record import feature is under development.",
      })
    }
  }, [newlyCreatedSubscription, toast])

  /**
   * 处理从成功对话框查看订阅详情
   */
  const handleViewSubscriptionFromSuccess = useCallback(() => {
    if (newlyCreatedSubscription) {
      setDetailSubscription(newlyCreatedSubscription)
    }
  }, [newlyCreatedSubscription])

  /**
   * 处理智能自动生成支付记录
   * 从成功对话框触发，基于订阅的开始日期和计费周期自动生成历史支付记录
   */
  const handleAutoGeneratePayments = useCallback(async () => {
    if (!newlyCreatedSubscription) {
      toast({
        title: "Error",
        description: "No subscription data available for auto-generation.",
        variant: "destructive"
      })
      return
    }

    try {
      // 设置loading状态
      setOperationLoading('auto-generate', `Generating payment records for ${newlyCreatedSubscription.name}...`)
      
      // 准备订阅信息
      const subscriptionInfo: AutoGenerateSubscriptionInfo = {
        id: newlyCreatedSubscription.id,
        name: newlyCreatedSubscription.name,
        amount: newlyCreatedSubscription.amount,
        currency: newlyCreatedSubscription.currency,
        billingCycle: newlyCreatedSubscription.billingCycle,
        startDate: newlyCreatedSubscription.startDate,
        renewalType: newlyCreatedSubscription.renewalType,
        nextBillingDate: newlyCreatedSubscription.nextBillingDate,
        lastBillingDate: newlyCreatedSubscription.lastBillingDate
      }
      
      // 调用自动生成服务
      const result = await PaymentRecordService.autoGeneratePaymentRecords(
        subscriptionInfo,
        async (id: string, updates: { lastBillingDate: string }) => {
          const { error } = await updateSubscription(id, updates)
          return { error }
        }
      )
      
      if (result.success) {
        // 更新本地订阅数据的last_billing_date和next_billing_date
        if (result.lastBillingDateUpdated && result.newLastBillingDate) {
          const currentSubscription = subscriptions.find(sub => sub.id === newlyCreatedSubscription.id)
          if (currentSubscription) {
            const updatedData = {
              ...currentSubscription,
              lastBillingDate: result.newLastBillingDate,
              nextBillingDate: result.newNextBillingDate || currentSubscription.nextBillingDate
            }
            updateLocalSubscription(updatedData)
            setAllSubscriptions(prev => 
              prev.map(sub => sub.id === newlyCreatedSubscription.id ? updatedData : sub)
            )
          }
        }
        
        toast({
          title: "Payment Records Generated Successfully",
          description: `Generated ${result.generatedCount} payment record(s) for ${newlyCreatedSubscription.name}.`,
        })
        
        // 关闭成功对话框
        setShowSuccessDialog(false)
        setNewlyCreatedSubscription(null)
      } else {
        throw new Error(result.error || 'Unknown error occurred during auto-generation')
      }
    } catch (error) {
      console.error('自动生成支付记录失败:', error)
      toast({
        title: "Auto-Generation Failed",
        description: error instanceof Error ? error.message : "Failed to auto-generate payment records.",
        variant: "destructive"
      })
    } finally {
      clearOperationLoading()
    }
  }, [newlyCreatedSubscription, toast, setOperationLoading, clearOperationLoading, updateSubscription, subscriptions, updateLocalSubscription, setAllSubscriptions])

  /**
   * 处理支付记录表单提交（使用统一的支付记录服务）
   */
  const handlePaymentSubmit = useCallback(async (paymentData: {
    subscriptionId: string;
    paymentDate: string;
    amountPaid: number;
    currency: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    status: string;
    notes?: string;
  }) => {
    const params: AddPaymentRecordParams = {
      subscriptionId: paymentData.subscriptionId,
      paymentDate: paymentData.paymentDate,
      amountPaid: paymentData.amountPaid,
      currency: paymentData.currency,
      billingPeriodStart: paymentData.billingPeriodStart,
      billingPeriodEnd: paymentData.billingPeriodEnd,
      status: paymentData.status as 'success' | 'failed' | 'pending',
      notes: paymentData.notes
    }
    
    await addPaymentRecord(params)
  }, [addPaymentRecord])

  // Handler for updating subscription
  const handleUpdateSubscription = useCallback(async (id: string, data: Omit<Subscription, "id" | "lastBillingDate">) => {
    setOperationLoading('edit', `Updating ${data.name}...`)
    
    const { error } = await updateSubscription(id, data)
    
    if (error) {
      toast({
        title: "Error updating subscription",
        description: error.message || "Failed to update subscription",
        variant: "destructive"
      })
      clearOperationLoading()
      return
    }
    
    // Update local state instead of refreshing
     const updatedSubscription = subscriptions.find(sub => sub.id === id)
     if (updatedSubscription) {
       const updatedData = { ...updatedSubscription, ...data }
       updateLocalSubscription(updatedData)
       // 同步更新本地原始数据
       setAllSubscriptions(prev => 
         prev.map(sub => sub.id === id ? updatedData : sub)
       )
     }
    
    setEditingSubscription(null)
    toast({
      title: "Subscription updated",
      description: `${data.name} has been updated successfully.`
    })
    
    clearOperationLoading()
  }, [updateSubscription, updateLocalSubscription, setOperationLoading, clearOperationLoading, toast, subscriptions, setAllSubscriptions, setEditingSubscription])

  /**
   * 处理重复支付警告对话框的确认操作（使用统一的支付记录服务）
   */
  const handleDuplicatePaymentConfirm = useCallback(async () => {
    await confirmDuplicatePayment()
  }, [confirmDuplicatePayment])



  // State for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  
  // Confirmation dialog hook - 定义在前面避免循环依赖
  const deleteConfirmation = useConfirmation({
    title: "Delete Subscription",
    description: deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : "",
    confirmText: "Delete",
    onConfirm: async () => {
      if (!deleteTarget) return
      
      setOperationLoading('delete', `Deleting ${deleteTarget.name}...`)
      
      const { error } = await deleteSubscription(deleteTarget.id)
      
      if (error) {
        toast({
          title: "Error deleting subscription",
          description: error.message || "Failed to delete subscription",
          variant: "destructive"
        })
        clearOperationLoading()
        return
      }
      
      // Remove from local state instead of refreshing
      deleteLocalSubscription(deleteTarget.id)
      // 同步更新本地原始数据
      setAllSubscriptions(prev => prev.filter(sub => sub.id !== deleteTarget.id))
      
      toast({
        title: "Subscription deleted",
        description: `${deleteTarget.name} has been deleted.`,
        variant: "destructive"
      })
      
      clearOperationLoading()
      setDeleteTarget(null)
      // 对话框会在操作完成后自动关闭
    },
    isLoading: operationLoading.isLoading && operationLoading.action === 'delete',
  })
  
  // Handler to open delete confirmation
  const handleDeleteClick = (id: string) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return
    
    setDeleteTarget({ id, name: subscription.name })
    deleteConfirmation.openDialog()
  }

  // Handler for changing subscription status
  const handleStatusChange = useCallback(async (id: string, status: SubscriptionStatus) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return

    const action = status === 'active' ? 'reactivate' : 'cancel'
    const message = status === 'active' ? `Reactivating ${subscription.name}...` : `Cancelling ${subscription.name}...`
    setOperationLoading(action, message)

    try {
      const updateData: Partial<Subscription> = { status }

      if (status === 'cancelled') {
        updateData.nextBillingDate = null
      } else if (status === 'active') {
        // This is the reactivation logic
        const baseDate = subscription.lastBillingDate || subscription.startDate
        if (baseDate) {
          let newNextBillingDate: Date;
          switch (subscription.billingCycle) {
            case 'monthly':
              newNextBillingDate = addMonths(new Date(baseDate), 1)
              break
            case 'quarterly':
              newNextBillingDate = addQuarters(new Date(baseDate), 1)
              break
            case 'yearly':
              newNextBillingDate = addYears(new Date(baseDate), 1)
              break
            default:
              newNextBillingDate = new Date() // Fallback, should not happen
          }
          updateData.nextBillingDate = newNextBillingDate.toISOString()
        }
      }

      const { error } = await updateSubscription(id, updateData)

      if (error) {
        toast({
          title: "Error updating status",
          description: error.message || "Failed to update status",
          variant: "destructive"
        })
        return
      }

      const currentSubscription = subscriptions.find(sub => sub.id === id)
      if (currentSubscription) {
        const mergedData = { ...currentSubscription, ...updateData };
        const updatedData = {
          ...mergedData,
          nextBillingDate: mergedData.nextBillingDate || '',
        }
        updateLocalSubscription(updatedData);
        // 同步更新本地原始数据
        setAllSubscriptions(prev => 
          prev.map(sub => sub.id === id ? updatedData : sub)
        )
      }

      toast({
        title: status === "active" ? "Subscription activated" : "Subscription cancelled",
        description: `${subscription.name} has been ${status === "active" ? "activated" : "cancelled"}.`
      })
    } catch (error) {
      console.error(`Error ${action}ing subscription:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} subscription`,
        variant: "destructive"
      })
    } finally {
      clearOperationLoading()
    }
  }, [subscriptions, updateSubscription, toast, setOperationLoading, clearOperationLoading, updateLocalSubscription])

  // Handler for manual renewal
  const handleManualRenew = useCallback(async (id: string) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return

    // 设置loading状态
    setOperationLoading('renew', `Renewing ${subscription.name}...`)

    try {
      const { error, renewalData } = await manualRenewSubscription(id)

      if (error) {
        toast({
          title: "Error renewing subscription",
          description: error,
          variant: "destructive"
        })
        return
      }

      // Update local state instead of refreshing
       if (renewalData) {
         const currentSubscription = subscriptions.find(sub => sub.id === id)
         if (currentSubscription) {
           const updatedData = {
             ...currentSubscription,
             nextBillingDate: renewalData.newNextBilling,
             lastBillingDate: renewalData.newLastBilling
           }
           updateLocalSubscription(updatedData)
           // 同步更新本地原始数据
           setAllSubscriptions(prev => 
             prev.map(sub => sub.id === id ? updatedData : sub)
           )
         }
       }

      toast({
        title: "Subscription renewed successfully",
        description: `${subscription.name} has been renewed. Next billing date: ${renewalData?.newNextBilling}`
      })
    } catch (error) {
      console.error('Error renewing subscription:', error)
      toast({
        title: "Error",
        description: "Failed to renew subscription",
        variant: "destructive"
      })
    } finally {
      clearOperationLoading()
    }
  }, [subscriptions, manualRenewSubscription, toast, setOperationLoading, clearOperationLoading, updateLocalSubscription])

  /**
   * 本地分类筛选切换处理器 - 切换分类筛选状态
   * @param categoryValue - 分类值
   */
  const toggleCategoryFilter = useCallback((categoryValue: string) => {
    const newCategories = selectedCategories.includes(categoryValue)
      ? selectedCategories.filter(c => c !== categoryValue)
      : [...selectedCategories, categoryValue]
    
    setSelectedCategories(newCategories)
    // 本地筛选会通过useEffect自动触发
  }, [selectedCategories])
  
  /**
   * 本地账单周期筛选切换处理器 - 切换账单周期筛选状态
   * @param billingCycle - 账单周期
   */
  const toggleBillingCycleFilter = useCallback((billingCycle: BillingCycle) => {
    const newBillingCycles = selectedBillingCycles.includes(billingCycle)
      ? selectedBillingCycles.filter(c => c !== billingCycle)
      : [...selectedBillingCycles, billingCycle]
    
    setSelectedBillingCycles(newBillingCycles)
    // 本地筛选会通过useEffect自动触发
  }, [selectedBillingCycles])

  /**
   * 批量导入订阅处理器 - 导入多个订阅并同步本地状态
   * @param newSubscriptions - 新订阅数据数组
   */
  const handleImportSubscriptions = useCallback(async (newSubscriptions: Omit<Subscription, "id">[]) => {
    const { error } = await bulkAddSubscriptions(newSubscriptions);

    if (error) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import subscriptions",
        variant: "destructive",
      });
    } else {
      // 由于 bulkAddSubscriptions 不返回导入的数据，我们需要重新获取订阅列表
      // 这将触发 useEffect 来更新本地状态
      await fetchSubscriptions();
      
      toast({
        title: "Import successful",
        description: `${newSubscriptions.length} subscriptions have been imported.`,
      });
    }
  }, [bulkAddSubscriptions, toast, fetchSubscriptions]);

  // Handler for exporting subscriptions
  const handleExportSubscriptions = () => {
    setShowExportModal(true)
  }
  
  // Get billing cycle badge variant
  const getBillingCycleBadgeVariant = (billingCycle: BillingCycle) => {
    switch (billingCycle) {
      case 'yearly':
        return "success" // Green color for yearly
      case 'monthly':
        return "warning" // Orange/yellow for monthly
      case 'quarterly':
        return "info" // Blue for quarterly
      default:
        return "outline"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage all your subscription services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowAddForm(true)} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Subscription</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setShowImportModal(true)} size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleExportSubscriptions} size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 w-full max-w-sm">
          <SearchInput
            placeholder="Search subscriptions..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              // 本地搜索筛选会通过useEffect自动触发
            }}
            className="w-full"
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
          />

          <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Tags className="h-4 w-4" />
                {selectedCategories.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {selectedCategories.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-2">
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>Filter by Category</span>
                  {selectedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedCategories([])}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="max-h-72 overflow-y-auto">
                {usedCategories.map((category) => (
                  <div
                    key={category.value}
                    className={cn(
                      "flex items-center px-2 py-1.5 transition-colors hover:bg-muted cursor-pointer",
                      selectedCategories.includes(category.value) && "bg-muted"
                    )}
                    onClick={() => toggleCategoryFilter(category.value)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      selectedCategories.includes(category.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-50 border-primary"
                    )}>
                      {selectedCategories.includes(category.value) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="text-sm">{category.value}</div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {subscriptions.filter(s => s.category?.value === category.value).length}
                    </Badge>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Billing Cycle Filter */}
          <Popover open={billingCycleFilterOpen} onOpenChange={setBillingCycleFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <CalendarIcon className="h-4 w-4" />
                {selectedBillingCycles.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {selectedBillingCycles.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-2">
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>Filter by Billing Cycle</span>
                  {selectedBillingCycles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedBillingCycles([])}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="max-h-72 overflow-y-auto">
                {usedBillingCycles.map((cycle) => (
                  <div
                    key={cycle.value}
                    className={cn(
                      "flex items-center px-2 py-1.5 transition-colors hover:bg-muted cursor-pointer",
                      selectedBillingCycles.includes(cycle.value as BillingCycle) && "bg-muted"
                    )}
                    onClick={() => toggleBillingCycleFilter(cycle.value as BillingCycle)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      selectedBillingCycles.includes(cycle.value as BillingCycle)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-50 border-primary"
                    )}>
                      {selectedBillingCycles.includes(cycle.value as BillingCycle) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="text-sm">{cycle.label}</div>
                    <Badge
                      variant={getBillingCycleBadgeVariant(cycle.value as BillingCycle)}
                      className="ml-auto text-xs"
                    >
                      {subscriptions.filter(s => s.billingCycle === cycle.value).length}
                    </Badge>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const newOrder = sortOrder === "asc" ? "desc" : "asc"
                    setSortOrder(newOrder)
                  }}
                >
                  {sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort by Next Billing Date ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={currentView === "all" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("all")
              // 本地状态筛选会通过useEffect自动触发
            }}
          >
            All
          </Button>
          <Button
            variant={currentView === "active" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("active")
              // 本地状态筛选会通过useEffect自动触发
            }}
          >
            Active
          </Button>
          <Button
            variant={currentView === "cancelled" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("cancelled")
              // 本地状态筛选会通过useEffect自动触发
            }}
          >
            Cancelled
          </Button>
        </div>
      </div>

      {/* Display selected category filters */}
      {(selectedCategories.length > 0 || selectedBillingCycles.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedCategories.map(categoryValue => {
            const category = categories.find(c => c.value === categoryValue)
            return (
              <Badge
                key={categoryValue}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1"
              >
                {category?.value || categoryValue}
                <button
                  onClick={() => toggleCategoryFilter(categoryValue)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <span className="sr-only">Remove</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </Badge>
            )
          })}

          {/* Display selected billing cycle filters */}
          {selectedBillingCycles.map(cycleValue => {
            const cycle = usedBillingCycles.find(c => c.value === cycleValue)
            return (
              <Badge
                key={cycleValue}
                variant={getBillingCycleBadgeVariant(cycleValue)}
                className="flex items-center gap-1 px-2 py-1"
              >
                {cycle?.label || cycleValue}
                <button
                  onClick={() => toggleBillingCycleFilter(cycleValue)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <span className="sr-only">Remove</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 text-white"
                  >
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Loading skeleton cards */}
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border bg-card shadow animate-pulse">
              <div className="p-6 pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-2">
                    <div className="h-5 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-6 bg-muted rounded w-20"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-40"></div>
                  <div className="h-4 bg-muted rounded w-28"></div>
                  <div className="h-4 bg-muted rounded w-36"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No subscriptions found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategories.length > 0 || selectedBillingCycles.length > 0
              ? `No results for your current filters. Try changing your search terms or filters.`
              : currentView !== "all"
                ? `You don't have any ${currentView} subscriptions.`
                : "Get started by adding your first subscription."
            }
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Subscriptions
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedSubscriptions.map((subscription) => {
              // Convert SubscriptionData to Subscription format for SubscriptionCard
              const subscriptionForCard: Subscription = {
                id: subscription.id,
                name: subscription.name,
                plan: subscription.plan,
                billingCycle: subscription.billingCycle as BillingCycle,
                nextBillingDate: subscription.nextBillingDate,
                lastBillingDate: subscription.lastBillingDate,
                amount: subscription.amount, // 
                currency: subscription.currency, 
                convertedAmount: subscription.convertedAmount,
                paymentMethodId: subscription.paymentMethodId,
                startDate: subscription.startDate,
                status: subscription.status as SubscriptionStatus,
                categoryId: subscription.categoryId,
                renewalType: subscription.renewalType as 'auto' | 'manual',
                notes: subscription.notes,
                website: subscription.website,
                category: subscription.category,
                paymentMethod: subscription.paymentMethod
              }
              
              return (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscriptionForCard}
                  onEdit={() => setEditingSubscription(subscriptionForCard)}
                  onDelete={() => handleDeleteClick(subscription.id)}
                  onStatusChange={handleStatusChange}
                  onManualRenew={handleManualRenew}
                  onViewDetails={(subscription) => setDetailSubscription(subscription)}
                />
              )
            })}
          </div>
          
          {/* 操作loading覆盖层 - 使用简洁样式 */}
          {operationLoading.isLoading && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-lg font-medium">{operationLoading.message || 'Processing...'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forms and Modals */}
      <SubscriptionForm
        open={showAddForm || editingSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false)
            setEditingSubscription(null)
          }
        }}
        initialData={editingSubscription || undefined}
        onSubmit={editingSubscription
          ? (data) => handleUpdateSubscription(editingSubscription.id, data)
          : handleAddSubscription
        }
      />

      <SubscriptionDetailDialog
        subscription={detailSubscription}
        open={detailSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSubscription(null)
          }
        }}
        onEdit={(id) => {
          const subscription = subscriptions.find(s => s.id === id)
          if (subscription) {
            // Convert SubscriptionData to Subscription
            const convertedSubscription: Subscription = {
              ...subscription,
              billingCycle: subscription.billingCycle as BillingCycle,
              status: subscription.status as SubscriptionStatus,
              renewalType: subscription.renewalType as 'auto' | 'manual'
            }
            setEditingSubscription(convertedSubscription)
            setDetailSubscription(null)
          }
        }}
        onManualRenew={handleManualRenew}
      />

      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportSubscriptions}
      />

      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />

      {/* 订阅创建成功对话框 */}
      {showSuccessDialog && newlyCreatedSubscription && (
        <SubscriptionSuccessDialog
          subscription={newlyCreatedSubscription}
          open={showSuccessDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowSuccessDialog(false)
              setNewlyCreatedSubscription(null)
            }
          }}
          onAddPayment={handleAddPaymentFromSuccess}
          onImportPayments={handleImportPaymentsFromSuccess}
          onViewDetails={handleViewSubscriptionFromSuccess}
          onAutoGeneratePayments={handleAutoGeneratePayments}
          isAutoGenerating={operationLoading.isLoading && operationLoading.action === 'auto-generate'}
        />
      )}

      {/* 支付记录添加表单 */}
      {showPaymentForm && selectedSubscription && (
        <PaymentHistorySheet
          open={showPaymentForm}
          onOpenChange={(open) => {
            if (!open) {
              setShowPaymentForm(false)
              setSelectedSubscription(null)
            }
          }}
          subscriptionId={selectedSubscription.id}
          subscriptionName={selectedSubscription.name}
          prefilledData={{
            amount: selectedSubscription.amount,
            currency: selectedSubscription.currency,
            billingCycle: selectedSubscription.billingCycle,
            nextBillingDate: selectedSubscription.nextBillingDate || undefined,
            startDate: selectedSubscription.startDate || undefined
          }}
          onSubmit={handlePaymentSubmit as (data: {
          subscriptionId: string
          paymentDate: string
          amountPaid: number
          currency: string
          billingPeriodStart: string
          billingPeriodEnd: string
          status: string
          notes?: string
        }) => Promise<void>}
        />
      )}

      {/* 重复支付警告对话框 */}
      <DuplicatePaymentConfirmDialog
        open={showDuplicateWarning}
        onOpenChange={(open) => {
          if (!open) {
            cancelDuplicatePayment()
          }
        }}
        result={duplicateDetectionResult}
        onConfirm={confirmDuplicatePayment}
        onCancel={cancelDuplicatePayment}
      />

      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </>
  )
}
