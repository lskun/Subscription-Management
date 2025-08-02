import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Download, 
  FileText, 
  Database, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from "lucide-react"
import { dataExportService, ExportFormat } from "@/services/dataExportService"
import { useToast } from "@/hooks/use-toast"

interface ExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ExportPreview {
  subscriptionCount: number
  paymentHistoryCount: number
  categoryCount: number
  paymentMethodCount: number
  estimatedSize: string
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [includePaymentHistory, setIncludePaymentHistory] = useState(true)
  const [includeCategories, setIncludeCategories] = useState(true)
  const [includePaymentMethods, setIncludePaymentMethods] = useState(true)
  const [includeUserSettings, setIncludeUserSettings] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportMessage, setExportMessage] = useState('')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { toast } = useToast()

  // 加载导出预览
  useEffect(() => {
    if (open) {
      loadExportPreview()
    }
  }, [open])

  const loadExportPreview = async () => {
    setIsLoadingPreview(true)
    setError(null)
    
    try {
      const previewData = await dataExportService.getExportPreview()
      setPreview(previewData)
    } catch (error: any) {
      setError(error.message)
      console.error('Failed to load export preview:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // 重置状态
  const resetState = () => {
    setIsExporting(false)
    setExportProgress(0)
    setExportMessage('')
    setError(null)
  }

  // 处理模态框关闭
  const handleOpenChange = (open: boolean) => {
    if (!open && !isExporting) {
      resetState()
      onOpenChange(false)
    }
  }

  // 执行导出
  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    setExportMessage('准备导出...')
    setError(null)

    try {
      await dataExportService.exportUserData({
        format,
        includePaymentHistory,
        includeCategories,
        includePaymentMethods,
        includeUserSettings,
        onProgress: (progress, message) => {
          setExportProgress(progress)
          setExportMessage(message)
        }
      })

      toast({
        title: "导出成功",
        description: `数据已成功导出为 ${format.toUpperCase()} 格式`,
      })

      // 延迟关闭模态框，让用户看到完成状态
      setTimeout(() => {
        handleOpenChange(false)
      }, 1500)

    } catch (error: any) {
      setError(error.message)
      setExportProgress(0)
      setExportMessage('')
      
      toast({
        title: "导出失败",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  // 快速导出订阅数据
  const handleQuickExportSubscriptions = async () => {
    setIsExporting(true)
    setError(null)

    try {
      await dataExportService.exportSubscriptions(format)
      
      toast({
        title: "导出成功",
        description: "订阅数据已成功导出",
      })

      handleOpenChange(false)

    } catch (error: any) {
      setError(error.message)
      
      toast({
        title: "导出失败",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出数据
          </DialogTitle>
          <DialogDescription>
            选择要导出的数据类型和格式，系统将生成包含您所有数据的文件。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 导出进度 */}
          {isExporting && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">导出进度</span>
                    <span className="text-sm text-muted-foreground">{exportProgress}%</span>
                  </div>
                  <Progress value={exportProgress} className="w-full" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {exportMessage}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 数据预览 */}
          {!isExporting && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">数据概览</CardTitle>
                  <CardDescription>
                    以下是您账户中的数据统计
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">正在加载数据统计...</span>
                    </div>
                  ) : preview ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">订阅数据</span>
                        <span className="text-sm text-muted-foreground">{preview.subscriptionCount} 条</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">支付历史</span>
                        <span className="text-sm text-muted-foreground">{preview.paymentHistoryCount} 条</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">分类数据</span>
                        <span className="text-sm text-muted-foreground">{preview.categoryCount} 条</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">支付方式</span>
                        <span className="text-sm text-muted-foreground">{preview.paymentMethodCount} 条</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                        <span className="text-sm font-medium">预计文件大小</span>
                        <span className="text-sm font-semibold">{preview.estimatedSize}</span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* 导出格式选择 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">导出格式</CardTitle>
                  <CardDescription>
                    选择导出文件的格式
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="json" id="json" />
                      <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                        <Database className="h-4 w-4" />
                        JSON 格式
                        <span className="text-xs text-muted-foreground">（推荐，包含完整数据结构）</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="csv" id="csv" />
                      <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        CSV 格式
                        <span className="text-xs text-muted-foreground">（适合在Excel中查看）</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* 数据选择 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">包含数据</CardTitle>
                  <CardDescription>
                    选择要包含在导出文件中的数据类型
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="subscriptions" 
                      checked={true} 
                      disabled={true}
                    />
                    <Label htmlFor="subscriptions" className="text-sm font-medium">
                      订阅数据 <span className="text-xs text-muted-foreground">（必选）</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="payment-history" 
                      checked={includePaymentHistory}
                      onCheckedChange={(checked) => setIncludePaymentHistory(checked === true)}
                    />
                    <Label htmlFor="payment-history" className="text-sm font-medium">
                      支付历史
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="categories" 
                      checked={includeCategories}
                      onCheckedChange={(checked) => setIncludeCategories(checked === true)}
                    />
                    <Label htmlFor="categories" className="text-sm font-medium">
                      分类数据
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="payment-methods" 
                      checked={includePaymentMethods}
                      onCheckedChange={(checked) => setIncludePaymentMethods(checked === true)}
                    />
                    <Label htmlFor="payment-methods" className="text-sm font-medium">
                      支付方式
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="user-settings" 
                      checked={includeUserSettings}
                      onCheckedChange={(checked) => setIncludeUserSettings(checked === true)}
                    />
                    <Label htmlFor="user-settings" className="text-sm font-medium">
                      用户设置
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!isExporting && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button variant="outline" onClick={handleQuickExportSubscriptions}>
                <Download className="h-4 w-4 mr-2" />
                仅导出订阅
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                导出全部数据
              </Button>
            </>
          )}
          
          {isExporting && exportProgress === 100 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">导出完成</span>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}