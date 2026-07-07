import { createServerFn } from '@tanstack/react-start'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { printPhoto } from './printer'
import { getConfigSync } from './config'

export const uploadPhoto = createServerFn({ method: 'POST' })
  .validator((data: { imageBase64: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { imageBase64 } = data
      
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, 'base64')
      
      const id = uuidv4()
      const filename = `${id}.png`
      const filepath = path.join(process.cwd(), 'public', 'uploads', filename)
      
      const dir = path.dirname(filepath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filepath, buffer)

      // In production (Nitro), the server serves from .output/public
      // So we also copy it there to ensure the gallery can read it instantly
      const nitroPath = path.join(process.cwd(), '.output', 'public', 'uploads', filename)
      const nitroDir = path.dirname(nitroPath)
      if (fs.existsSync(path.join(process.cwd(), '.output'))) {
        if (!fs.existsSync(nitroDir)) {
          fs.mkdirSync(nitroDir, { recursive: true })
        }
        fs.writeFileSync(nitroPath, buffer)
      }

      // Printer is now manual-only, so we do not auto-print here.
      
      return { success: true, id, filename }
    } catch (error) {
      console.error("Upload error:", error)
      return { success: false, error: "Failed to upload image" }
    }
  })
