import { Check, AlertCircle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ImportResult } from "@/services/dataImportService"

interface CompleteStepProps {
  subscriptionCount: number
  importResult?: ImportResult | null
}

export function CompleteStep({ subscriptionCount, importResult }: CompleteStepProps) {
  return (
    <div className="py-12 text-center space-y-6">
      <div className="mx-auto rounded-full bg-green-100 p-3 w-16 h-16 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium">导入完成</h3>
        {importResult ? (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              成功导入 {importResult.imported} 个订阅
            </p>
            
            {/* 导入统计 */}
            <div className="flex justify-center gap-2 flex-wrap">
              <Badge variant="default">
                导入: {importResult.imported}
              </Badge>
              {importResult.skipped > 0 && (
                <Badge variant="secondary">
                  跳过: {importResult.skipped}
                </Badge>
              )}
              {importResult.duplicates.length > 0 && (
                <Badge variant="outline">
                  重复: {importResult.duplicates.length}
                </Badge>
              )}
            </div>
            
            {/* 详细信息 */}
            {importResult.details.subscriptions > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Info className="h-4 w-4" />
                  <span>订阅数据: {importResult.details.subscriptions} 条</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            成功导入 {subscriptionCount} 个订阅
          </p>
        )}
      </div>
    </div>
  )
}