import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, CreditCard, FileText, Eye, Clock } from "lucide-react"
import { Subscription } from "@/store/subscriptionStore"
import { formatWithUserCurrency } from "@/utils/currency"
import { format } from "date-fns"

interface SubscriptionSuccessDialogProps {
  subscription: Subscription
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPayment: () => void
  onImportPayments: () => void
  onViewDetails: () => void
}

/**
 * Subscription creation success dialog component
 * Displays detailed information of newly created subscription and provides follow-up action options
 */
export function SubscriptionSuccessDialog({
  subscription,
  open,
  onOpenChange,
  onAddPayment,
  onImportPayments,
  onViewDetails
}: SubscriptionSuccessDialogProps) {
  /**
   * Get status display style
   */
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'cancelled':
        return 'secondary'
      case 'expired':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  /**
   * Get status display text
   */
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'cancelled':
        return 'Cancelled'
      case 'expired':
        return 'Expired'
      default:
        return status
    }
  }

  /**
   * Get billing cycle display text
   */
  const getBillingCycleText = (cycle: string) => {
    switch (cycle) {
      case 'monthly':
        return 'Monthly'
      case 'quarterly':
        return 'Quarterly'
      case 'yearly':
        return 'Yearly'
      default:
        return cycle
    }
  }

  /**
   * Handle later button click
   */
  const handleLater = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Subscription Created Successfully!</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Your subscription has been successfully added to the system
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Subscription Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{subscription.name}</h3>
              <Badge variant={getStatusVariant(subscription.status)}>
                {getStatusText(subscription.status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-medium ml-1">
                  {formatWithUserCurrency(subscription.amount, subscription.currency)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Billing Cycle:</span>
                <span className="font-medium ml-1">
                  {getBillingCycleText(subscription.billingCycle)}
                </span>
              </div>
              {subscription.nextBillingDate && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Next Billing:</span>
                  <span className="font-medium ml-1">
                    {format(new Date(subscription.nextBillingDate), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
            </div>

            {subscription.notes && (
              <div>
                <span className="text-muted-foreground text-sm">Notes:</span>
                <p className="text-sm mt-1">{subscription.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Follow-up Action Suggestions */}
          <div className="space-y-3">
            <h4 className="font-medium text-base">What you can do next:</h4>
            <div className="grid gap-3">
              <Button
                onClick={onAddPayment}
                className="justify-start h-auto p-4"
                variant="outline"
              >
                <CreditCard className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Add Payment Record Now</div>
                  <div className="text-sm text-muted-foreground">
                    Record your first payment information
                  </div>
                </div>
              </Button>

              <Button
                onClick={onImportPayments}
                className="justify-start h-auto p-4"
                variant="outline"
              >
                <FileText className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Import Payment History</div>
                  <div className="text-sm text-muted-foreground">
                    Bulk import existing payment data
                  </div>
                </div>
              </Button>

              <Button
                onClick={onViewDetails}
                className="justify-start h-auto p-4"
                variant="outline"
              >
                <Eye className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">View Subscription Details</div>
                  <div className="text-sm text-muted-foreground">
                    View complete subscription information and settings
                  </div>
                </div>
              </Button>
            </div>
          </div>

          <Separator />

          {/* Bottom Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleLater}
              variant="ghost"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}