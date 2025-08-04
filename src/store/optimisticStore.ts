import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { Subscription } from './subscriptionStore'

interface OptimisticUpdate {
  id: string
  type: 'create' | 'update' | 'delete'
  data: Partial<Subscription>
  timestamp: number
}

interface OptimisticState {
  pendingUpdates: OptimisticUpdate[]
  addOptimisticUpdate: (update: OptimisticUpdate) => void
  removeOptimisticUpdate: (id: string) => void
  clearOptimisticUpdates: () => void
}

export const useOptimisticStore = create<OptimisticState>((set) => ({
  pendingUpdates: [],
  
  addOptimisticUpdate: (update) => set((state) => ({
    pendingUpdates: [...state.pendingUpdates, update]
  })),
  
  removeOptimisticUpdate: (id) => set((state) => ({
    pendingUpdates: state.pendingUpdates.filter(u => u.id !== id)
  })),
  
  clearOptimisticUpdates: () => set({ pendingUpdates: [] })
}))

// Optimistic update functions
export const optimisticUpdateSubscription = async (
  id: string,
  data: Partial<Subscription>,
  onSuccess: () => void,
  onError: (error: Error) => void
) => {
  const updateId = `update-${id}-${Date.now()}`
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'update',
    data: { ...data, id },
    timestamp: Date.now()
  })
  
  try {
    // Make Supabase call
    const { error } = await supabase
      .from('subscriptions')
      .update(data)
      .eq('id', id)
    
    if (error) throw error
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess()
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

export const optimisticCreateSubscription = async (
  data: Omit<Subscription, 'id'>,
  onSuccess: (id: string) => void,
  onError: (error: Error) => void
) => {
  const updateId = `create-${Date.now()}`
  const tempId = `temp-${Date.now()}` // Temporary string ID for temporary subscription
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'create',
    data: { ...data, id: tempId },
    timestamp: Date.now()
  })
  
  try {
    // Make Supabase call
    const { data: result, error } = await supabase
      .from('subscriptions')
      .insert({ ...data, user_id: (await (await import('../services/userCacheService')).UserCacheService.getCurrentUser())?.id })
      .select()
      .single()
    
    if (error) throw error
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess(result.id)
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

export const optimisticDeleteSubscription = async (
  id: string,
  onSuccess: () => void,
  onError: (error: Error) => void
) => {
  const updateId = `delete-${id}-${Date.now()}`
  
  // Add optimistic update
  useOptimisticStore.getState().addOptimisticUpdate({
    id: updateId,
    type: 'delete',
    data: { id },
    timestamp: Date.now()
  })
  
  try {
    // Make Supabase call
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    // Remove optimistic update and trigger success
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onSuccess()
  } catch (error) {
    // Remove optimistic update and trigger error
    useOptimisticStore.getState().removeOptimisticUpdate(updateId)
    onError(error as Error)
  }
}

// Hook to merge optimistic updates with actual data
export const useOptimisticSubscriptions = (subscriptions: Subscription[]) => {
  const pendingUpdates = useOptimisticStore(state => state.pendingUpdates)
  
  // Apply optimistic updates to subscriptions
  let optimisticSubscriptions = [...subscriptions]
  
  pendingUpdates.forEach(update => {
    switch (update.type) {
      case 'create':
        optimisticSubscriptions.push(update.data as Subscription)
        break
        
      case 'update':
        optimisticSubscriptions = optimisticSubscriptions.map(sub =>
          sub.id === update.data.id ? { ...sub, ...update.data } : sub
        )
        break
        
      case 'delete':
        optimisticSubscriptions = optimisticSubscriptions.filter(
          sub => sub.id !== update.data.id
        )
        break
    }
  })
  
  return optimisticSubscriptions
}