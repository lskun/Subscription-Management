import { useState, useEffect } from "react"
import { format } from "date-fns"
import { getBaseCurrency } from '@/config/currency'

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { calculateNextBillingDateFromStart, calculateNextBillingDateForNewSubscription } from "@/lib/subscription-utils"
import { Subscription } from "@/store/subscriptionStore"
import { useSubscriptionStore } from '@/store/subscriptionStore'

// Form components
import { FormField } from "./form/FormField"
import { CategorySelector } from "./form/CategorySelector"
import { PaymentMethodSelector } from "./form/PaymentMethodSelector"
import { AmountInput } from "./form/AmountInput"
import { SubscriptionFormData, FormErrors } from "./form/types"
import { validateForm, handleFieldChange } from "./form/validation"

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Subscription
  onSubmit: (data: SubscriptionFormData & { nextBillingDate: string }) => void
}

export function SubscriptionForm({
  open,
  onOpenChange,
  initialData,
  onSubmit
}: SubscriptionFormProps) {
  // Get categories, payment methods and plan options from store with lazy loading
  const {
    categories,
    paymentMethods
  } = useSubscriptionStore(true)

  // State for form data and validation errors
  const [form, setForm] = useState<SubscriptionFormData>({
    name: "",
    plan: "",
    billingCycle: "monthly",
    amount: 0,
    currency: getBaseCurrency(),
    convertedAmount: 0,
    paymentMethodId: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    status: "active",
    categoryId: "",
    renewalType: "manual",
    notes: "",
    website: ""
  })

  // State for form errors
  const [errors, setErrors] = useState<FormErrors>({})

  // Initialize form with initial data if provided
  useEffect(() => {
    if (initialData) {
      const { lastBillingDate, category, paymentMethod, ...formData } = initialData
      setForm({
        ...formData,
        website: formData.website || ""
      })
    }
  }, [initialData])

  // Reset form when closed
  useEffect(() => {
    if (!open) {
      if (!initialData) {
        setForm({
          name: "",
          plan: "",
          billingCycle: "monthly",
          amount: 0,
          currency: getBaseCurrency(),
          convertedAmount: 0,
          paymentMethodId: "",
          startDate: format(new Date(), "yyyy-MM-dd"),
          status: "active",
          categoryId: "",
          renewalType: "manual",
          notes: "",
          website: ""
        })
      }
      setErrors({})
    }
  }, [open, initialData])

  // Handle basic input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    handleFieldChange(name, value, setForm, errors, setErrors)
  }

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    handleFieldChange(name, value, setForm, errors, setErrors)
  }



  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const newErrors = validateForm(form)

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Calculate next billing date
    // For new subscriptions: next_billing_date = start_date + one billing cycle
    // For existing subscriptions: calculate based on current date
    const nextBillingDate = initialData 
      ? calculateNextBillingDateFromStart(
          new Date(form.startDate),
          new Date(),
          form.billingCycle
        )
      : calculateNextBillingDateForNewSubscription(
          new Date(form.startDate),
          form.billingCycle
        )

    // Submit the form with calculated next billing date
    onSubmit({
      ...form,
      nextBillingDate
    })
    onOpenChange(false)
  }



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initialData ? "Edit Subscription" : "Add New Subscription"}</DialogTitle>
            <DialogDescription>
              {initialData 
                ? "Update your subscription details below" 
                : "Enter the details of your subscription below"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Subscription name */}
            <FormField label="Name" error={errors.name} required>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={errors.name ? "border-destructive" : ""}
              />
            </FormField>

            {/* Subscription plan */}
            <FormField label="Plan" error={errors.plan} required>
              <Input
                id="plan"
                name="plan"
                value={form.plan}
                onChange={handleChange}
                placeholder="e.g., Premium, Family, Basic..."
                className={errors.plan ? "border-destructive" : ""}
              />
            </FormField>

            {/* Category */}
            <CategorySelector
              value={form.categoryId}
              onChange={(value) => handleFieldChange('categoryId', value, setForm, errors, setErrors)}
              categories={categories}
              error={errors.categoryId}
            />

            {/* Amount and Currency */}
            <AmountInput
              amount={form.amount}
              currency={form.currency}
              onAmountChange={(value) => handleFieldChange('amount', value, setForm, errors, setErrors)}
              onCurrencyChange={(value) => handleFieldChange('currency', value, setForm, errors, setErrors)}
              error={errors.amount}
            />

            {/* Billing Cycle */}
            <FormField label="Billing Cycle" required>
              <Select 
                value={form.billingCycle} 
                onValueChange={(value) => handleSelectChange("billingCycle", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select billing cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </FormField>



            {/* Payment Method */}
            <PaymentMethodSelector
              value={form.paymentMethodId}
              onChange={(value) => handleFieldChange('paymentMethodId', value, setForm, errors, setErrors)}
              paymentMethods={paymentMethods}
              error={errors.paymentMethodId}
            />

            {/* Start Date */}
            <FormField label="Start Date">
              <DatePicker
                value={form.startDate ? new Date(form.startDate) : undefined}
                onChange={(date) => {
                  if (date) {
                    handleFieldChange('startDate', format(date, "yyyy-MM-dd"), setForm, errors, setErrors)
                  }
                }}
                placeholder="Pick a date"
              />
            </FormField>

            {/* Status */}
            <FormField label="Status">
              <Select
                value={form.status}
                onValueChange={(value: "active" | "trial" | "cancelled") => handleSelectChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Renewal Type */}
            <FormField label="Renewal Type">
              <Select
                value={form.renewalType}
                onValueChange={(value: "auto" | "manual") => handleSelectChange("renewalType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select renewal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic Renewal</SelectItem>
                  <SelectItem value="manual">Manual Renewal</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Website */}
            <FormField label="Website">
              <Input
                id="website"
                name="website"
                value={form.website || ""}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </FormField>

            {/* Notes */}
            <FormField label="Notes">
              <Textarea
                id="notes"
                name="notes"
                value={form.notes || ""}
                onChange={handleChange}
                placeholder="Any additional information..."
              />
            </FormField>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? "Update" : "Add"} Subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}