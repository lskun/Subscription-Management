import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { CurrencySelector } from "@/components/subscription/CurrencySelector"
import { PaymentHistoryRecord } from "@/services/supabasePaymentHistoryService"
import { getBaseCurrency } from "@/config/currency"
import { debounce } from "@/lib/utils"

// Form data type for payment record (internal use with Date objects)
interface PaymentFormData {
  subscriptionId: string
  paymentDate: Date
  amountPaid: number | string
  currency: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  status: string
  notes?: string
}

// API data type for payment record (for submission with string dates)
interface PaymentApiData {
  subscriptionId: string
  paymentDate: string
  amountPaid: number
  currency: string
  billingPeriodStart: string
  billingPeriodEnd: string
  status: string
  notes?: string
}

// 预填充数据接口
interface PrefilledData {
  amount?: number
  currency?: string
  billingCycle?: string
  nextBillingDate?: string
}

interface PaymentHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: PaymentHistoryRecord
  subscriptionId: string
  subscriptionName: string
  prefilledData?: PrefilledData
  onSubmit: (data: PaymentApiData) => Promise<void>
}

// Form validation types
type FormErrors = {
  [key: string]: string
}

export function PaymentHistorySheet({
  open,
  onOpenChange,
  initialData,
  subscriptionId,
  subscriptionName,
  prefilledData,
  onSubmit
}: PaymentHistorySheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State for form data and validation errors
  const [form, setForm] = useState<PaymentFormData>({
    subscriptionId,
    paymentDate: new Date(),
    amountPaid: 0,
    currency: getBaseCurrency(),
    billingPeriodStart: new Date(),
    billingPeriodEnd: new Date(),
    status: "success",
    notes: ""
  })

  /**
 * 验证账单周期长度是否匹配
 */
const validateBillingCyclePeriod = (
  startDate: Date,
  endDate: Date,
  billingCycle: string
): boolean => {
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  switch (billingCycle) {
    case 'monthly':
      return daysDiff >= 28 && daysDiff <= 31
    case 'quarterly':
      return daysDiff >= 89 && daysDiff <= 92
    case 'yearly':
      return daysDiff >= 365 && daysDiff <= 366
    default:
      return true
  }
}

/**
 * 根据开始日期和计费周期计算结束日期
 */
const calculateBillingPeriodEnd = (startDate: Date, billingCycle: string): Date => {
  const endDate = new Date(startDate)
  
  switch (billingCycle) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1)
      break
    case 'quarterly':
      endDate.setMonth(endDate.getMonth() + 3)
      break
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1)
      break
  }
  
  endDate.setDate(endDate.getDate() - 1) // 减去1天，使其为周期的最后一天
  return endDate
}

const [errors, setErrors] = useState<FormErrors>({})

/**
 * 防抖金额校验函数
 * 对金额输入进行防抖处理，避免频繁校验
 */
const debouncedAmountValidation = useMemo(
  () => debounce((value: string) => {
    const amount = parseFloat(value)
    const newErrors: FormErrors = {}
    
    // 清除之前的金额错误
    setErrors(prev => {
      const { amountPaid, ...rest } = prev
      return rest
    })
    
    // 执行金额校验逻辑
    if (value.trim() === '') {
      newErrors.amountPaid = "Amount is required"
    } else if (isNaN(amount) || amount <= 0) {
      newErrors.amountPaid = "Amount must be greater than 0"
    } else if (amount > 999999.99) {
      newErrors.amountPaid = "Amount is too large"
    }
    
    // 设置校验错误
    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }))
    }
  }, 300),
  []
)

/**
 * 处理金额输入变化的防抖函数
 * 立即更新表单状态，延迟执行校验
 */
