import { parseCSVToSubscriptions } from "@/lib/subscription-utils"
import { SubscriptionImportData } from "./types"

export const parseFileContent = (
  file: File,
  content: string,
  setSubscriptions: (subs: SubscriptionImportData[]) => void,
  setErrors: (errors: string[]) => void
) => {
  try {
    // Check file type based on extension
    if (file.name.endsWith('.csv')) {
      // Parse CSV file
      const result = parseCSVToSubscriptions(content)
      setSubscriptions(result.subscriptions)
      setErrors(result.errors)
    } else if (file.name.endsWith('.json')) {
      // Parse JSON file
      const data = JSON.parse(content)
      
      // Check if it's our storage format
      if (data.state?.subscriptions && Array.isArray(data.state.subscriptions)) {
        setSubscriptions(data.state.subscriptions.map((sub: any) => ({
          name: sub.name,
          plan: sub.plan,
          billingCycle: sub.billingCycle,
          nextBillingDate: sub.nextBillingDate,
          amount: sub.amount,
          convertedAmount: sub.convertedAmount || sub.amount,
          currency: sub.currency,
          paymentMethodId: sub.paymentMethodId || '1',
          startDate: sub.startDate,
          status: sub.status,
          categoryId: sub.categoryId || '10',
          renewalType: sub.renewalType || 'manual',
          notes: sub.notes,
          website: sub.website,
        })))
      } else if (Array.isArray(data)) {
        // Check if it's a direct array of subscriptions
        if (data.length > 0 && 'name' in data[0] && 'amount' in data[0]) {
          setSubscriptions(data.map((sub: any) => ({
            name: sub.name || 'Unknown Subscription',
            plan: sub.plan || 'Basic',
            billingCycle: sub.billingCycle || 'monthly',
            nextBillingDate: sub.nextBillingDate || new Date().toISOString().split('T')[0],
            amount: Number(sub.amount) || 0,
            convertedAmount: Number(sub.convertedAmount) || Number(sub.amount) || 0,
            currency: sub.currency || 'USD',
            paymentMethodId: sub.paymentMethodId || '1',
            startDate: sub.startDate || new Date().toISOString().split('T')[0],
            status: sub.status || 'active',
            categoryId: sub.categoryId || '10',
            renewalType: sub.renewalType || 'manual',
            notes: sub.notes || '',
            website: sub.website || '',
          })))
        } else {
          setErrors(['Invalid JSON format. Expected an array of subscription objects.'])
        }
      } else if ('subscriptions' in data && Array.isArray(data.subscriptions)) {
        // Format with direct subscriptions property
        setSubscriptions(data.subscriptions.map((sub: any) => ({
          name: sub.name || 'Unknown Subscription',
          plan: sub.plan || 'Basic',
          billingCycle: sub.billingCycle || 'monthly',
          nextBillingDate: sub.nextBillingDate || new Date().toISOString().split('T')[0],
          amount: Number(sub.amount) || 0,
          convertedAmount: Number(sub.convertedAmount) || Number(sub.amount) || 0,
          currency: sub.currency || 'USD',
          paymentMethodId: sub.paymentMethodId || '1',
          startDate: sub.startDate || new Date().toISOString().split('T')[0],
          status: sub.status || 'active',
          categoryId: sub.categoryId || '10',
          renewalType: sub.renewalType || 'manual',
          notes: sub.notes || '',
          website: sub.website || '',
        })))
      } else {
        setErrors(['Invalid JSON format. Expected a subscription data structure.'])
      }
    } else {
      setErrors(['Unsupported file format. Please upload a CSV or JSON file.'])
    }
  } catch (error: any) {
    setErrors([`Error parsing file: ${error.message}`])
  }
}