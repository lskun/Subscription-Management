#!/usr/bin/env ts-node

/**
 * 完整的端到端测试运行脚本
 * 测试任务1-3的所有功能
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'

interface TestResult {
  suite: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
}

class E2ETestRunner {
  private results: TestResult[] = []
  private startTime: number = 0

  async runAllTests(): Promise<void> {
    console.log('🚀 开始运行任务1-3的完整端到端测试')
    console.log('=' .repeat(60))
    this.startTime = Date.now()

    // 检查环境
    await this.checkEnvironment()

    // 运行测试套件
    await this.runTestSuite('认证系统测试', 'tests/e2e/auth.spec.ts')
    await this.runTestSuite('数据库测试', 'tests/e2e/database.spec.ts') 
    await this.runTestSuite('集成测试', 'tests/e2e/integration.spec.ts')
    await this.runTestSuite('会话管理测试', 'tests/e2e/session-management.spec.ts')
    await this.runTestSuite('完整系统测试', 'tests/e2e/complete-system.spec.ts')

    // 生成报告
    this.generateReport()
  }

  private async checkEnvironment(): Promise<void> {
    console.log('🔍 检查测试环境...')
    
    // 检查环境变量
    if (!process.env.VITE_SUPABASE_URL) {
      console.log('⚠️  未设置 VITE_SUPABASE_URL 环境变量')
    }

    // 准备测试服务器
    await this.prepareTestServer()

    // 检查Playwright配置
    if (!existsSync('playwright.config.ts')) {
      console.log('⚠️  未找到 playwright.config.ts，创建默认配置...')
      this.createPlaywrightConfig()
    }

    // 安装浏览器（如果需要）
    try {
      execSync('npx playwright install chromium', { stdio: 'pipe' })
      console.log('✅ 浏览器环境检查完成')
    } catch (error) {
      console.log('⚠️  浏览器安装可能有问题，但继续测试')
    }
  }

  private async prepareTestServer(): Promise<void> {
    try {
      // 动态导入测试服务器管理器
      const { TestServerManager } = await import('./test-server-manager')
      
      const manager = TestServerManager.getInstance()
      
      // 准备Playwright测试环境
      const { baseURL, serverInfo } = await manager.preparePlaywrightEnvironment({
        preferredPorts: [5173, 5174, 3000, 3001],
        host: 'localhost',
        timeout: 60000,
        reuseExisting: true,
        autoCleanup: true
      })
      
      console.log(`✅ 测试环境已准备: ${baseURL}`)
      console.log(`   服务器类型: ${serverInfo.isNewServer ? '新启动' : '复用现有'}`)
      console.log(`   自动清理: ${serverInfo.shouldCleanup ? '是' : '否'}`)
      
      // 添加清理处理器
      process.on('exit', () => {
        if (serverInfo.shouldCleanup) {
          console.log('🧹 测试完成，清理服务器...')
        }
      })
      
    } catch (error: any) {
      console.log(`⚠️  测试服务器准备失败: ${error.message}`)
      console.log('   将尝试使用默认配置继续测试')
      
      // 设置默认URL
      process.env.PLAYWRIGHT_BASE_URL = 'http://localhost:5173'
    }
  }

  private createPlaywrightConfig(): void {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
    
    const config = `
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: '${baseURL}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 智能服务器管理：优先复用现有服务器
  webServer: process.env.CI ? {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120000,
  } : undefined, // 本地开发时不自动启动，依赖外部检查
})
`
    writeFileSync('playwright.config.ts', config)
    console.log(`✅ Playwright配置已创建，baseURL: ${baseURL}`)
  }

  private async runTestSuite(suiteName: string, testFile: string): Promise<void> {
    console.log(`\n📋 运行: ${suiteName}`)
    const startTime = Date.now()

    try {
      // 检查测试文件是否存在
      if (!existsSync(testFile)) {
        console.log(`⚠️  测试文件不存在: ${testFile}`)
        this.results.push({
          suite: suiteName,
          status: 'skipped',
          duration: 0,
          error: '测试文件不存在'
        })
        return
      }

      // 运行测试
      const command = `npx playwright test ${testFile} --project=chromium --reporter=line`
      execSync(command, { 
        stdio: 'inherit',
        timeout: 120000 // 2分钟超时
      })

      const duration = Date.now() - startTime
      console.log(`✅ ${suiteName} - 通过 (${(duration / 1000).toFixed(2)}s)`)
      
      this.results.push({
        suite: suiteName,
        status: 'passed',
        duration
      })

    } catch (error: any) {
      const duration = Date.now() - startTime
      console.log(`❌ ${suiteName} - 失败 (${(duration / 1000).toFixed(2)}s)`)
      
      this.results.push({
        suite: suiteName,
        status: 'failed',
        duration,
        error: error.message
      })
    }
  }

  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime
    const passed = this.results.filter(r => r.status === 'passed').length
    const failed = this.results.filter(r => r.status === 'failed').length
    const skipped = this.results.filter(r => r.status === 'skipped').length
    const total = this.results.length

    console.log('\n' + '='.repeat(60))
    console.log('📊 测试执行总结')
    console.log('='.repeat(60))
    console.log(`总测试套件: ${total}`)
    console.log(`✅ 通过: ${passed}`)
    console.log(`❌ 失败: ${failed}`)
    console.log(`⏭️  跳过: ${skipped}`)
    console.log(`⏱️  总耗时: ${(totalDuration / 1000).toFixed(2)}s`)
    console.log(`🎯 成功率: ${total > 0 ? ((passed / total) * 100).toFixed(2) : 0}%`)

    // 显示详细结果
    console.log('\n📋 详细结果:')
    this.results.forEach(result => {
      const status = result.status === 'passed' ? '✅' : 
                    result.status === 'failed' ? '❌' : '⏭️'
      const duration = `(${(result.duration / 1000).toFixed(2)}s)`
      console.log(`${status} ${result.suite} ${duration}`)
      
      if (result.error) {
        console.log(`   错误: ${result.error}`)
      }
    })

    // 保存报告
    this.saveReport({
      summary: {
        total,
        passed,
        failed,
        skipped,
        successRate: total > 0 ? ((passed / total) * 100).toFixed(2) : '0',
        totalDuration
      },
      results: this.results,
      timestamp: new Date().toISOString()
    })

    if (failed === 0) {
      console.log('\n🎉 所有测试都通过了！')
      console.log('✨ 任务1-3的功能实现质量良好')
    } else {
      console.log('\n⚠️  有测试失败，请检查相关功能')
      process.exit(1)
    }
  }

  private saveReport(report: any): void {
    const reportDir = 'tests/e2e/reports'
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true })
    }

    const reportFile = path.join(reportDir, `e2e-report-${Date.now()}.json`)
    writeFileSync(reportFile, JSON.stringify(report, null, 2))
    console.log(`\n📄 详细报告已保存到: ${reportFile}`)
  }
}

// 运行测试
if (require.main === module) {
  const runner = new E2ETestRunner()
  runner.runAllTests().catch(error => {
    console.error('❌ 测试运行失败:', error)
    process.exit(1)
  })
}

export { E2ETestRunner }