const handleAmountChange = (value: string) => {
  // 立即更新表单状态，保证输入响应性
  setForm(prev => ({ ...prev, amountPaid: value }))
  
  // 清除之前的金额错误（立即反馈）
  if (errors.amountPaid) {
    setErrors(prev => ({ ...prev, amountPaid: "" }))
  }
  
  // 防抖执行校验
  debouncedAmountValidation(value)
}

  /**
   * 根据计费周期计算计费期间开始日期
   */
  const calculateBillingPeriodStart = (nextBillingDate: Date, billingCycle: string): Date => {
    const startDate = new Date(nextBillingDate)
    
    switch (billingCycle) {
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        // 默认为月度
        startDate.setMonth(startDate.getMonth() - 1)
    }
    
    return startDate
  }

  // Initialize form with initial data when editing or prefilled data
  useEffect(() => {
    // 只在 Sheet 打开时初始化表单，避免在 loading 状态时重复初始化
    if (!open) return
    
    if (initialData) {
      // 编辑现有支付记录
      setForm({
        subscriptionId: initialData.subscriptionId,
        paymentDate: new Date(initialData.paymentDate),
        amountPaid: initialData.amountPaid,
        currency: initialData.currency,
        billingPeriodStart: new Date(initialData.billingPeriodStart),
        billingPeriodEnd: new Date(initialData.billingPeriodEnd),
        status: initialData.status,
        notes: initialData.notes || ""
      })
    } else {
      // 新建支付记录，可能包含预填充数据
      const today = new Date()
      let billingPeriodEnd = new Date()
      let billingPeriodStart = new Date()
      
      // 如果有预填充数据且包含下次计费日期，计算计费期间
      if (prefilledData?.nextBillingDate && prefilledData?.billingCycle) {
        const nextBilling = new Date(prefilledData.nextBillingDate)
        // Billing Period End 设置为 Next Billing 的前一天
        billingPeriodEnd = new Date(nextBilling)
        billingPeriodEnd.setDate(billingPeriodEnd.getDate() - 1)
        
        // 根据计费周期计算开始日期
        billingPeriodStart = calculateBillingPeriodStart(nextBilling, prefilledData.billingCycle)
      }
      
      setForm({
        subscriptionId,
        paymentDate: today,
        amountPaid: prefilledData?.amount || 0,
        currency: prefilledData?.currency || getBaseCurrency(),
        billingPeriodStart,
        billingPeriodEnd,
        status: "success",
        notes: ""
      })
    }
    setErrors({})
  }, [initialData, subscriptionId, prefilledData, open])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    const today = new Date()
    today.setHours(23, 59, 59, 0)

    if (!form.paymentDate) {
      newErrors.paymentDate = "Payment date is required"
    }

    if (form.paymentDate && form.paymentDate > today) {
      newErrors.paymentDate = "Payment date cannot be in the future"
    }

    const amountValue = typeof form.amountPaid === 'string' ? parseFloat(form.amountPaid) : form.amountPaid;
    if (!amountValue || isNaN(amountValue) || amountValue <= 0) {
      newErrors.amountPaid = "Amount must be greater than 0"
    }

    if (!form.currency) {
      newErrors.currency = "Currency is required"
    }

    if (!form.billingPeriodStart) {
      newErrors.billingPeriodStart = "Billing period start is required"
    }

    if (!form.billingPeriodEnd) {
      newErrors.billingPeriodEnd = "Billing period end is required"
    }

    if (form.billingPeriodStart && form.billingPeriodEnd) {
      const startDate = new Date(form.billingPeriodStart)
      const endDate = new Date(form.billingPeriodEnd)
      if (startDate >= endDate) {
        newErrors.billingPeriodEnd = "End date must be after start date"
      }
    }

        // 7. 支付日期与账单周期关系校验
    if (form.paymentDate && form.billingPeriodStart && form.billingPeriodEnd) {
      // 标准化日期比较：只比较日期部分，忽略时间部分
      const paymentDate = new Date(form.paymentDate)
      const startDate = new Date(form.billingPeriodStart)
      const endDate = new Date(form.billingPeriodEnd)
      
      // 将所有日期设置为当天的00:00:00以确保准确比较
      paymentDate.setHours(0, 0, 0, 0)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)
      
      const gracePeriod = new Date(endDate)
      gracePeriod.setDate(gracePeriod.getDate() + 30) // 30天宽限期
      gracePeriod.setHours(0, 0, 0, 0)

      if (paymentDate < startDate) {
        console.debug("Payment date before billing period start", paymentDate, startDate)
        newErrors.paymentDate = "Payment date cannot be before billing period start date"
      } else if (paymentDate > gracePeriod) {
        newErrors.paymentDate = "Payment date cannot be after billing period end date plus 30 days"
      }
    }

    // 8. 账单周期长度校验（如果有prefilledData）
    if (prefilledData?.billingCycle && form.billingPeriodStart && form.billingPeriodEnd) {
      const isValidCycle = validateBillingCyclePeriod(
        form.billingPeriodStart,
        form.billingPeriodEnd,
        prefilledData.billingCycle
      )
      if (!isValidCycle) {
        newErrors.billingPeriodEnd = `Billing period length does not match ${prefilledData.billingCycle} billing cycle`
      }
    }

    if (!form.status) {
      newErrors.status = "Status is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Convert Date objects to strings and ensure amountPaid is a number for API
      const amountValue = typeof form.amountPaid === 'string' ? parseFloat(form.amountPaid) : form.amountPaid;
      const submitData = {
        ...form,
        amountPaid: amountValue,
        paymentDate: format(form.paymentDate, "yyyy-MM-dd"),
        billingPeriodStart: format(form.billingPeriodStart, "yyyy-MM-dd"),
        billingPeriodEnd: format(form.billingPeriodEnd, "yyyy-MM-dd")
      }
      await onSubmit(submitData)
      onOpenChange(false) // Close sheet on successful submission
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * 处理表单字段变化
   * 注意：amountPaid 字段现在使用专门的防抖函数 handleAmountChange 处理
   */
  const handleFieldChange = (field: keyof PaymentFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }

    // 实时校验特定字段
    const newErrors: FormErrors = {}
    
    switch (field) {
      case 'paymentDate':
        if (value && value > new Date()) {
          newErrors.paymentDate = "Payment date cannot be in the future"
        }
        break
        
      case 'billingPeriodStart':
        // 自动填充billingPeriodEnd
        if (value && prefilledData?.billingCycle) {
          const endDate = calculateBillingPeriodEnd(value, prefilledData.billingCycle)
          setForm(prev => ({ ...prev, billingPeriodEnd: endDate }))
        }
        break
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] md:w-[500px] lg:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {initialData ? "Edit Payment" : "Add Payment"}
          </SheetTitle>
          <SheetDescription>
            {subscriptionName}
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 py-4">
          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <DatePicker
              value={form.paymentDate}
              onChange={(date) => handleFieldChange("paymentDate", date || new Date())}
              placeholder="Select payment date"
              className={errors.paymentDate ? "border-destructive" : ""}
            />
            {errors.paymentDate && (
              <p className="text-sm text-destructive">{errors.paymentDate}</p>
            )}
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountPaid">Amount *</Label>
              <Input
                id="amountPaid"
                type="number"
                step="0.01"
                min="0"
                value={form.amountPaid}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={errors.amountPaid ? "border-destructive" : ""}
              />
              {errors.amountPaid && (
                <p className="text-sm text-destructive">{errors.amountPaid}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <CurrencySelector
                value={form.currency}
                onValueChange={(value) => handleFieldChange("currency", value)}
                className={errors.currency ? "border-destructive" : ""}
              />
              {errors.currency && (
                <p className="text-sm text-destructive">{errors.currency}</p>
              )}
            </div>
          </div>

          {/* Billing Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingPeriodStart">Billing Period Start *</Label>
              <DatePicker
                value={form.billingPeriodStart}
                onChange={(date) => handleFieldChange("billingPeriodStart", date || new Date())}
                placeholder="Select start date"
                className={errors.billingPeriodStart ? "border-destructive" : ""}
              />
              {errors.billingPeriodStart && (
                <p className="text-sm text-destructive">{errors.billingPeriodStart}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPeriodEnd">Billing Period End *</Label>
              <DatePicker
                value={form.billingPeriodEnd}
                onChange={(date) => handleFieldChange("billingPeriodEnd", date || new Date())}
                placeholder="Select end date"
                className={errors.billingPeriodEnd ? "border-destructive" : ""}
              />
              {errors.billingPeriodEnd && (
                <p className="text-sm text-destructive">{errors.billingPeriodEnd}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={form.status}
              onValueChange={(value) => handleFieldChange("status", value)}
            >
              <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
            </Select>
            {errors.status && (
              <p className="text-sm text-destructive">{errors.status}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Optional notes about this payment..."
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Update Payment" : "Add Payment"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
