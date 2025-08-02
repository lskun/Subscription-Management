import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// Import types and utilities
import { SubscriptionImportData, ImportStep } from "./types"
import { parseFileContent } from "./fileParser"
import { dataImportService, ImportOptions, ImportResult } from "@/services/dataImportService"

// Import step components
import { FileUploadStep } from "./steps/FileUploadStep"
import { FileValidationStep } from "./steps/FileValidationStep"
import { ReviewStep } from "./steps/ReviewStep"
import { CompleteStep } from "./steps/CompleteStep"

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (subscriptions: SubscriptionImportData[]) => void
}

export function ImportModal({
  open,
  onOpenChange,
  onImport
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>(ImportStep.Upload)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [subscriptions, setSubscriptions] = useState<SubscriptionImportData[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [importOptions, setImportOptions] = useState<Partial<ImportOptions>>({
    duplicateDetection: {
      checkByName: true,
      checkByNameAndAmount: false,
      checkByWebsite: false,
      skipDuplicates: true
    },
    validateData: true,
    createMissingCategories: true,
    createMissingPaymentMethods: true
  })

  // Reset state when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(ImportStep.Upload)
      setFile(null)
      setProgress(0)
      setSubscriptions([])
      setErrors([])
      setIsProcessing(false)
      setImportResult(null)
      setDuplicates([])
    }
    onOpenChange(open)
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setProgress(25)
      setTimeout(() => {
        setStep(ImportStep.Validate)
      }, 500)
    }
  }

  // Handle file validation using new import service
  const validateFile = async () => {
    if (!file) return
    
    setIsProcessing(true)
    setProgress(25)
    setErrors([])
    setSubscriptions([])
    
    try {
      // 获取文件预览
      const preview = await dataImportService.getImportPreview(file)
      setProgress(50)
      
      if (preview.errors.length > 0) {
        setErrors(preview.errors)
        setProgress(75)
        setIsProcessing(false)
        setStep(ImportStep.Review)
        return
      }
      
      // 解析文件内容
      let parseResult
      if (file.name.endsWith('.csv')) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = () => reject(new Error('文件读取失败'))
          reader.readAsText(file)
        })
        parseResult = await dataImportService.parseCSVFile(content)
      } else if (file.name.endsWith('.json')) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = () => reject(new Error('文件读取失败'))
          reader.readAsText(file)
        })
        parseResult = await dataImportService.parseJSONFile(content)
      } else {
        setErrors(['不支持的文件格式，请上传CSV或JSON文件'])
        setProgress(75)
        setIsProcessing(false)
        setStep(ImportStep.Review)
        return
      }
      
      setSubscriptions(parseResult.subscriptions)
      setErrors(parseResult.errors)
      setProgress(100)
      setIsProcessing(false)
      setStep(ImportStep.Review)
      
    } catch (error: any) {
      setErrors([`文件验证失败: ${error.message}`])
      setProgress(75)
      setIsProcessing(false)
      setStep(ImportStep.Review)
    }
  }

  // Handle import completion using new import service
  const completeImport = async () => {
    if (!file) return
    
    setIsProcessing(true)
    setProgress(0)
    
    try {
      const result = await dataImportService.importFromFile(file, {
        ...importOptions,
        onProgress: (progress, message) => {
          setProgress(progress)
        }
      })
      
      setImportResult(result)
      setDuplicates(result.duplicates)
      
      if (result.success) {
        // 调用原有的导入回调（用于刷新UI）
        onImport(subscriptions)
        setStep(ImportStep.Complete)
      } else {
        setErrors(result.errors)
        setStep(ImportStep.Review)
      }
      
    } catch (error: any) {
      setErrors([`导入失败: ${error.message}`])
      setStep(ImportStep.Review)
    } finally {
      setIsProcessing(false)
    }
  }

  // Render content based on current step
  const renderStepContent = () => {
    switch (step) {
      case ImportStep.Upload:
        return <FileUploadStep file={file} onFileChange={handleFileChange} />
      
      case ImportStep.Validate:
        return <FileValidationStep file={file} progress={progress} />
      
      case ImportStep.Review:
        return <ReviewStep subscriptions={subscriptions} errors={errors} duplicates={duplicates} />
      
      case ImportStep.Complete:
        return <CompleteStep subscriptionCount={subscriptions.length} importResult={importResult} />
    }
  }

  // Render footer buttons based on current step
  const renderFooterButtons = () => {
    switch (step) {
      case ImportStep.Upload:
        return (
          <>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button 
              disabled={!file}
              onClick={() => file && setStep(ImportStep.Validate)}
            >
              继续
            </Button>
          </>
        )
      
      case ImportStep.Validate:
        return (
          <>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button 
              disabled={isProcessing}
              onClick={validateFile}
            >
              {isProcessing ? "验证中..." : "验证文件"}
            </Button>
          </>
        )
      
      case ImportStep.Review:
        return (
          <>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button 
              disabled={subscriptions.length === 0 || errors.length > 0 || isProcessing}
              onClick={completeImport}
            >
              {isProcessing ? "导入中..." : `导入 ${subscriptions.length} 个订阅`}
            </Button>
          </>
        )
      
      case ImportStep.Complete:
        return (
          <Button onClick={() => handleOpenChange(false)}>
            关闭
          </Button>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>导入订阅数据</DialogTitle>
          <DialogDescription>
            上传CSV或JSON文件来批量导入订阅数据。支持重复检测和数据验证。
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress indicator */}
        <div className="relative mb-2">
          <div className="overflow-hidden h-1 flex rounded bg-muted">
            <div
              style={{ width: `${progress}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <div className={step >= ImportStep.Upload ? "text-primary font-medium" : ""}>
              选择文件
            </div>
            <div className={step >= ImportStep.Validate ? "text-primary font-medium" : ""}>
              验证
            </div>
            <div className={step >= ImportStep.Review ? "text-primary font-medium" : ""}>
              预览
            </div>
            <div className={step >= ImportStep.Complete ? "text-primary font-medium" : ""}>
              完成
            </div>
          </div>
        </div>
        
        {renderStepContent()}
        
        <DialogFooter>
          {renderFooterButtons()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}