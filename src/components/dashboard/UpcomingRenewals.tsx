import { Calendar, CalendarIcon } from "lucide-react"
// Simplified subscription interface for dashboard display
interface DashboardSubscription {
  id: string
  name: string
  plan?: string
  amount: number
  currency: string
  originalAmount?: number // Original amount
  originalCurrency?: string // Original currency
  nextBillingDate: string
  billingCycle: string
  status: 'active'
}
import { formatDate, daysUntil } from "@/lib/subscription-utils"
import { formatWithUserCurrency, formatCurrencyAmount } from "@/utils/currency"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/store/settingsStore";

interface UpcomingRenewalsProps {
  subscriptions: DashboardSubscription[]
  className?: string
}

export function UpcomingRenewals({ subscriptions, className }: UpcomingRenewalsProps) {
  const { currency: userCurrency } = useSettingsStore()
  const getBadgeVariant = (daysLeft: number) => {
    if (daysLeft <= 3) return "destructive"
    if (daysLeft <= 7) return "warning"
    return "secondary"
  }
  
  const getTimeLabel = (daysLeft: number) => {
    if (daysLeft === 0) return "Today"
    if (daysLeft === 1) return "Tomorrow"
    return `${daysLeft} days`
  }

  return (
    <Card className={cn("min-h-[200px] flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">Upcoming Renewals</CardTitle>
        <CardDescription>
          Subscriptions renewing in the next 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {subscriptions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Calendar className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
            <p className="text-muted-foreground">No upcoming renewals for the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {subscriptions.map((subscription) => {
              const daysRemaining = daysUntil(subscription.nextBillingDate)
              return (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <div className="font-medium">{subscription.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {subscription.plan || subscription.billingCycle}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-medium">
                      {subscription.originalAmount && subscription.originalCurrency
                        ? (
                            // 若用户偏好币种与原始币种一致，仅显示原始金额；否则显示“已转换金额(原始金额)”
                            userCurrency === subscription.originalCurrency
                              ? formatCurrencyAmount(subscription.originalAmount, subscription.originalCurrency)
                              : `${formatCurrencyAmount(subscription.amount, subscription.currency)}(${formatCurrencyAmount(subscription.originalAmount, subscription.originalCurrency)})`
                          )
                        : formatWithUserCurrency(subscription.amount, subscription.currency)
                      }                     
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(subscription.nextBillingDate)}
                      </div>
                    </div>
                    <Badge variant={getBadgeVariant(daysRemaining)}>
                      {getTimeLabel(daysRemaining)}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}