#!/usr/bin/env tsx

/**
 * 测试脚本：验证费用报告页面的请求优化效果
 * 
 * 使用方法：
 * npm run dev 启动开发服务器后
 * 在浏览器中打开 http://localhost:5173/expense-reports
 * 打开开发者工具的网络面板
 * 刷新页面并观察请求数量
 */

import { performance } from 'perf_hooks'

interface RequestLog {
  url: string
  timestamp: number
  method: string
}

class RequestTracker {
  private requests: RequestLog[] = []
  private duplicateThreshold = 1000 // 1秒内的重复请求被认为是重复的

  logRequest(url: string, method: string = 'GET') {
    const timestamp = performance.now()
    this.requests.push({ url, timestamp, method })
    console.log(`[${new Date().toISOString()}] ${method} ${url}`)
  }

  getDuplicateRequests(): RequestLog[][] {
    const duplicates: RequestLog[][] = []
    const processed = new Set<number>()

    for (let i = 0; i < this.requests.length; i++) {
      if (processed.has(i)) continue

      const current = this.requests[i]
      const group = [current]
      processed.add(i)

      for (let j = i + 1; j < this.requests.length; j++) {
        if (processed.has(j)) continue

        const other = this.requests[j]
        if (
          current.url === other.url &&
          current.method === other.method &&
          Math.abs(other.timestamp - current.timestamp) < this.duplicateThreshold
        ) {
          group.push(other)
          processed.add(j)
        }
      }

      if (group.length > 1) {
        duplicates.push(group)
      }
    }

    return duplicates
  }

  generateReport(): string {
    const duplicates = this.getDuplicateRequests()
    let report = `请求优化报告\n${'='.repeat(50)}\n\n`

    report += `总请求数: ${this.requests.length}\n`
    report += `重复请求组数: ${duplicates.length}\n\n`

    if (duplicates.length > 0) {
      report += `重复请求详情:\n${'-'.repeat(30)}\n`
      duplicates.forEach((group, index) => {
        report += `\n组 ${index + 1}: ${group[0].url}\n`
        report += `重复次数: ${group.length}\n`
        report += `时间跨度: ${(group[group.length - 1].timestamp - group[0].timestamp).toFixed(2)}ms\n`
        group.forEach((req, reqIndex) => {
          report += `  ${reqIndex + 1}. ${new Date(req.timestamp).toISOString()} - ${req.method}\n`
        })
      })
    } else {
      report += `✅ 未发现重复请求！\n`
    }

    return report
  }

  clear() {
    this.requests = []
  }
}

// 导出全局实例供浏览器使用
const requestTracker = new RequestTracker()

// 在浏览器环境中，可以通过以下方式使用：
// 1. 打开开发者工具
// 2. 在控制台中运行：
//    window.requestTracker = new RequestTracker()
// 3. 监听网络请求（需要手动添加或使用浏览器扩展）
// 4. 生成报告：console.log(window.requestTracker.generateReport())

if (typeof window !== 'undefined') {
  (window as any).requestTracker = requestTracker
  console.log('Request tracker initialized. Use window.requestTracker to track requests.')
}

export { RequestTracker, requestTracker }

// 使用示例
console.log(`
费用报告页面请求优化测试指南：

1. 启动开发服务器：npm run dev
2. 打开浏览器访问：http://localhost:5173/expense-reports
3. 打开开发者工具的网络面板
4. 刷新页面
5. 观察以下请求的数量：
   - /functions/v1/expense-reports
   - /rest/v1/user_settings
   - /rest/v1/categories
   - /rest/v1/payment_methods

优化目标：
- expense-reports 请求应该只有 1 次
- user_settings 请求应该只有 1 次
- 其他请求也应该被适当缓存

如果仍然看到重复请求，请检查：
- useEffect 依赖数组
- Store 中的缓存机制
- 组件重新渲染的原因
`)