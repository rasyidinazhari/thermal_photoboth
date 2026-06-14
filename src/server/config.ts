import { createServerFn } from '@tanstack/react-start'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface AppConfig {
  frame: {
    enabled: boolean
    imageUrl: string // URL or base64
  }
  watermark: {
    enabled: boolean
    text: string
  }
  photo: {
    countdownSeconds: number
    qrDisplaySeconds: number
    qrBaseUrl?: string // Custom base URL for the QR code (e.g., http://192.168.1.10:3000)
  }
  printer: {
    enabled: boolean
    interface: string // e.g. "tcp://192.168.1.100" or "/dev/usb/lp0"
    paperWidth: number // 58 or 80
  }
}

const DEFAULT_CONFIG: AppConfig = {
  frame: {
    enabled: false,
    imageUrl: ""
  },
  watermark: {
    enabled: true,
    text: "thermal photoboth by ASIRO | supported by Alfabet Innovation"
  },
  photo: {
    countdownSeconds: 5,
    qrDisplaySeconds: 15,
    qrBaseUrl: ""
  },
  printer: {
    enabled: false,
    interface: "tcp://192.168.1.100",
    paperWidth: 80
  }
}

function getConfigPath() {
  return path.join(process.cwd(), 'data', 'config.json')
}

export function getConfigSync(): AppConfig {
  try {
    const configPath = getConfigPath()
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG
    }
    const fileData = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(fileData) as AppConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch (error) {
    return DEFAULT_CONFIG
  }
}

export const getConfig = createServerFn({ method: 'GET' })
  .handler(async (): Promise<AppConfig> => {
    try {
      const configPath = getConfigPath()
      if (!fs.existsSync(configPath)) {
        // Create default if it doesn't exist
        fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2))
        return DEFAULT_CONFIG
      }
      
      const fileData = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(fileData) as AppConfig
      return { ...DEFAULT_CONFIG, ...config } // Merge with defaults to ensure all fields exist
    } catch (error) {
      console.error("Failed to read config:", error)
      return DEFAULT_CONFIG
    }
  })

export const saveConfig = createServerFn({ method: 'POST' })
  .validator((data: AppConfig) => data)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      const configPath = getConfigPath()
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
      return { success: true }
    } catch (error) {
      console.error("Failed to save config:", error)
      return { success: false }
    }
  })
