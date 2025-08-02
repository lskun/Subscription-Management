import { useState, useEffect } from "react"
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

interface PaymentHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: PaymentHistoryRecord
  subscriptionId: string
  subscriptionName: string
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
    status: "succeeded",
    notes: ""
  })

  const [errors, setErrors] = useState<FormErrors>({})

  // Initialize form with initial data when editing
  useEffect(() => {
    if (initialData) {
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
      // Reset form for new payment
      setForm({
        subscriptionId,
        paymentDate: new Date(),
        amountPaid: 0,
        currency: getBaseCurrency(),
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(),
        status: "succeeded",
        notes: ""
      })
    }
    setErrors({})
  }, [initialData, subscriptionId, open])

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!form.paymentDate) {
      newErrors.paymentDate = "Payment date is required"
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

  // Handle form field changes
  const handleFieldChange = (field: keyof PaymentFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
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
                onChange={(e) => handleFieldChange("amountPaid", e.target.value)}
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
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
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
