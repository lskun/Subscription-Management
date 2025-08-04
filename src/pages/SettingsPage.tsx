import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Download, Upload, Eye, EyeOff } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useConfirmation } from "@/hooks/use-confirmation"

import { useSettingsStore, ThemeType } from "@/store/settingsStore"
import { ImportModal } from "@/components/imports/ImportModal"
import { useSubscriptionStore } from "@/store/subscriptionStore"
import {
  exportSubscriptionsToJSON,
  downloadFile,
} from "@/lib/subscription-utils"
import { useToast } from "@/hooks/use-toast"
import { ExchangeRateManager } from "@/components/ExchangeRateManager"
import { OptionsManager } from "@/components/subscription/OptionsManager"
import { useTheme } from "next-themes"
import { SessionManager } from "@/components/auth/SessionManager"
import { SessionManagementExample } from "@/components/auth/SessionManagementExample"
import { UserProfileForm } from "@/components/user/UserProfileForm"
import { UserPreferencesForm } from "@/components/user/UserPreferencesForm"
import { useAuth } from "@/contexts/AuthContext"

export function SettingsPage() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  // Get tab from URL params
  const defaultTab = searchParams.get('tab') || 'profile'

  // Theme from next-themes
  const { setTheme: setNextTheme } = useTheme()

  // Settings store values
  const {
    apiKey,
    setApiKey,
    theme,
    setTheme,
    resetSettings,
    isLoading,
    fetchSettings
  } = useSettingsStore()

  // API Key local state
  const [tempApiKey, setTempApiKey] = useState(apiKey || "")
  const [isKeyVisible, setIsKeyVisible] = useState(false)

  // Subscription store methods
  const { subscriptions, resetSubscriptions, addSubscription } = useSubscriptionStore()

  useEffect(() => {
    fetchSettings()
  }, []) // Remove dependencies to prevent infinite re-renders

  // When the API key from the store changes, update the local state
  useEffect(() => {
    if (apiKey) {
      setTempApiKey(apiKey)
    }
  }, [apiKey])



  const handleSaveApiKey = async () => {
    await setApiKey(tempApiKey)
    toast({
      title: "API Key Saved",
      description: "Your new API key has been securely saved.",
    })
  }

  // Handle data export
  const handleExportData = () => {
    const data = exportSubscriptionsToJSON(subscriptions)
    downloadFile(data, "subscriptions.json", "application/json")
  }

  // Handle imports
  const handleImportData = (subscriptionData: any[]) => {
    subscriptionData.forEach((sub) => {
      addSubscription(sub)
    })
  }

  // Handle data reset with confirmation
  const handleResetData = async () => {
    await resetSubscriptions()
    await resetSettings()
    window.location.reload()
  }

  const resetConfirmation = useConfirmation({
    title: "Reset All Data",
    description: "Are you sure you want to reset all data? This will permanently delete all subscriptions, payment history, and settings. This action cannot be undone.",
    confirmText: "Reset All Data",
    onConfirm: handleResetData,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
      </div>

      <Tabs defaultValue={defaultTab}>
        <div className="overflow-x-auto mb-4 sm:overflow-visible">
          <TabsList className="mb-4 min-w-max sm:min-w-0">
            <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 sm:px-3">Profile</TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs sm:text-sm px-2 sm:px-3">Preferences</TabsTrigger>
            <TabsTrigger value="currency" className="text-xs sm:text-sm px-2 sm:px-3">Currency</TabsTrigger>
            <TabsTrigger value="options" className="text-xs sm:text-sm px-2 sm:px-3">Options</TabsTrigger>
            <TabsTrigger value="session" className="text-xs sm:text-sm px-2 sm:px-3">Session</TabsTrigger>
            <TabsTrigger value="data" className="text-xs sm:text-sm px-2 sm:px-3">Data</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-4">
          {user ? (
            <UserProfileForm user={user} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Please sign in to manage your profile</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          {user ? (
            <UserPreferencesForm user={user} />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Please sign in to manage your preferences</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="currency" className="space-y-4">
          <ExchangeRateManager />
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          <OptionsManager />
        </TabsContent>

        <TabsContent value="session" className="space-y-4">
          <SessionManager
            showHealthCheck={true}
            showDetailedInfo={true}
            autoRefresh={false}
          />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API & Synchronization</CardTitle>
              <CardDescription>
                Manage your API key for backend synchronization. This key is stored locally.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="api-key"
                    type={isKeyVisible ? "text" : "password"}
                    placeholder="Enter your API key"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsKeyVisible(!isKeyVisible)}
                  >
                    {isKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  The API key is required for creating, updating, or deleting subscriptions.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveApiKey}>Save API Key</Button>
            </CardFooter>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Export your subscriptions or import from another service
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button variant="outline" onClick={handleExportData}>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Data
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-4 border-destructive">
            <CardHeader>
              <CardTitle>Reset Data</CardTitle>
              <CardDescription>
                This will permanently delete all your subscriptions and settings.
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={resetConfirmation.openDialog}>
                Reset All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <ImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImportData}
      />

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog {...resetConfirmation.dialogProps} />
    </>
  )
}
