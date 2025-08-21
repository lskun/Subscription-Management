import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrencyAmount } from "@/utils/currency"
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Eye,
  ChevronRight,
  Lock,
  Crown
} from "lucide-react"
import { ExpenseDetailDialog } from "./ExpenseDetailDialog"

export interface ExpenseInfoData {
  period: string
  periodType: 'monthly' | 'quarterly' | 'yearly'
  totalSpent: number
  dailyAverage: number
  activeSubscriptions: number
  paymentCount: number
  startDate: string
  endDate: string
  currency: string
}

interface ExpenseInfoCardsProps {
  monthlyData: ExpenseInfoData[]
  quarterlyData: ExpenseInfoData[]
  yearlyData: ExpenseInfoData[]
  currency: string
  isLoading?: boolean
  className?: string
  hasMonthlyPermission?: boolean
  hasQuarterlyPermission?: boolean
  hasYearlyPermission?: boolean
}

export function ExpenseInfoCards({
  monthlyData,
  quarterlyData,
  yearlyData,
  currency,
  isLoading = false,
  className,
  hasMonthlyPermission = true,
  hasQuarterlyPermission = true,
  hasYearlyPermission = true
}: ExpenseInfoCardsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<ExpenseInfoData | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  const PremiumFeatureCard = ({ feature }: { feature: string }) => (
    <Card className="border-dashed border-amber-200">
      <CardContent className="flex flex-col items-center justify-center h-32 text-center">
        <Lock className="h-8 w-8 text-amber-500 mb-2" />
        <h4 className="font-semibold text-amber-700 mb-1">
          {feature} - Premium Feature
        </h4>
      </CardContent>
    </Card>
  )


  const handleViewDetails = (data: ExpenseInfoData) => {
    setSelectedPeriod(data)
    setIsDetailDialogOpen(true)
  }

  const renderExpenseCard = (data: ExpenseInfoData, index: number) => {
    const getPeriodIcon = () => {
      switch (data.periodType) {
        case 'monthly':
          return <Calendar className="h-4 w-4 text-blue-500" />
        case 'quarterly':
          return <Calendar className="h-4 w-4 text-green-500" />
        case 'yearly':
          return <Calendar className="h-4 w-4 text-purple-500" />
      }
    }

    const getPeriodColor = () => {
      switch (data.periodType) {
        case 'monthly':
          return 'border-blue-200 hover:border-blue-300'
        case 'quarterly':
          return 'border-green-200 hover:border-green-300'
        case 'yearly':
          return 'border-purple-200 hover:border-purple-300'
      }
    }

    return (
      <Card
        key={`${data.periodType}-${index}`}
        className={`transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer ${getPeriodColor()} group`}
        onClick={() => handleViewDetails(data)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {getPeriodIcon()}
            <CardTitle className="text-sm font-medium">{data.period}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total Spent */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <span className="text-lg font-bold">
              {formatCurrencyAmount(data.totalSpent, currency)}
            </span>
          </div>

          {/* Daily Average */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Daily Avg</span>
            </div>
            <span className="text-sm font-medium">
              {formatCurrencyAmount(data.dailyAverage, currency)}
            </span>
          </div>

          {/* Payment Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Payments</span>
            </div>
            <span className="text-sm font-medium">
              {data.paymentCount}
            </span>
          </div>

          {/* View Details Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              handleViewDetails(data)
            }}
          >
            View Details
            <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Monthly Data */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          Monthly Expenses
        </h3>
        {!hasMonthlyPermission ? (
          <PremiumFeatureCard feature="Monthly Analysis" />
        ) : monthlyData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {monthlyData.slice(-4).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No monthly data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quarterly Data */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-500" />
          Quarterly Expenses
        </h3>
        {!hasQuarterlyPermission ? (
          <PremiumFeatureCard feature="Quarterly Analysis" />
        ) : quarterlyData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quarterlyData.slice(0, 3).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No quarterly data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Yearly Data */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-purple-500" />
          Yearly Expenses
        </h3>
        {!hasYearlyPermission ? (
          <PremiumFeatureCard feature="Yearly Analysis" />
        ) : yearlyData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {yearlyData.slice(0, 3).map((data, index) => renderExpenseCard(data, index))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No yearly data available</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedPeriod && (
        <ExpenseDetailDialog
          isOpen={isDetailDialogOpen}
          onClose={() => setIsDetailDialogOpen(false)}
          periodData={selectedPeriod}
        />
      )}
    </div>
  )
}
