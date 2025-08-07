"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { useSettingsStore } from "@/store/settingsStore"
import { useAuth } from "@/contexts/AuthContext"

function ThemeSync() {
  const { theme, fetchSettings } = useSettingsStore()
  const { user, loading } = useAuth()
  const hasInitialized = React.useRef(false)
  const lastUserId = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Only fetch settings when user is logged in
    // This prevents AuthSessionMissingError when accessing the landing page without authentication
    if (!loading && user) {
      // Avoid duplicate calls for the same user
      if (!hasInitialized.current || lastUserId.current !== user.id) {
        console.log('🎨 ThemeSync: Getting user settings', { userId: user.id, isFirstTime: !hasInitialized.current })
        hasInitialized.current = true
        lastUserId.current = user.id
        fetchSettings()
      }
    } else if (!user) {
      // Reset when user logs out
      hasInitialized.current = false
      lastUserId.current = null
    }
  }, [fetchSettings, user, loading])

  return null
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  )
}