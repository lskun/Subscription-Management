#!/usr/bin/env ts-node

/**
 * 智能开发服务器启动脚本
 * 检查端口状态并智能启动或复用现有服务器
 */

import { spawn, ChildProcess } from 'child_process'
import { PortChecker } from './port-checker'

export interface DevServerConfig {
  port: number
  host: string
  command: string
  args: string[]
  timeout: number
  reuseExisting: boolean
}

export interface DevServerResult {
  success: boolean
  port: number
  url: string
  isNewServer: boolean
  message: string
  process?: ChildProcess
}

export class DevServerManager {
  private static runningServers = new Map<number, ChildProcess>()

  /**
   * 启动或复用开发服务器
   */
  static async startServer(config: DevServerConfig): Promise<DevServerResult> {
    const { port, host, command, args, timeout, reuseExisting } = config
    const url = `http://${host}:${port}`

    console.log(`🚀 检查开发服务器状态 (${url})...`)

    // 检查服务器状态
    const serverStatus = await PortChecker.checkDevServer(port, host)

    if (serverStatus.portOccupied && serverStatus.serverResponding) {
      if (reuseExisting) {
        console.log(`✅ 复用现有服务器: ${url}`)
        return {
          success: true,
          port,
          url,
          isNewServer: false,
          message: '复用现有服务器'
        }
      } else {
        console.log(`⚠️  端口 ${port} 已被占用，但配置为不复用现有服务器`)
        
        // 尝试找到可用端口
        const availablePort = await PortChecker.findAvailablePort(port + 1, port + 10, host)
        if (availablePort) {
          console.log(`🔄 使用可用端口: ${availablePort}`)
          return this.startNewServer({
            ...config,
            port: availablePort
          })
        } else {
          return {
            success: false,
            port,
            url,
            isNewServer: false,
            message: `端口 ${port} 已被占用且无可用端口`
          }
        }
      }
    }

    // 启动新服务器
    return this.startNewServer(config)
  }

  /**
   * 启动新的开发服务器
   */
  private static async startNewServer(config: DevServerConfig): Promise<DevServerResult> {
    const { port, host, command, args, timeout } = config
    const url = `http://${host}:${port}`

    console.log(`🔧 启动新的开发服务器: ${command} ${args.join(' ')}`)

    return new Promise((resolve) => {
      // 启动服务器进程
      const serverProcess = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PORT: port.toString() }
      })

      // 记录运行中的服务器
      this.runningServers.set(port, serverProcess)

      let resolved = false
      const startTime = Date.now()

      // 监听输出以确定服务器是否启动成功
      const checkServerReady = () => {
        PortChecker.checkDevServer(port, host).then(status => {
          if (status.serverResponding && !resolved) {
            resolved = true
            const duration = Date.now() - startTime
            console.log(`✅ 开发服务器启动成功 (${duration}ms): ${url}`)
            
            resolve({
              success: true,
              port,
              url,
              isNewServer: true,
              message: `服务器启动成功 (${duration}ms)`,
              process: serverProcess
            })
          }
        })
      }

      // 定期检查服务器状态
      const checkInterval = setInterval(checkServerReady, 1000)

      // 超时处理
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          clearInterval(checkInterval)
          
          console.log(`❌ 服务器启动超时 (${timeout}ms)`)
          
          // 清理进程
          if (!serverProcess.killed) {
            serverProcess.kill('SIGTERM')
          }
          this.runningServers.delete(port)

