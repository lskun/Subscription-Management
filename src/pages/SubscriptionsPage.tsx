import { useState, useCallback } from "react"
import { 
  Calendar, 
  Plus, 
  Search, 
  Tags,
  Check,
  Download,
  Upload,
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { useToast } from "@/hooks/use-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useConfirmation } from "@/hooks/use-confirmation"

import { 
  useSubscriptionStore, 
  Subscription, 
  SubscriptionStatus,
  BillingCycle
} from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useSubscriptionsData } from "@/hooks/useSubscriptionsData"
import { SubscriptionData } from "@/services/subscriptionsEdgeFunctionService"
import { exportSubscriptionsToCSV } from "@/lib/subscription-utils"

import { SubscriptionCard } from "@/components/subscription/SubscriptionCard"
import { SubscriptionForm } from "@/components/subscription/SubscriptionForm"
import { SubscriptionDetailDialog } from "@/components/subscription/SubscriptionDetailDialog"
import { ImportModal } from "@/components/imports/ImportModal"
import { ExportModal } from "@/components/exports/ExportModal"

export function SubscriptionsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [currentView, setCurrentView] = useState<"all" | "active" | "cancelled">("all")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<BillingCycle[]>([])
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false)
  const [billingCycleFilterOpen, setBillingCycleFilterOpen] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [detailSubscription, setDetailSubscription] = useState<Subscription | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  const { currency: userCurrency } = useSettingsStore()
  
  // Use the new subscriptions data hook
  const {
    subscriptions,
    categories,
    paymentMethods,
    summary,
    isLoading,
    error: subscriptionsError,
    currentFilters,
    currentSorting,
    refreshData,
    updateFilters,
    updateSorting,
    searchSubscriptions,
    filterByStatus,
    filterByCategories,
    filterByBillingCycles
  } = useSubscriptionsData()

  // Still need subscription store for CRUD operations
  const {
    addSubscription,
    bulkAddSubscriptions,
    updateSubscription,
    deleteSubscription,
    fetchSubscriptions,
    manualRenewSubscription
  } = useSubscriptionStore()
  
  // Get categories from Edge Function data
  const usedCategories = categories.map(cat => ({
    id: cat.id,
    value: cat.value,
    label: cat.label
  }))
  
  // Get unique billing cycles in use
  const getUniqueBillingCycles = () => {
    const billingCycles = subscriptions.map(sub => sub.billingCycle)
    return Array.from(new Set(billingCycles)).map(cycle => ({
      value: cycle,
      label: cycle.charAt(0).toUpperCase() + cycle.slice(1)
    }))
  }
  
  const usedBillingCycles = getUniqueBillingCycles()

  // Subscriptions are already filtered and sorted by Edge Function
  const sortedSubscriptions = subscriptions

  // Handler for adding new subscription
  const handleAddSubscription = useCallback(async (subscription: Omit<Subscription, "id" | "lastBillingDate">) => {
    const { error } = await addSubscription(subscription)
    
    if (error) {
      toast({
        title: "Error adding subscription",
        description: error.message || "Failed to add subscription",
        variant: "destructive"
      })
      return
    }
    
    // Refresh data after adding
    await refreshData()
    
    toast({
      title: "Subscription added",
      description: `${subscription.name} has been added successfully.`
    })
  }, [addSubscription, refreshData, toast])

  // Handler for updating subscription
  const handleUpdateSubscription = useCallback(async (id: string, data: Omit<Subscription, "id" | "lastBillingDate">) => {
    const { error } = await updateSubscription(id, data)
    
    if (error) {
      toast({
        title: "Error updating subscription",
        description: error.message || "Failed to update subscription",
        variant: "destructive"
      })
      return
    }
    
    // Refresh data after updating
    await refreshData()
    
    setEditingSubscription(null)
    toast({
      title: "Subscription updated",
      description: `${data.name} has been updated successfully.`
    })
  }, [updateSubscription, refreshData, toast])

  // State for delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  
  // Handler for deleting subscription
  const handleDeleteSubscription = useCallback(async () => {
    if (!deleteTarget) return
    
    const { error } = await deleteSubscription(deleteTarget.id)
    
    if (error) {
      toast({
        title: "Error deleting subscription",
        description: error.message || "Failed to delete subscription",
        variant: "destructive"
      })
      return
    }
    
    // Refresh data after deleting
    await refreshData()
    
    toast({
      title: "Subscription deleted",
      description: `${deleteTarget.name} has been deleted.`,
      variant: "destructive"
    })
    
    setDeleteTarget(null)
  }, [deleteTarget, deleteSubscription, refreshData, toast])
  
  // Confirmation dialog hook
  const deleteConfirmation = useConfirmation({
    title: "Delete Subscription",
    description: deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : "",
    confirmText: "Delete",
    onConfirm: handleDeleteSubscription,
  })
  
  // Handler to open delete confirmation
  const handleDeleteClick = (id: string) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return
    
    setDeleteTarget({ id, name: subscription.name })
    deleteConfirmation.openDialog()
  }

  // Handler for changing subscription status
  const handleStatusChange = useCallback(async (id: string, status: SubscriptionStatus) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return

    const { error } = await updateSubscription(id, { status })

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message || "Failed to update status",
        variant: "destructive"
      })
      return
    }

    // Refresh data after status change
    await refreshData()

    toast({
      title: status === "active" ? "Subscription activated" : "Subscription cancelled",
      description: `${subscription.name} has been ${status === "active" ? "activated" : "cancelled"}.`
    })
  }, [subscriptions, updateSubscription, refreshData, toast])

  // Handler for manual renewal
  const handleManualRenew = useCallback(async (id: string) => {
    const subscription = subscriptions.find(sub => sub.id === id)
    if (!subscription) return

    const { error, renewalData } = await manualRenewSubscription(id)

    if (error) {
      toast({
        title: "Error renewing subscription",
        description: error,
        variant: "destructive"
      })
      return
    }

    // Refresh data after renewal
    await refreshData()

    toast({
      title: "Subscription renewed successfully",
      description: `${subscription.name} has been renewed. Next billing date: ${renewalData?.newNextBilling}`
    })
  }, [subscriptions, manualRenewSubscription, refreshData, toast])

  // Handler for toggling a category in the filter
  const toggleCategoryFilter = useCallback((categoryValue: string) => {
    const newCategories = selectedCategories.includes(categoryValue)
      ? selectedCategories.filter(c => c !== categoryValue)
      : [...selectedCategories, categoryValue]
    
    setSelectedCategories(newCategories)
    filterByCategories(newCategories)
  }, [selectedCategories, filterByCategories])
  
  // Handler for toggling a billing cycle in the filter
  const toggleBillingCycleFilter = useCallback((billingCycle: BillingCycle) => {
    const newBillingCycles = selectedBillingCycles.includes(billingCycle)
      ? selectedBillingCycles.filter(c => c !== billingCycle)
      : [...selectedBillingCycles, billingCycle]
    
    setSelectedBillingCycles(newBillingCycles)
    filterByBillingCycles(newBillingCycles)
  }, [selectedBillingCycles, filterByBillingCycles])

  // Handler for importing subscriptions
  const handleImportSubscriptions = useCallback(async (newSubscriptions: Omit<Subscription, "id">[]) => {
    const { error } = await bulkAddSubscriptions(newSubscriptions);

    if (error) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import subscriptions",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import successful",
        description: `${newSubscriptions.length} subscriptions have been imported.`,
      });
    }

    // Refresh data after importing
    await refreshData();
  }, [bulkAddSubscriptions, refreshData, toast]);

  // Handler for exporting subscriptions
  const handleExportSubscriptions = () => {
    setShowExportModal(true)
  }
  
  // Get billing cycle badge variant
  const getBillingCycleBadgeVariant = (billingCycle: BillingCycle) => {
    switch (billingCycle) {
      case 'yearly':
        return "success" // Green color for yearly
      case 'monthly':
        return "warning" // Orange/yellow for monthly
      case 'quarterly':
        return "info" // Blue for quarterly
      default:
        return "outline"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-16rem)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage all your subscription services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setShowAddForm(true)} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Subscription</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setShowImportModal(true)} size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleExportSubscriptions} size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 w-full max-w-sm">
          <SearchInput
            placeholder="Search subscriptions..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              searchSubscriptions(e.target.value)
            }}
            className="w-full"
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
          />

          <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Tags className="h-4 w-4" />
                {selectedCategories.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {selectedCategories.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-2">
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>Filter by Category</span>
                  {selectedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedCategories([])}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="max-h-72 overflow-y-auto">
                {usedCategories.map((category) => (
                  <div
                    key={category.value}
                    className={cn(
                      "flex items-center px-2 py-1.5 transition-colors hover:bg-muted cursor-pointer",
                      selectedCategories.includes(category.value) && "bg-muted"
                    )}
                    onClick={() => toggleCategoryFilter(category.value)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      selectedCategories.includes(category.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-50 border-primary"
                    )}>
                      {selectedCategories.includes(category.value) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="text-sm">{category.label}</div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {subscriptions.filter(s => s.category?.value === category.value).length}
                    </Badge>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Billing Cycle Filter */}
          <Popover open={billingCycleFilterOpen} onOpenChange={setBillingCycleFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <CalendarIcon className="h-4 w-4" />
                {selectedBillingCycles.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {selectedBillingCycles.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-2">
                <div className="font-medium text-sm flex items-center justify-between">
                  <span>Filter by Billing Cycle</span>
                  {selectedBillingCycles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedBillingCycles([])}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div className="max-h-72 overflow-y-auto">
                {usedBillingCycles.map((cycle) => (
                  <div
                    key={cycle.value}
                    className={cn(
                      "flex items-center px-2 py-1.5 transition-colors hover:bg-muted cursor-pointer",
                      selectedBillingCycles.includes(cycle.value as BillingCycle) && "bg-muted"
                    )}
                    onClick={() => toggleBillingCycleFilter(cycle.value as BillingCycle)}
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                      selectedBillingCycles.includes(cycle.value as BillingCycle)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "opacity-50 border-primary"
                    )}>
                      {selectedBillingCycles.includes(cycle.value as BillingCycle) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <div className="text-sm">{cycle.label}</div>
                    <Badge
                      variant={getBillingCycleBadgeVariant(cycle.value as BillingCycle)}
                      className="ml-auto text-xs"
                    >
                      {subscriptions.filter(s => s.billingCycle === cycle.value).length}
                    </Badge>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const newOrder = sortOrder === "asc" ? "desc" : "asc"
                    setSortOrder(newOrder)
                    updateSorting({ field: 'nextBillingDate', order: newOrder })
                  }}
                >
                  {sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sort by Next Billing Date ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={currentView === "all" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("all")
              filterByStatus("all")
            }}
          >
            All
          </Button>
          <Button
            variant={currentView === "active" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("active")
              filterByStatus("active")
            }}
          >
            Active
          </Button>
          <Button
            variant={currentView === "cancelled" ? "default" : "outline"}
            onClick={() => {
              setCurrentView("cancelled")
              filterByStatus("cancelled")
            }}
          >
            Cancelled
          </Button>
        </div>
      </div>

      {/* Display selected category filters */}
      {(selectedCategories.length > 0 || selectedBillingCycles.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedCategories.map(categoryValue => {
            const category = categories.find(c => c.value === categoryValue)
            return (
              <Badge
                key={categoryValue}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1"
              >
                {category?.label || categoryValue}
                <button
                  onClick={() => toggleCategoryFilter(categoryValue)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <span className="sr-only">Remove</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </Badge>
            )
          })}

          {/* Display selected billing cycle filters */}
          {selectedBillingCycles.map(cycleValue => {
            const cycle = usedBillingCycles.find(c => c.value === cycleValue)
            return (
              <Badge
                key={cycleValue}
                variant={getBillingCycleBadgeVariant(cycleValue)}
                className="flex items-center gap-1 px-2 py-1"
              >
                {cycle?.label || cycleValue}
                <button
                  onClick={() => toggleBillingCycleFilter(cycleValue)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <span className="sr-only">Remove</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 text-white"
                  >
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Loading skeleton cards */}
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border bg-card shadow animate-pulse">
              <div className="p-6 pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="space-y-2">
                    <div className="h-5 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-6 bg-muted rounded w-20"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-40"></div>
                  <div className="h-4 bg-muted rounded w-28"></div>
                  <div className="h-4 bg-muted rounded w-36"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No subscriptions found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategories.length > 0 || selectedBillingCycles.length > 0
              ? `No results for your current filters. Try changing your search terms or filters.`
              : currentView !== "all"
                ? `You don't have any ${currentView} subscriptions.`
                : "Get started by adding your first subscription."
            }
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Subscriptions
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSubscriptions.map((subscription) => {
            // Convert SubscriptionData to Subscription format for SubscriptionCard
            const subscriptionForCard: Subscription = {
              id: subscription.id,
              name: subscription.name,
              plan: subscription.plan,
              billingCycle: subscription.billingCycle as BillingCycle,
              nextBillingDate: subscription.nextBillingDate,
              lastBillingDate: subscription.lastBillingDate,
              amount: subscription.convertedAmount, // Use converted amount
              currency: userCurrency || 'CNY', // Use user's currency
              paymentMethodId: subscription.paymentMethodId,
              startDate: subscription.startDate,
              status: subscription.status as SubscriptionStatus,
              categoryId: subscription.categoryId,
              renewalType: subscription.renewalType as 'auto' | 'manual',
              notes: subscription.notes,
              website: subscription.website,
              category: subscription.category,
              paymentMethod: subscription.paymentMethod
            }
            
            return (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscriptionForCard}
                onEdit={() => setEditingSubscription(subscriptionForCard)}
                onDelete={() => handleDeleteClick(subscription.id)}
                onStatusChange={handleStatusChange}
                onManualRenew={handleManualRenew}
                onViewDetails={(subscription) => setDetailSubscription(subscription)}
              />
            )
          })}
        </div>
      )}

      {/* Forms and Modals */}
      <SubscriptionForm
        open={showAddForm || editingSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false)
            setEditingSubscription(null)
          }
        }}
        initialData={editingSubscription || undefined}
        onSubmit={editingSubscription
          ? (data) => handleUpdateSubscription(editingSubscription.id, data)
          : handleAddSubscription
        }
      />

      <SubscriptionDetailDialog
        subscription={detailSubscription}
        open={detailSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSubscription(null)
          }
        }}
        onEdit={(id) => {
          const subscription = subscriptions.find(s => s.id === id)
          if (subscription) {
            setEditingSubscription(subscription)
            setDetailSubscription(null)
          }
        }}
        onManualRenew={handleManualRenew}
      />

      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportSubscriptions}
      />

      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />

      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </>
  )
}
