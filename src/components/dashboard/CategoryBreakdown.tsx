import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrencyAmount } from "@/utils/currency"

type CategoryItem = { category: string; label: string; amount: number }

interface CategoryBreakdownProps {
  // 兼容旧用法：传入 category → amount 的映射（将基于 store 的 categories 推断 label）
  data?: Record<string, number>
  // 新用法：直接传入带 label 的分类条目（推荐，避免额外请求 categories）
  items?: CategoryItem[]
}

export function CategoryBreakdown({ data, items }: CategoryBreakdownProps) {
  // Get categories from the store for labels（作为旧用法的兜底）
  const { categories } = useSubscriptionStore()
  // Get user's preferred currency
  const { currency: userCurrency } = useSettingsStore()

  // 新用法优先：直接使用带 label 的 items
  const normalized: CategoryItem[] = items && items.length > 0
    ? [...items]
    : Object.entries(data || {})
        .map(([category, amount]) => {
          const found = categories.find(c => c.value === category)
          return { category, label: found?.label || category, amount }
        })
        .filter(x => x.amount > 0)

  // Calculate total
  const total = normalized.reduce((sum, it) => sum + it.amount, 0)

  // Sort categories by amount (descending)
  const sorted = [...normalized].sort((a, b) => b.amount - a.amount)
  
  return (
    <Card className="min-h-[200px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">Spending by Category</CardTitle>
        <CardDescription>Annual breakdown by category</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground">
              No spending data available
            </p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {sorted.map((item) => {
              const value = item.amount
              const percentage = total > 0 ? (value / total) * 100 : 0
              
              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.category}</span>
                    <span className="font-medium">
                      {formatCurrencyAmount(item.amount, userCurrency)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary overflow-hidden rounded-full">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {percentage.toFixed(1)}%
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