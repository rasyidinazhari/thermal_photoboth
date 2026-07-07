import { createServerFn } from '@tanstack/react-start'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { getConfigSync } from './config'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execAsync = promisify(exec)

// === Types ===

export interface BluetoothDevice {
  name: string
  address: string
  connected: boolean
  rssi?: number
  services?: string
}

export interface ScanResult {
  devices: BluetoothDevice[]
  serialPorts: string[]
  bluetoothEnabled: boolean
  hasBlueutil: boolean
  currentInterface: string
}

// === Parser ===

function parseBluetoothOutput(output: string): { devices: BluetoothDevice[]; enabled: boolean } {
  const enabled = output.includes('State: On')
  const devices: BluetoothDevice[] = []

  let section: 'connected' | 'disconnected' | null = null
  let dev: Partial<BluetoothDevice> | null = null

  const flush = () => {
    if (dev?.address) {
      devices.push({
        name: dev.name || 'Unknown',
        address: dev.address,
        connected: dev.connected ?? false,
        rssi: dev.rssi,
        services: dev.services,
      })
    }
    dev = null
  }

  for (const raw of output.split('\n')) {
    const t = raw.trim()
    if (!t) continue

    if (t === 'Connected:') { flush(); section = 'connected'; continue }
    if (t === 'Not Connected:') { flush(); section = 'disconnected'; continue }
    if (t === 'Bluetooth Controller:') { flush(); section = null; continue }
    if (!section) continue

    // Device name: line ending with ":" that is NOT a key-value pair (no ": " inside)
    if (t.endsWith(':') && !t.includes(': ')) {
      flush()
      dev = { name: t.slice(0, -1), connected: section === 'connected' }
      continue
    }

    // Key-value properties
    if (dev) {
      const kv = t.match(/^(\w[\w\s]*?):\s+(.+)$/)
      if (kv) {
        const [, key, val] = kv
        if (key === 'Address') dev.address = val
        else if (key === 'RSSI') dev.rssi = parseInt(val)
        else if (key === 'Services') dev.services = val
      }
    }
  }

  flush()
  return { devices, enabled }
}

// === Server Functions ===

export const scanBluetooth = createServerFn({ method: 'GET' })
  .handler(async (): Promise<ScanResult> => {
    const config = getConfigSync()

    try {
      let devices: BluetoothDevice[] = []
      let enabled = false
      let serialPorts: string[] = []
      let hasBlueutil = false

      if (process.platform === 'darwin') {
        // macOS: Scan Bluetooth devices
        try {
          const { stdout: btOutput } = await execAsync('system_profiler SPBluetoothDataType', { timeout: 10000 })
          const parsed = parseBluetoothOutput(btOutput)
          devices = parsed.devices
          enabled = parsed.enabled
        } catch (e) { console.error('Mac BT scan error:', e) }

        // macOS: List serial ports
        try {
          const { stdout: portOutput } = await execAsync('ls /dev/cu.* 2>/dev/null')
          serialPorts = portOutput.trim().split('\n').filter(Boolean)
          // Filter out generic system ports, keep relevant ones
          serialPorts = serialPorts.filter(p => !p.includes('Bluetooth-Incoming-Port'))
        } catch {}

        // macOS: Check blueutil
        try {
          await execAsync('which blueutil')
          hasBlueutil = true
        } catch {}
      } else {
        // Windows/Linux: Use serialport library to list COM ports (including Bluetooth virtual COM ports)
        try {
          const { SerialPort } = await import('serialport')
          const ports = await SerialPort.list()
          serialPorts = ports.map(p => p.path)
          // We can't easily scan BT status on Windows from Node without native modules, 
          // but Windows automatically maps paired BT printers to COM ports.
          enabled = true 
        } catch (e) { console.error('SerialPort list error:', e) }
      }

      return {
        devices,
        serialPorts,
        bluetoothEnabled: enabled,
        hasBlueutil,
        currentInterface: config.printer.interface,
      }
    } catch (error) {
      console.error('Bluetooth scan failed:', error)
      return {
        devices: [],
        serialPorts: [],
        bluetoothEnabled: false,
        hasBlueutil: false,
        currentInterface: config.printer.interface,
      }
    }
  })

export const connectBluetoothDevice = createServerFn({ method: 'POST' })
  .validator((data: { address: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      try { await execAsync('which blueutil') } catch {
        return { success: false, error: 'blueutil tidak terinstall. Jalankan: brew install blueutil' }
      }

      await execAsync(`blueutil --connect "${data.address}"`, { timeout: 15000 })
      // Wait a moment for serial port to appear
      await new Promise(r => setTimeout(r, 2000))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

export const disconnectBluetoothDevice = createServerFn({ method: 'POST' })
  .validator((data: { address: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      try { await execAsync('which blueutil') } catch {
        return { success: false, error: 'blueutil tidak terinstall. Jalankan: brew install blueutil' }
      }

      await execAsync(`blueutil --disconnect "${data.address}"`, { timeout: 10000 })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

export const switchPrinterPort = createServerFn({ method: 'POST' })
  .validator((data: { port: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      const config = getConfigSync()
      config.printer.interface = data.port
      config.printer.enabled = true

      const configPath = path.join(process.cwd(), 'data', 'config.json')
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
