import { Route, Routes } from "react-router-dom"
import { Suspense, lazy } from "react"
import { Toaster } from "./components/ui/toaster"
import { ThemeProvider } from "./components/ThemeProvider"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { MainLayout } from "./components/layouts/MainLayout"
import { SessionTimeoutWarning } from "./components/auth/SessionTimeoutWarning"

// Lazy load pages for code splitting
const LandingPage = lazy(() => import("./pages/LandingPage").then(module => ({ default: module.LandingPage })))
const HomePage = lazy(() => import("./pages/HomePage"))
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage").then(module => ({ default: module.SubscriptionsPage })))
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(module => ({ default: module.SettingsPage })))
const ExpenseReportsPage = lazy(() => import("./pages/ExpenseReportsPage").then(module => ({ default: module.ExpenseReportsPage })))
const LoginPage = lazy(() => import("./pages/LoginPage").then(module => ({ default: module.LoginPage })))
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage").then(module => ({ default: module.AuthCallbackPage })))


const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage").then(module => ({ default: module.AdminLoginPage })))
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage").then(module => ({ default: module.AdminDashboardPage })))
const SettingsCacheTestPage = lazy(() => import("./pages/SettingsCacheTestPage").then(module => ({ default: module.SettingsCacheTestPage })))

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <Suspense fallback={null}>
          <Routes>
            {/* 公开路由 */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />



            {/* 管理员路由 */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            } />

            {/* 受保护的路由 */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/subscriptions" element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionsPage />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/expense-reports" element={
              <ProtectedRoute>
                <MainLayout>
                  <ExpenseReportsPage />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <MainLayout>
                  <SettingsPage />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/test/settings-cache" element={
              <ProtectedRoute>
                <MainLayout>
                  <SettingsCacheTestPage />
                </MainLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
        <SessionTimeoutWarning
          warningThreshold={5 * 60 * 1000} // 5分钟前警告
          autoRefreshThreshold={2 * 60 * 1000} // 2分钟前自动刷新
          enableAutoRefresh={true}
        />
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App