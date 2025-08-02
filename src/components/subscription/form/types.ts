// Form validation types
export type FormErrors = {
  [key: string]: string
}

// Form data type - excludes auto-calculated fields and optional display fields
export type SubscriptionFormData = {
  name: string
  plan: string
  billingCycle: "monthly" | "quarterly" | "yearly"
  amount: number
  currency: string
  paymentMethodId: string // Changed to string for Supabase UUID
  startDate: string
  status: "active" | "trial" | "cancelled"
  categoryId: string // Changed to string for Supabase UUID
  renewalType: "auto" | "manual"
  notes: string
  website: string
}