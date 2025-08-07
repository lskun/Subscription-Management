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

  // Load export preview
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

  // Reset state
  const resetState = () => {
    setIsExporting(false)
    setExportProgress(0)
    setExportMessage('')
    setError(null)
  }

  // Handle modal close
  const handleOpenChange = (open: boolean) => {
    if (!open && !isExporting) {
      resetState()
      onOpenChange(false)
    }
  }

  // Execute export
  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    setExportMessage('Preparing export...')
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
        title: "Export Successful",
        description: `Data has been successfully exported as ${format.toUpperCase()} format`,
      })

      // Delay closing modal to let user see completion status
      setTimeout(() => {
        handleOpenChange(false)
      }, 1500)

    } catch (error: any) {
      setError(error.message)
      setExportProgress(0)
      setExportMessage('')
      
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Quick export subscription data
  const handleQuickExportSubscriptions = async () => {
    setIsExporting(true)
    setError(null)

    try {
      await dataExportService.exportSubscriptions(format)
      
      toast({
        title: "Export Successful",
        description: "Subscription data has been successfully exported",
      })

      handleOpenChange(false)

    } catch (error: any) {
      setError(error.message)
      
      toast({
        title: "Export Failed",
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
            Export Data
          </DialogTitle>
          <DialogDescription>
            Select the data types and format to export, the system will generate a file containing all your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Export progress */}
          {isExporting && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Export Progress</span>
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

          {/* Data preview */}
          {!isExporting && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Data Overview</CardTitle>
                  <CardDescription>
                    Statistics of data in your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading data statistics...</span>
                    </div>
                  ) : preview ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Subscription Data</span>
                        <span className="text-sm text-muted-foreground">{preview.subscriptionCount} records</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Payment History</span>
                        <span className="text-sm text-muted-foreground">{preview.paymentHistoryCount} records</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Category Data</span>
                        <span className="text-sm text-muted-foreground">{preview.categoryCount} records</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">Payment Methods</span>
                        <span className="text-sm text-muted-foreground">{preview.paymentMethodCount} records</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                        <span className="text-sm font-medium">Estimated File Size</span>
                        <span className="text-sm font-semibold">{preview.estimatedSize}</span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Export format selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Export Format</CardTitle>
                  <CardDescription>
                    Select the format for the export file
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="json" id="json" />
                      <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                        <Database className="h-4 w-4" />
                        JSON Format
                        <span className="text-xs text-muted-foreground">(Recommended, contains complete data structure)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="csv" id="csv" />
                      <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        CSV Format
                        <span className="text-xs text-muted-foreground">(Suitable for viewing in Excel)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Data selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Include Data</CardTitle>
                  <CardDescription>
                    Select the data types to include in the export file
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
                      Subscription Data <span className="text-xs text-muted-foreground">(Required)</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="payment-history" 
                      checked={includePaymentHistory}
                      onCheckedChange={(checked) => setIncludePaymentHistory(checked === true)}
                    />
                    <Label htmlFor="payment-history" className="text-sm font-medium">
                      Payment History
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="categories" 
                      checked={includeCategories}
                      onCheckedChange={(checked) => setIncludeCategories(checked === true)}
                    />
                    <Label htmlFor="categories" className="text-sm font-medium">
                      Category Data
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="payment-methods" 
                      checked={includePaymentMethods}
                      onCheckedChange={(checked) => setIncludePaymentMethods(checked === true)}
                    />
                    <Label htmlFor="payment-methods" className="text-sm font-medium">
                      Payment Methods
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="user-settings" 
                      checked={includeUserSettings}
                      onCheckedChange={(checked) => setIncludeUserSettings(checked === true)}
                    />
                    <Label htmlFor="user-settings" className="text-sm font-medium">
                      User Settings
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
                Cancel
              </Button>
              <Button variant="outline" onClick={handleQuickExportSubscriptions}>
                <Download className="h-4 w-4 mr-2" />
                Export Subscriptions Only
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export All Data
              </Button>
            </>
          )}
          
          {isExporting && exportProgress === 100 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Export Complete</span>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}