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

    // Bypass node-thermal-printer's hardcoded 5s timeout for file/COM interfaces
    let port = config.printer.interface;
    if (port.startsWith('/dev/tty.')) {
      // Auto-fix for macOS: tty ports block waiting for DCD, cu ports do not.
      port = port.replace('/dev/tty.', '/dev/cu.');
      console.log(`Auto-corrected Mac port to ${port} to prevent hanging`);
    }

    if (port.startsWith('/') || port.startsWith('\\\\')) {
      const buffer = printer.buffer; // Access the property directly to avoid "not a function" error
      
      console.log(`Prepared print buffer. Size: ${buffer?.length || 0} bytes.`);
      if (!buffer || buffer.length === 0) {
        console.error("Buffer is empty, nothing to print!");
        return { success: false, error: "Buffer kosong" };
      }

      // We use the serialport library to write to the port on macOS/Linux.
      import('serialport').then(({ SerialPort }) => {
        console.log(`Connecting to serial port: ${port} at 115200 baud`);
        const serialPort = new SerialPort({
          path: port,
          baudRate: 115200,
          autoOpen: false,
        });

        serialPort.open((err) => {
          if (err) {
            console.error('Error opening port:', err.message);
            return;
          }
          console.log('Port opened, writing buffer...');
          serialPort.write(buffer, (err) => {
            if (err) {
              console.error('Error writing to port:', err.message);
            } else {
              console.log('=== TRANSFER KE PRINTER SELESAI VIA SERIALPORT ===');
            }
            // Close after writing to free the resource
            setTimeout(() => {
              serialPort.close();
            }, 500);
          });
        });
      });
      
      printer.clear()
    } else if (port.startsWith('printer:')) {
      const printerName = port.replace('printer:', '');
      const tmpFile = path.join(process.cwd(), 'public', 'tmp_print.bin');
      fs.writeFileSync(tmpFile, buffer);

      import('child_process').then(({ exec }) => {
        const cmd = `lpr -P "${printerName}" -o raw "${tmpFile}"`;
        console.log(`Executing CUPS print command: ${cmd}`);
        exec(cmd, (error) => {
          if (error) {
            console.error("CUPS print error:", error.message);
          } else {
            console.log("=== TRANSFER KE PRINTER SELESAI VIA CUPS LPR ===");
          }
        });
      });
      
      printer.clear()
    } else {
      // For network printers, we can just execute normally (it's fast)
      printer.execute().catch((err) => console.error("Print execution failed:", err));
    }
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

      const filepath = path.join(process.cwd(), 'public', 'uploads', `${data.id}.png`)
      if (!fs.existsSync(filepath)) {
        return { success: false, error: "Photo not found." }
      }

      const result = await printPhoto(filepath, config)
      return result || { success: false, error: "Unknown error" }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
