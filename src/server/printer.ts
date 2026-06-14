import type { AppConfig } from './config'
import { createServerFn } from '@tanstack/react-start'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { getConfigSync } from './config'

export async function printPhoto(imagePath: string, config: AppConfig) {
  if (!config.printer.enabled) return { success: false, error: "Printer disabled in config" }

  try {
    const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = await import('node-thermal-printer')
    
    const printer = new ThermalPrinter({
      type: config.printer.paperWidth === 58 ? PrinterTypes.EPSON : PrinterTypes.EPSON, // Adjust based on printer
      interface: config.printer.interface,
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: "=",
      breakLine: BreakLine.WORD,
      options: {
        timeout: 5000
      }
    })

    const isConnected = await printer.isPrinterConnected()
    if (!isConnected) {
      console.error("Printer is not connected at", config.printer.interface)
      return { success: false, error: "Printer not connected" }
    }

    printer.alignCenter()
    printer.println("==================================")
    printer.println("       SMART PHOTOBOOTH")
    printer.println("==================================")
    printer.newLine()

    // Print the actual captured photo
    // node-thermal-printer requires the path to a PNG/JPG file
    await printer.printImage(imagePath)

    printer.newLine()
    printer.println("Thank you for using our service!")
    printer.println(new Date().toLocaleString())
    printer.newLine()
    printer.newLine()
    printer.cut()

    // Execute printing
    await printer.execute()
    console.log("Print job executed successfully.")
    
    return { success: true }
  } catch (error) {
    console.error("Print failed:", error)
    return { success: false, error: String(error) }
  }
}

export const triggerPrintPhoto = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    try {
      const config = getConfigSync()
      if (!config.printer.enabled) {
        return { success: false, error: "Printer is not enabled in settings." }
      }

      const filepath = path.join(process.cwd(), 'public', 'uploads', `${data.id}.jpg`)
      if (!fs.existsSync(filepath)) {
        return { success: false, error: "Photo not found." }
      }

      const result = await printPhoto(filepath, config)
      return result || { success: false, error: "Unknown error" }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
