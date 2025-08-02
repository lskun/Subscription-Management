import { Check, AlertTriangle, Info, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { SubscriptionImportData } from "../types"

interface ReviewStepProps {
  subscriptions: SubscriptionImportData[]
  errors: string[]
  duplicates?: string[]
}

export function ReviewStep({ subscriptions, errors, duplicates = [] }: ReviewStepProps) {
  return (
    <div className="space-y-6 py-4">
      {/* 错误提示 */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>验证错误</AlertTitle>
          <AlertDescription>
            {errors.length === 1 ? (
              errors[0]
            ) : (
              <div className="mt-2">
                <p className="mb-1">发现 {errors.length} 个错误:</p>
                <ScrollArea className="h-20 rounded border p-2">
                  <ul className="text-sm space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="list-disc ml-4">
                        {error}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 重复项提示 */}
      {duplicates.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>检测到重复项</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <p className="mb-1">发现 {duplicates.length} 个重复项（将被跳过）:</p>
              <ScrollArea className="h-20 rounded border p-2">
                <ul className="text-sm space-y-1">
                  {duplicates.map((duplicate, index) => (
                    <li key={index} className="list-disc ml-4">
                      {duplicate}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium">发现 {subscriptions.length} 个订阅</p>
            {duplicates.length > 0 && (
              <Badge variant="secondary">
                {duplicates.length} 个重复项
              </Badge>
            )}
          </div>
          {subscriptions.length > 0 && errors.length === 0 && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              <Check className="mr-1 h-3 w-3" /> 准备导入
            </span>
          )}
        </div>
        
        {subscriptions.length > 0 && (
          <div className="border rounded-lg">
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 text-sm font-medium">
              <div>名称</div>
              <div>金额</div>
              <div>状态</div>
            </div>
            <Separator />
            <ScrollArea className="h-60">
              <div className="p-1">
                {subscriptions.map((subscription, index) => (
                  <div 
                    key={index} 
                    className="grid grid-cols-3 gap-2 p-2 text-sm hover:bg-muted/50 rounded-md"
                  >
                    <div className="font-medium">{subscription.name}</div>
                    <div>
                      {subscription.amount} {subscription.currency}
                    </div>
                    <div>
                      <span 
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
                          ${subscription.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                            subscription.status === 'trial' ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' :
                            'bg-red-50 text-red-700 ring-red-600/20'} 
                          ring-1 ring-inset`}
                      >
                        {subscription.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}