import { useState } from "react"
import { Calendar, Filter, Search, X } from "lucide-react"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export interface PaymentHistoryFilters {
  searchTerm: string
  status: string
  startDate: Date | null
  endDate: Date | null
  currency: string
}

interface PaymentHistoryFiltersProps {
  filters: PaymentHistoryFilters
  onFiltersChange: (filters: PaymentHistoryFilters) => void
  onClearFilters: () => void
  className?: string
}

export function PaymentHistoryFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  className
}: PaymentHistoryFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  const updateFilter = (key: keyof PaymentHistoryFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const hasActiveFilters = 
    filters.searchTerm ||
    filters.status !== 'all' ||
    filters.startDate ||
    filters.endDate ||
    filters.currency !== 'all'

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.searchTerm) count++
    if (filters.status !== 'all') count++
    if (filters.startDate || filters.endDate) count++
    if (filters.currency !== 'all') count++
    return count
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      {/* 搜索框 */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索支付记录..."
          value={filters.searchTerm}
          onChange={(e) => updateFilter('searchTerm', e.target.value)}
          className="pl-10 text-sm h-9"
        />
      </div>

      {/* 筛选器弹出框 */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
          >
            <Filter className="h-4 w-4" />
            筛选
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">筛选条件</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearFilters()
                    setIsOpen(false)
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  清除
                </Button>
              )}
            </div>

            {/* 支付状态筛选 */}
            <div className="space-y-2">
              <Label className="text-sm">支付状态</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="succeeded">成功</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="refunded">已退款</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 货币筛选 */}
            <div className="space-y-2">
              <Label className="text-sm">货币</Label>
              <Select
                value={filters.currency}
                onValueChange={(value) => updateFilter('currency', value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="选择货币" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部货币</SelectItem>
                  <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                  <SelectItem value="USD">美元 (USD)</SelectItem>
                  <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                  <SelectItem value="GBP">英镑 (GBP)</SelectItem>
                  <SelectItem value="JPY">日元 (JPY)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 日期范围筛选 */}
            <div className="space-y-2">
              <Label className="text-sm">支付日期范围</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">开始日期</Label>
                  <DatePicker
                    value={filters.startDate}
                    onChange={(date) => updateFilter('startDate', date)}
                    placeholder="开始日期"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">结束日期</Label>
                  <DatePicker
                    value={filters.endDate}
                    onChange={(date) => updateFilter('endDate', date)}
                    placeholder="结束日期"
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* 应用按钮 */}
            <Button
              onClick={() => setIsOpen(false)}
              className="w-full h-9"
              size="sm"
            >
              应用筛选
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* 清除筛选按钮 */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="gap-2 h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          清除筛选
        </Button>
      )}
    </div>
  )
}