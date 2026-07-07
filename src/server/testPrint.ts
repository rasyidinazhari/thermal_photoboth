import { createServerFn } from '@tanstack/react-start'
import { getConfigSync } from './config'
import * as path from 'node:path'
import * as fs from 'node:fs'

// === Shared Types ===

export type PrintAlignment = 'left' | 'center' | 'right'
export type PrintSize = 'normal' | 'double'
export type DividerChar = '=' | '-' | '*'

export interface TextElement {
  type: 'text'
  id: string
  content: string
  alignment: PrintAlignment
  bold: boolean
  size: PrintSize
}

export interface ImageElement {
  type: 'image'
  id: string
  imageBase64: string
}

export interface QrElement {
  type: 'qr'
  id: string
  data: string
}

export interface DividerElement {
  type: 'divider'
  id: string
  char: DividerChar
}

export interface BlankElement {
  type: 'blank'
  id: string
  lines: number
}

export type PrintElement = TextElement | ImageElement | QrElement | DividerElement | BlankElement

interface TestPrintRequest {
  elements: PrintElement[]
  paperWidth: number
}

// === Server Function ===

export const executeTestPrint = createServerFn({ method: 'POST' })
  .validator((data: TestPrintRequest) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const config = getConfigSync()

    if (!config.printer.enabled) {
      return { success: false, error: 'Printer tidak aktif. Aktifkan di halaman Settings.' }
    }

    if (!data.elements.length) {
      return { success: false, error: 'Tidak ada elemen untuk dicetak.' }
    }

    try {
      const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = await import('node-thermal-printer')

      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: config.printer.interface,
        characterSet: CharacterSet.PC852_LATIN2,
        removeSpecialCharacters: false,
        lineCharacter: '=',
        breakLine: BreakLine.WORD,
        options: { timeout: 5000 },
      })

      // Skip connection check for serial/USB ports — isPrinterConnected() hangs
      // or returns false on macOS Bluetooth SPP even when port exists.
      // Shell-based cat handles delivery for serial ports.
      const iface = config.printer.interface
      if (!iface.startsWith('/') && !iface.startsWith('\\\\')) {
        const isConnected = await printer.isPrinterConnected()
        if (!isConnected) {
          return { success: false, error: `Printer tidak terhubung di ${iface}` }
        }
      }

      const charsPerLine = data.paperWidth === 58 ? 32 : 48

      for (const el of data.elements) {
        switch (el.type) {
          case 'text': {
            if (el.alignment === 'center') printer.alignCenter()
            else if (el.alignment === 'right') printer.alignRight()
            else printer.alignLeft()

            if (el.bold) printer.bold(true)
            if (el.size === 'double') {
              printer.setTextDoubleHeight()
              printer.setTextDoubleWidth()
            } else {
              printer.setTextNormal()
            }

            const lines = (el.content || '').split('\n')
            for (const line of lines) {
              printer.println(line)
            }

            if (el.bold) printer.bold(false)
            printer.setTextNormal()
            printer.alignLeft()
            break
          }

          case 'image': {
            if (el.imageBase64) {
              const base64Data = el.imageBase64.replace(/^data:image\/\w+;base64,/, '')
              const tmpPath = path.join(process.cwd(), 'public', `tmp_test_${Date.now()}.png`)
              fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
              try {
                printer.alignCenter()
                await printer.printImage(tmpPath)
                printer.alignLeft()
              } finally {
                try { fs.unlinkSync(tmpPath) } catch {}
              }
            }
            break
          }

          case 'qr': {
            if (el.data) {
              printer.alignCenter()
              try {
                await printer.printQR(el.data, { cellSize: 6, correction: 'M', model: 2 })
              } catch {
                // Fallback: print QR data as text if native QR not supported
                printer.println(`QR: ${el.data}`)
              }
              printer.alignLeft()
            }
            break
          }

          case 'divider': {
            printer.println((el.char || '=').repeat(charsPerLine))
            break
          }

          case 'blank': {
            for (let i = 0; i < (el.lines || 1); i++) {
              printer.newLine()
            }
            break
          }
        }
      }

      printer.newLine()
      printer.cut()

      // Shell-based printing for serial/USB ports (same pattern as printer.ts)
      let port = config.printer.interface
      if (port.startsWith('/dev/tty.')) {
        port = port.replace('/dev/tty.', '/dev/cu.')
        console.log(`Auto-corrected Mac port to ${port}`)
      }

      if (port.startsWith('/') || port.startsWith('\\\\')) {
        const buffer = printer.buffer
        if (!buffer || buffer.length === 0) {
          return { success: false, error: 'Print buffer kosong' }
        }

        const { SerialPort } = await import('serialport')

        console.log(`Connecting to serial port: ${port} at 115200 baud`)
        
        // Use a Promise to await the write to return success/failure cleanly
        await new Promise<void>((resolve, reject) => {
          const serialPort = new SerialPort({
            path: port,
            baudRate: 115200,
            autoOpen: false,
          })

          serialPort.open((err) => {
            if (err) {
              console.error('Error opening port:', err.message)
              reject(err)
              return
            }
            
            console.log('Port opened, writing buffer...')
            serialPort.write(buffer, (err) => {
              if (err) {
                console.error('Error writing to port:', err.message)
                reject(err)
              } else {
                console.log('=== TEST PRINT SELESAI (via serialport) ===')
                resolve()
              }
              
              // Close after writing
              setTimeout(() => {
                serialPort.close()
              }, 500)
            })
          })
        })

        printer.clear()
      } else if (port.startsWith('printer:')) {
        const buffer = printer.buffer
        if (!buffer || buffer.length === 0) {
          return { success: false, error: 'Print buffer kosong' }
        }

        const printerName = port.replace('printer:', '')
        const tmpFile = path.join(process.cwd(), 'public', 'tmp_test_print.bin')
        fs.writeFileSync(tmpFile, buffer)

        const { exec } = await import('child_process')
        // lpr -P "PRINTER_NAME" -o raw file.bin (sends raw ESC/POS bypassing macOS drivers)
        const cmd = `lpr -P "${printerName}" -o raw "${tmpFile}"`
        console.log(`Executing CUPS print command: ${cmd}`)
        
        await new Promise<void>((resolve, reject) => {
          exec(cmd, (error) => {
            if (error) {
              console.error('CUPS print error:', error.message)
              reject(error)
            } else {
              console.log('=== TEST PRINT SELESAI (via CUPS lpr) ===')
              resolve()
            }
          })
        })
        
        printer.clear()
      } else {
        printer.execute().catch((err) => console.error('Test print error:', err))
      }

      return { success: true }
    } catch (error) {
      console.error('Test print failed:', error)
      return { success: false, error: String(error) }
    }
  })
