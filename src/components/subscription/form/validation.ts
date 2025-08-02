import { FormErrors, SubscriptionFormData } from "./types"

export const validateForm = (form: SubscriptionFormData): FormErrors => {
  const errors: FormErrors = {}

  if (!form.name) errors.name = "Name is required"
  if (!form.plan) errors.plan = "Subscription plan is required"
  if (!form.categoryId || form.categoryId === "") errors.categoryId = "Category is required"
  if (!form.paymentMethodId || form.paymentMethodId === "") errors.paymentMethodId = "Payment method is required"
  if (form.amount <= 0) errors.amount = "Amount must be greater than 0"

  return errors
}

export const handleFieldChange = (
  name: string,
  value: any,
  setForm: React.Dispatch<React.SetStateAction<SubscriptionFormData>>,
  errors: FormErrors,
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>
) => {
  setForm(prev => ({ ...prev, [name]: value }))
  
  // Clear error for this field if any
  if (errors[name]) {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[name]
      return newErrors
    })
  }
}