          resolve({
            success: false,
            port,
            url,
            isNewServer: false,
            message: `服务器启动超时 (${timeout}ms)`
          })
        }
      }, timeout)

      // 监听进程事件
      serverProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true
          clearInterval(checkInterval)
          clearTimeout(timeoutId)
          
          console.log(`❌ 服务器启动失败: ${error.message}`)
          this.runningServers.delete(port)

          resolve({
            success: false,
            port,
            url,
            isNewServer: false,
            message: `服务器启动失败: ${error.message}`
          })
        }
      })

      serverProcess.on('exit', (code, signal) => {
        clearInterval(checkInterval)
        clearTimeout(timeoutId)
        this.runningServers.delete(port)
        
        if (!resolved) {
          resolved = true
          console.log(`❌ 服务器进程退出 (code: ${code}, signal: ${signal})`)
          
          resolve({
            success: false,
            port,
            url,
            isNewServer: false,
            message: `服务器进程退出 (code: ${code})`
          })
        }
      })

      // 开始检查
      setTimeout(checkServerReady, 2000) // 2秒后开始检查
    })
  }

  /**
   * 停止服务器
   */
  static async stopServer(port: number): Promise<boolean> {
    const serverProcess = this.runningServers.get(port)
    
    if (serverProcess && !serverProcess.killed) {
      console.log(`🛑 停止端口 ${port} 上的服务器...`)
      
      // 优雅关闭
      serverProcess.kill('SIGTERM')
      
      // 等待进程关闭
      const closed = await PortChecker.waitForPortClose(port)
      
      if (!closed) {
        // 强制关闭
        console.log(`⚡ 强制关闭端口 ${port} 上的服务器...`)
        serverProcess.kill('SIGKILL')
      }
      
      this.runningServers.delete(port)
      return true
    }
    
    return false
  }

  /**
   * 停止所有服务器
   */
  static async stopAllServers(): Promise<void> {
    const ports = Array.from(this.runningServers.keys())
    
    if (ports.length > 0) {
      console.log(`🛑 停止所有运行中的服务器 (${ports.length} 个)...`)
      
      const stopPromises = ports.map(port => this.stopServer(port))
      await Promise.all(stopPromises)
      
      console.log('✅ 所有服务器已停止')
    }
  }

  /**
   * 获取运行中的服务器列表
   */
  static getRunningServers(): number[] {
    return Array.from(this.runningServers.keys())
  }

  /**
   * 为Vite项目启动开发服务器
   */
  static async startViteServer(options: {
    port?: number
    host?: string
    reuseExisting?: boolean
    timeout?: number
  } = {}): Promise<DevServerResult> {
    const config: DevServerConfig = {
      port: options.port || 5173,
      host: options.host || 'localhost',
      command: 'npm',
      args: ['run', 'dev', '--', '--port', (options.port || 5173).toString(), '--host', options.host || 'localhost'],
      timeout: options.timeout || 60000,
      reuseExisting: options.reuseExisting !== false // 默认复用
    }

    return this.startServer(config)
  }

  /**
   * 为测试环境启动服务器
   */
  static async startTestServer(options: {
    port?: number
    host?: string
    timeout?: number
  } = {}): Promise<DevServerResult> {
    // 测试环境优先复用现有服务器
    return this.startViteServer({
      ...options,
      reuseExisting: true
    })
  }
}

// 进程退出时清理
process.on('SIGINT', async () => {
  console.log('\n🛑 收到退出信号，清理服务器...')
  await DevServerManager.stopAllServers()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到终止信号，清理服务器...')
  await DevServerManager.stopAllServers()
  process.exit(0)
})

// CLI使用
if (require.main === module) {
  const args = process.argv.slice(2)
  const port = parseInt(args[0]) || 5173
  const host = args[1] || 'localhost'
  const reuseExisting = args[2] !== 'false'

  console.log(`🚀 启动开发服务器...`)
  console.log(`   端口: ${port}`)
  console.log(`   主机: ${host}`)
  console.log(`   复用现有: ${reuseExisting}`)

  DevServerManager.startViteServer({
    port,
    host,
    reuseExisting
  }).then(result => {
    if (result.success) {
      console.log(`✅ ${result.message}`)
      console.log(`🌐 服务器地址: ${result.url}`)
      
      if (result.isNewServer) {
        console.log('按 Ctrl+C 停止服务器')
        
        // 保持进程运行
        process.stdin.resume()
      }
    } else {
      console.error(`❌ ${result.message}`)
      process.exit(1)
    }
  }).catch(error => {
    console.error('❌ 启动失败:', error.message)
    process.exit(1)
  })
}