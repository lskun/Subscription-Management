import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright配置文件
 * 用于端到端测试
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // 测试运行配置
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports/html' }],
    ['json', { outputFile: 'tests/e2e/reports/results.json' }],
    ['line']
  ],
  
  // 全局测试配置
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 等待配置
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // 忽略HTTPS错误（开发环境）
    ignoreHTTPSErrors: true,
  },

  // 浏览器项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 开发服务器配置 - 使用智能启动脚本
  webServer: {
    command: 'tsx',
    args: ['scripts/start-dev-server.ts', '5174', 'localhost', 'true'],
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI, // CI环境不复用，本地开发复用
    timeout: 60 * 1000, // 1分钟启动超时
    stdout: 'pipe',
    stderr: 'pipe',
  },
})