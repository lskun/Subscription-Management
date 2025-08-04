import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useConfirmation } from '@/hooks/use-confirmation'

import { Trash2, Edit, Plus } from 'lucide-react'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useToast } from '@/hooks/use-toast'

// Utility function to generate a value from a label
function generateValue(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .trim()
}

interface EditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  currentValue: string
  onSave: (newName: string) => void
  isLoading?: boolean
}

function EditDialog({ open, onOpenChange, title, currentValue, onSave, isLoading = false }: EditDialogProps) {
  const [name, setName] = useState(currentValue)
  const { categories, paymentMethods } = useSubscriptionStore()

  // Reset name when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(currentValue)
    }
  }, [open, currentValue])

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim())
    }
  }

  // Check for conflicts with existing items (excluding current item being edited)
  const checkConflict = (inputName: string) => {
    if (!inputName.trim() || inputName.trim() === currentValue) return null

    const value = inputName.trim() // Use input name directly without conversion
    const items = title === 'Category' ? categories : paymentMethods

    // Check for conflicts with system default items
    const defaultItem = items.find(item => item.value === value && item.is_default)
    if (defaultItem) {
      return `Conflicts with system default ${title === 'Category' ? 'category' : 'payment method'} "${defaultItem.value}"`
    }

    // Check for conflicts with other user custom items (excluding current item being edited)
    const userItem = items.find(item =>
      item.value === value &&
      !item.is_default &&
      item.value !== currentValue
    )
    if (userItem) {
      return `Conflicts with existing ${title === 'Category' ? 'category' : 'payment method'} "${userItem.value}"`
    }

    return null
  }

  const conflictMessage = checkConflict(name)
  const hasConflict = !!conflictMessage
  const hasChanges = name.trim() !== currentValue

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {title === 'Category' ? 'Category' : 'Payment Method'}</DialogTitle>
          <DialogDescription>
            Update the name of the {title === 'Category' ? 'category' : 'payment method'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${title === 'Category' ? 'category' : 'payment method'} name...`}
              className={hasConflict ? 'border-red-500' : ''}
              maxLength={20}
            />
            {conflictMessage && (
              <p className="text-sm text-red-500 mt-1">{conflictMessage}</p>
            )}
            {name.trim() && !hasConflict && hasChanges && (
              <p className="text-sm text-green-600 mt-1">
                Will be updated to: {name.trim()}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || hasConflict || !hasChanges || isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onAdd: (name: string) => void
  isLoading?: boolean
}

function AddDialog({ open, onOpenChange, title, onAdd, isLoading = false }: AddDialogProps) {
  const [name, setName] = useState('')
  const { categories, paymentMethods } = useSubscriptionStore()

  // Reset input when dialog closes
  React.useEffect(() => {
    if (!open) {
      setName('')
    }
  }, [open])

  const handleAdd = () => {
    if (name.trim() && !isLoading) {
      onAdd(name.trim())
      // Don't clear the input immediately - let the parent handle success/failure
    }
  }

  // Check for conflicts with existing items
  const checkConflict = (inputName: string) => {
    if (!inputName.trim()) return null

    const value = inputName.trim() // Use input name directly without conversion
    const items = title === 'Category' ? categories : paymentMethods

    // Check for conflicts with system default items
    const defaultItem = items.find(item => item.value === value && item.is_default)
    if (defaultItem) {
      return `Conflicts with system default ${title === 'Category' ? 'category' : 'payment method'} "${defaultItem.value}"`
    }

    // Check for conflicts with user custom items
    const userItem = items.find(item => item.value === value && !item.is_default)
    if (userItem) {
      return `Conflicts with existing ${title === 'Category' ? 'category' : 'payment method'} "${userItem.value}"`
    }

    return null
  }

  const conflictMessage = checkConflict(name)
  const hasConflict = !!conflictMessage

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New {title === 'Category' ? 'Category' : 'Payment Method'}</DialogTitle>
          <DialogDescription>
            Create a new {title === 'Category' ? 'category' : 'payment method'} option
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${title === 'Category' ? 'category' : 'payment method'} name...`}
              className={hasConflict ? 'border-red-500' : ''}
              maxLength={20}
            />
            {conflictMessage && (
              <p className="text-sm text-red-500 mt-1">{conflictMessage}</p>
            )}
            {name.trim() && !hasConflict && (
              <p className="text-sm text-green-600 mt-1">
                Will be created as: {name.trim()}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim() || hasConflict || isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Adding...
              </>
            ) : (
              `Add ${title === 'Category' ? 'Category' : 'Payment Method'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface OptionItemProps {
  value: string
  label: string
  onEdit: () => void
  onDelete: () => void
  canDelete?: boolean
  isDefault?: boolean
}

function OptionItem({ value, label, onEdit, onDelete, canDelete = true, isDefault = false }: OptionItemProps) {
  return (
    <div className="group relative p-3 border rounded-lg hover:shadow-md transition-all duration-200">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{value}</p>
          {isDefault ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              default
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              custom
            </span>
          )}
        </div>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-6 w-6 p-0">
            <Edit className="h-3 w-3" />
          </Button>
        )}
        {canDelete && !isDefault && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-6 w-6 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function OptionsManager() {
  const { toast } = useToast()
  const {
    categories,
    paymentMethods,
    addCategory,
    editCategory,
    deleteCategory,
    addPaymentMethod,
    editPaymentMethod,
    deletePaymentMethod,
    fetchCategories,
    fetchPaymentMethods
  } = useSubscriptionStore()

  // Fetch data on component mount
  useEffect(() => {
    fetchCategories()
    fetchPaymentMethods()
  }, [fetchCategories, fetchPaymentMethods])

  // Dialog states
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    type: 'category' | 'payment'
    id: string
    value: string
  }>({ open: false, type: 'category', id: '', value: '' })

  const [addDialog, setAddDialog] = useState<{
    open: boolean
    type: 'category' | 'payment'
  }>({ open: false, type: 'category' })

  const [isAddLoading, setIsAddLoading] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(false)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'payment'; value: string; label: string } | null>(null)

  const handleEdit = (type: 'category' | 'payment', id: string, value: string) => {
    setEditDialog({ open: true, type, id, value })
  }

  const handleSaveEdit = async (newName: string) => {
    const { type, id: oldId } = editDialog
    const newValue = newName.trim()
    // Find the existing option to get its ID
    const existingOption = type === 'category'
      ? categories.find(cat => cat.id === oldId)
      : paymentMethods.find(method => method.id === oldId)

    if (!existingOption) {
      throw new Error(`${type} option not found`)
    }

    // 构建更新对象，payment method的label字段会被store层忽略
    const newOption = { id: existingOption.id, value: newValue, label: newName }

    setIsEditLoading(true)
    try {
      switch (type) {
        case 'category':
          await editCategory(existingOption.value, newOption)
          break
        case 'payment':
          await editPaymentMethod(existingOption.value, newOption)
          break
      }

      toast({
        title: "Update Successful",
        description: `${type === 'category' ? 'Category' : 'Payment method'} has been successfully updated`
      })
      
      // Close dialog on success
      setEditDialog(prev => ({ ...prev, open: false }))
    } catch (error) {
      console.error('Edit error:', error)
      const errorMessage = error instanceof Error ? error.message : `Failed to update ${type === 'category' ? 'category' : 'payment method'}`
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    console.log('Starting delete operation:', deleteTarget)

    setIsDeleteLoading(true)
    try {
      switch (deleteTarget.type) {
        case 'category':
          console.log('Calling deleteCategory, ID:', deleteTarget.value)
          await deleteCategory(deleteTarget.value)
          break
        case 'payment':
          console.log('Calling deletePaymentMethod, ID:', deleteTarget.value)
          await deletePaymentMethod(deleteTarget.value)
          break
      }

      console.log('Delete operation completed successfully')
      toast({
        title: "Delete Successful",
        description: `${deleteTarget.type === 'category' ? 'Category' : 'Payment method'} has been successfully deleted`
      })
    } catch (error) {
      console.error('Delete error:', error)
      const errorMessage = error instanceof Error ? error.message : `Failed to delete ${deleteTarget.type === 'category' ? 'category' : 'payment method'}`
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsDeleteLoading(false)
    }

    setDeleteTarget(null)
  }

  const deleteConfirmation = useConfirmation({
    title: deleteTarget?.type === 'category' ? "Delete Category" : "Delete Payment Method",
    description: deleteTarget ? `Are you sure you want to delete "<span style="color: red; font-weight: bold;">${deleteTarget.label}</span>"? Any subscriptions using this ${deleteTarget.type} will need to be updated.` : "",
    confirmText: "Delete",
    onConfirm: handleDelete,
    isLoading: isDeleteLoading,
  })

  const handleDeleteClick = (type: 'category' | 'payment', id: string, value: string) => {
    console.log('Preparing to delete:', { type, id, value })
    setDeleteTarget({ type, value: id, label: value })
    deleteConfirmation.openDialog()
  }

  const handleAdd = (type: 'category' | 'payment') => {
    setAddDialog({ open: true, type })
  }

  const handleSaveAdd = async (name: string) => {
    const { type } = addDialog
    const value = name.trim() // Use input name directly as value without conversion
    // For new options, we don't need to provide an ID as the server will assign one
    // 构建新增对象，payment method的label字段会被store层忽略
    const newOption = { id: '0', value, label: value }

    setIsAddLoading(true)
    try {
      switch (type) {
        case 'category':
          await addCategory(newOption)
          break
        case 'payment':
          await addPaymentMethod(newOption)
          break
      }

      toast({
        title: "Add Successful",
        description: `New ${type === 'category' ? 'category' : 'payment method'} has been successfully added`
      })
      
      // Close dialog on success
      setAddDialog({ open: false, type: 'category' })
    } catch (error) {
      console.error('Add error:', error)
      const errorMessage = error instanceof Error ? error.message : `Failed to add ${type === 'category' ? 'category' : 'payment method'}`
      toast({
        title: "Add Failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsAddLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories" data-testid="categories-tab">Categories</TabsTrigger>
          <TabsTrigger value="payment-methods" data-testid="payment-methods-tab">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categories</CardTitle>
                  <CardDescription>
                    Manage subscription categories for better organization.
                  </CardDescription>
                </div>
                <Button onClick={() => handleAdd('category')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {categories.map((category) => (
                  <OptionItem
                    key={category.value}
                    value={category.value}
                    label={category.label}
                    isDefault={category.is_default}
                    onEdit={() => handleEdit('category', category.id, category.value)}
                    onDelete={() => handleDeleteClick('category', category.id, category.value)}
                    canDelete={!category.is_default}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-methods">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>
                    Manage available payment methods for your subscriptions.
                  </CardDescription>
                </div>
                <Button onClick={() => handleAdd('payment')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {paymentMethods.map((method) => (
                  <OptionItem
                    key={method.value}
                    value={method.value}
                    label={method.label}
                    isDefault={method.is_default}
                    onEdit={() => handleEdit('payment', method.id, method.value)}
                    onDelete={() => handleDeleteClick('payment', method.id, method.value)}
                    canDelete={!method.is_default}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>

      {/* Edit Dialog */}
      <EditDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}
        title={editDialog.type === 'category' ? 'Category' : editDialog.type === 'payment' ? 'Payment Method' : 'Plan'}
        currentValue={editDialog.value}
        onSave={handleSaveEdit}
        isLoading={isEditLoading}
      />

      {/* Add Dialog */}
      <AddDialog
        open={addDialog.open}
        onOpenChange={(open) => setAddDialog(prev => ({ ...prev, open }))}
        title={addDialog.type === 'category' ? 'Category' : addDialog.type === 'payment' ? 'Payment Method' : 'Plan'}
        onAdd={handleSaveAdd}
        isLoading={isAddLoading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog {...deleteConfirmation.dialogProps} />
    </div>
  )
}
