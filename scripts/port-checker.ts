#!/usr/bin/env ts-node

/**
 * 端口检查工具
 * 用于检查指定端口是否被占用
 */

import { createConnection } from 'net'

export interface PortCheckResult {
  port: number
  isOccupied: boolean
  service?: string
  error?: string
}

export class PortChecker {
  /**
   * 检查单个端口是否被占用
   */
  static async checkPort(port: number, host = 'localhost', timeout = 3000): Promise<PortCheckResult> {
    return new Promise((resolve) => {
      const socket = createConnection({ port, host, timeout })
      
      socket.on('connect', () => {
        socket.destroy()
        resolve({
          port,
          isOccupied: true,
          service: 'unknown'
        })
      })
      
      socket.on('error', (error: any) => {
        if (error.code === 'ECONNREFUSED') {
          // 端口未被占用
          resolve({
            port,
            isOccupied: false
          })
        } else {
          // 其他错误
          resolve({
            port,
            isOccupied: false,
            error: error.message
          })
        }
      })
      
      socket.on('timeout', () => {
        socket.destroy()
        resolve({
          port,
          isOccupied: false,
          error: 'Connection timeout'
        })
      })
    })
  }

  /**
   * 检查多个端口
   */
  static async checkPorts(ports: number[], host = 'localhost'): Promise<PortCheckResult[]> {
    const promises = ports.map(port => this.checkPort(port, host))
    return Promise.all(promises)
  }

  /**
   * 查找可用端口
   */
  static async findAvailablePort(startPort: number, endPort: number, host = 'localhost'): Promise<number | null> {
    for (let port = startPort; port <= endPort; port++) {
      const result = await this.checkPort(port, host)
      if (!result.isOccupied) {
        return port
      }
    }
    return null
  }

  /**
   * 检查开发服务器常用端口
   */
  static async checkDevServerPorts(): Promise<{
    vite: PortCheckResult
    react: PortCheckResult
    next: PortCheckResult
    recommended: number | null
  }> {
    const vitePorts = [5173, 5174, 5175]
    const reactPorts = [3000, 3001, 3002]
    const nextPorts = [3000, 3001, 3002]
    
    const [viteResults, reactResults, nextResults] = await Promise.all([
      this.checkPorts(vitePorts),
      this.checkPorts(reactPorts),
      this.checkPorts(nextPorts)
    ])

    // 找到第一个可用的Vite端口
    const availableVitePort = viteResults.find(r => !r.isOccupied)?.port || null
    
    return {
      vite: viteResults[0], // 默认Vite端口5173
      react: reactResults[0], // 默认React端口3000
      next: nextResults[0], // 默认Next端口3000
      recommended: availableVitePort
    }
  }

  /**
   * 等待端口变为可用状态
   */
  static async waitForPort(port: number, host = 'localhost', maxWaitTime = 30000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 1000 // 每秒检查一次

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.checkPort(port, host)
      if (result.isOccupied) {
        return true
      }
      
      // 等待一段时间后再检查
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    return false
  }

  /**
   * 等待端口变为不可用状态（服务器关闭）
   */
  static async waitForPortClose(port: number, host = 'localhost', maxWaitTime = 10000): Promise<boolean> {
    const startTime = Date.now()
    const checkInterval = 500 // 每0.5秒检查一次

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.checkPort(port, host)
      if (!result.isOccupied) {
        return true
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    return false
  }

  /**
   * 检查URL是否可访问
   */
  static async checkUrl(url: string, timeout = 5000): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * 检查开发服务器是否正在运行
   */
  static async checkDevServer(port: number, host = 'localhost'): Promise<{
    portOccupied: boolean
    serverResponding: boolean
    isViteServer: boolean
    url: string
  }> {
    const url = `http://${host}:${port}`
    
    const portResult = await this.checkPort(port, host)
    const urlAccessible = portResult.isOccupied ? await this.checkUrl(url) : false
    
    // 尝试检查是否是Vite服务器
    let isViteServer = false
    if (urlAccessible) {
      try {
        const response = await fetch(`${url}/@vite/client`, { method: 'HEAD' })
        isViteServer = response.ok
      } catch {
        isViteServer = false
      }
    }

    return {
      portOccupied: portResult.isOccupied,
      serverResponding: urlAccessible,
      isViteServer,
      url
    }
  }
}

// CLI使用
if (require.main === module) {
  const args = process.argv.slice(2)
  const port = parseInt(args[0]) || 5173
  const host = args[1] || 'localhost'

  console.log(`🔍 检查端口 ${host}:${port}...`)
  
  PortChecker.checkPort(port, host).then(result => {
    if (result.isOccupied) {
      console.log(`✅ 端口 ${port} 已被占用`)
      if (result.service) {
        console.log(`   服务: ${result.service}`)
      }
    } else {
      console.log(`❌ 端口 ${port} 未被占用`)
      if (result.error) {
        console.log(`   错误: ${result.error}`)
      }
    }
  }).catch(error => {
    console.error('❌ 检查失败:', error.message)
    process.exit(1)
  })
}