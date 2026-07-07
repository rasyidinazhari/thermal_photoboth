import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { getConfig, saveConfig } from '../server/config'
import type { AppConfig } from '../server/config'
import { scanBluetooth, connectBluetoothDevice, disconnectBluetoothDevice, switchPrinterPort } from '../server/bluetooth'
import type { ScanResult } from '../server/bluetooth'
import { executeTestPrint } from '../server/testPrint'
import type {
  PrintElement,
  PrintAlignment,
  DividerChar,
  ImageElement,
} from '../server/testPrint'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Plus,
  Type,
  Image as ImageIcon,
  QrCode,
  Minus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Printer,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Maximize2,
  Bluetooth,
} from 'lucide-react'

export const Route = createFileRoute('/test')({
  loader: async () => await getConfig(),
  component: TestPage,
})

// === Helpers ===

let counter = 0
function newId(): string {
  return `el-${Date.now()}-${++counter}`
}

function createDefault(type: PrintElement['type']): PrintElement {
  const id = newId()
  switch (type) {
    case 'text':
      return { type: 'text', id, content: '', alignment: 'left', bold: false, size: 'normal' }
    case 'image':
      return { type: 'image', id, imageBase64: '' }
    case 'qr':
      return { type: 'qr', id, data: '' }
    case 'divider':
      return { type: 'divider', id, char: '=' }
    case 'blank':
      return { type: 'blank', id, lines: 1 }
  }
}

const ELEMENT_TYPES: { type: PrintElement['type']; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <Type size={16} /> },
  { type: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
  { type: 'qr', label: 'QR Code', icon: <QrCode size={16} /> },
  { type: 'divider', label: 'Divider', icon: <Minus size={16} /> },
  { type: 'blank', label: 'Blank', icon: <span className="inline-block w-4 text-center text-xs font-mono leading-none">¶</span> },
]

// === Bluetooth Section ===

function BluetoothSection({ config, onPortChanged }: { config: AppConfig; onPortChanged: () => void }) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [connecting, setConnecting] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const doScan = async () => {
    setIsScanning(true)
    setError(null)
    try {
      const result = await scanBluetooth()
      setScanResult(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => { doScan() }, [])

  const handleConnect = async (address: string) => {
    setConnecting(c => ({ ...c, [address]: true }))
    try {
      const result = await connectBluetoothDevice({ data: { address } })
      if (!result.success) setError(result.error || 'Gagal connect')
      else await doScan()
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(c => ({ ...c, [address]: false }))
    }
  }

  const handleDisconnect = async (address: string) => {
    setConnecting(c => ({ ...c, [address]: true }))
    try {
      const result = await disconnectBluetoothDevice({ data: { address } })
      if (!result.success) setError(result.error || 'Gagal disconnect')
      else await doScan()
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(c => ({ ...c, [address]: false }))
    }
  }

  const handleUsePort = async (port: string) => {
    try {
      const result = await switchPrinterPort({ data: { port } })
      if (result.success) {
        onPortChanged()
        await doScan()
      } else {
        setError(result.error || 'Gagal ganti port')
      }
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <Bluetooth size={14} />
          Perangkat Printer
        </h2>
        <button
          onClick={doScan}
          disabled={isScanning}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
        >
          <RotateCcw size={12} className={isScanning ? 'animate-spin' : ''} />
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {isScanning && !scanResult && (
        <div className="text-center text-xs text-zinc-500 py-6">
          <RotateCcw size={16} className="animate-spin mx-auto mb-2" />
          Memindai perangkat Bluetooth...
        </div>
      )}

      {scanResult && (
        <>
          {/* Bluetooth status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${scanResult.bluetoothEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-zinc-400">
              Bluetooth {scanResult.bluetoothEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
            {!scanResult.hasBlueutil && (
              <span className="text-zinc-600 text-[10px]">• blueutil belum terinstall (brew install blueutil)</span>
            )}
          </div>

          {/* Device list */}
          {scanResult.devices.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-zinc-500 font-medium">Perangkat Bluetooth:</span>
              {scanResult.devices.map((device) => (
                <div
                  key={device.address}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-200 truncate">{device.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {device.address}
                      {device.rssi != null && <span className="ml-2">RSSI: {device.rssi}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${device.connected ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${device.connected ? 'bg-green-400' : 'bg-zinc-600'}`} />
                      {device.connected ? 'Connected' : 'Off'}
                    </span>
                    {scanResult.hasBlueutil && (
                      <button
                        onClick={() => device.connected ? handleDisconnect(device.address) : handleConnect(device.address)}
                        disabled={connecting[device.address]}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition border ${device.connected ? 'border-red-800/60 text-red-400 hover:bg-red-900/30' : 'border-teal-700/60 text-teal-400 hover:bg-teal-900/30'} disabled:opacity-50`}
                      >
                        {connecting[device.address] ? '...' : device.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Serial ports */}
          {scanResult.serialPorts.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-zinc-500 font-medium">Serial Port:</span>
              {scanResult.serialPorts.map((port) => (
                <div
                  key={port}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    port === scanResult.currentInterface
                      ? 'border-teal-700/50 bg-teal-900/20'
                      : 'border-zinc-800 bg-zinc-800/50'
                  }`}
                >
                  <span className="text-xs font-mono text-zinc-300 truncate">{port}</span>
                  <div className="shrink-0 ml-3">
                    {port === scanResult.currentInterface ? (
                      <span className="text-[11px] text-teal-400 font-semibold">● Aktif</span>
                    ) : (
                      <button
                        onClick={() => handleUsePort(port)}
                        className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-teal-600 hover:text-teal-400"
                      >
                        Gunakan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Manual Input */}
          <div className="space-y-1.5 mt-4">
            <span className="text-xs text-zinc-500 font-medium">Input Port Manual (Windows / Mac USB / TCP):</span>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                defaultValue={scanResult.currentInterface}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUsePort(e.currentTarget.value)
                }}
                onBlur={(e) => handleUsePort(e.target.value)}
                placeholder="Misal: COM3, printer:BP_ECO58, tcp://192.168.1.100:9100" 
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-600 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500 pt-1">
              <span>Contoh:</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded cursor-help" title="Mac USB via CUPS">printer:NAMA_PRINTER</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded cursor-help" title="Windows Bluetooth/USB">COM3</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded cursor-help" title="Jaringan lokal WiFi/LAN">tcp://192.168.1.10:9100</span>
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded cursor-help" title="Mac Serial (Fallback)">/dev/cu.usbserial</span>
            </div>
          </div>

          {/* Permissions note */}
          <details className="group mt-2">
            <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition">
              ℹ Referensi Port & Izin (Cross-platform)
            </summary>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-800/20 px-3 py-2 text-[11px] text-zinc-500 space-y-1">
              <ul className="list-disc list-inside space-y-0.5">
                <li><strong>Windows (COM):</strong> Masukkan <code className="bg-zinc-800 rounded px-1">COMx</code> untuk printer USB/Bluetooth. Windows otomatis map Bluetooth ke port COM.</li>
                <li><strong>Mac (USB):</strong> Tambahkan printer di "Printers & Scanners" Mac (pilih driver Generic), lalu gunakan <code className="bg-zinc-800 rounded px-1">printer:NAMA</code></li>
                <li><strong>Mac (Bluetooth):</strong> Karena limitasi sistem Mac, print via Bluetooth SPP sering gagal. Disarankan via USB atau TCP.</li>
                <li><strong>TCP (LAN/WiFi):</strong> Sangat stabil di semua OS. Mungkin memunculkan popup izin Local Network pertama kali di Mac.</li>
              </ul>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

// === Element Card ===

function ElementCard({
  element,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  paperWidth,
}: {
  element: PrintElement
  onChange: (updated: PrintElement) => void
  onRemove: () => void
  onMoveUp: (() => void) | null
  onMoveDown: (() => void) | null
  paperWidth: number
}) {
  const typeInfo = ELEMENT_TYPES.find((t) => t.type === element.type)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || element.type !== 'image') return

    const reader = new FileReader()
    reader.onloadend = () => {
      const img = document.createElement('img') as HTMLImageElement
      img.onload = () => {
        const maxWidth = paperWidth === 58 ? 200 : 384
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h)
          onChange({ ...element, imageBase64: canvas.toDataURL('image/png') } as ImageElement)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden rise-in">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
            {typeInfo?.icon}
          </span>
          {typeInfo?.label}
        </div>
        <div className="flex items-center gap-0.5">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
              title="Pindah ke atas"
            >
              <ArrowUp size={14} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
              title="Pindah ke bawah"
            >
              <ArrowDown size={14} />
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-red-900/40 hover:text-red-400 transition"
            title="Hapus elemen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Card body — type-specific controls */}
      <div className="p-3 space-y-3">
        {element.type === 'text' && (
          <>
            <textarea
              value={element.content}
              onChange={(e) => onChange({ ...element, content: e.target.value })}
              placeholder="Masukkan teks..."
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              {/* Alignment */}
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
                {(['left', 'center', 'right'] as PrintAlignment[]).map((align) => {
                  const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
                  return (
                    <button
                      key={align}
                      onClick={() => onChange({ ...element, alignment: align })}
                      className={`p-1.5 transition ${
                        element.alignment === align
                          ? 'bg-teal-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                      title={align}
                    >
                      <Icon size={14} />
                    </button>
                  )
                })}
              </div>
              {/* Bold */}
              <button
                onClick={() => onChange({ ...element, bold: !element.bold })}
                className={`rounded-lg border p-1.5 transition ${
                  element.bold
                    ? 'border-teal-500 bg-teal-600 text-white'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
                title="Bold"
              >
                <Bold size={14} />
              </button>
              {/* Size */}
              <button
                onClick={() => onChange({ ...element, size: element.size === 'normal' ? 'double' : 'normal' })}
                className={`rounded-lg border p-1.5 transition ${
                  element.size === 'double'
                    ? 'border-teal-500 bg-teal-600 text-white'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
                title={element.size === 'double' ? 'Ukuran: Double' : 'Ukuran: Normal'}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </>
        )}

        {element.type === 'image' && (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 file:cursor-pointer file:transition"
            />
            {element.imageBase64 && (
              <div className="mt-1">
                <img
                  src={element.imageBase64}
                  alt="Preview"
                  className="max-h-24 rounded-lg bg-zinc-800 p-1 object-contain"
                />
              </div>
            )}
          </>
        )}

        {element.type === 'qr' && (
          <input
            type="text"
            value={element.data}
            onChange={(e) => onChange({ ...element, data: e.target.value })}
            placeholder="Data QR (URL, teks, dll)..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none"
          />
        )}

        {element.type === 'divider' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 shrink-0">Karakter:</span>
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              {(['=', '-', '*'] as const).map((char) => (
                <button
                  key={char}
                  onClick={() => onChange({ ...element, char })}
                  className={`px-3 py-1 text-sm font-mono transition ${
                    element.char === char
                      ? 'bg-teal-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {element.type === 'blank' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 shrink-0">Jumlah baris:</span>
            <input
              type="number"
              min={1}
              max={10}
              value={element.lines}
              onChange={(e) =>
                onChange({ ...element, lines: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })
              }
              className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white text-center focus:border-teal-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// === Receipt Preview ===

function ReceiptPreview({
  elements,
  paperWidth,
}: {
  elements: PrintElement[]
  paperWidth: number
}) {
  const receiptWidth = paperWidth === 58 ? 260 : 360
  const charsPerLine = paperWidth === 58 ? 32 : 48
  const fontSize = paperWidth === 58 ? 11 : 12

  return (
    <div className="flex flex-col items-center">
      {/* Receipt paper */}
      <div
        className="relative overflow-hidden rounded-t-lg"
        style={{
          width: receiptWidth,
          minHeight: 200,
          background: '#fafaf8',
          fontFamily: "'Courier New', Courier, monospace",
          color: '#1a1a1a',
          fontSize,
          lineHeight: 1.4,
          padding: '16px 12px',
          boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
        }}
      >
        {elements.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center py-12"
            style={{ color: '#bbb' }}
          >
            <Printer size={32} strokeWidth={1} />
            <p className="mt-3 text-xs">
              Tambahkan elemen
              <br />
              untuk melihat preview
            </p>
          </div>
        ) : (
          <div>
            {elements.map((el) => {
              switch (el.type) {
                case 'text': {
                  const textAlign = el.alignment || 'left'
                  const fontWeight = el.bold ? 'bold' : 'normal'
                  const scale = el.size === 'double' ? 1.75 : 1
                  return (
                    <div
                      key={el.id}
                      style={{
                        textAlign,
                        fontWeight,
                        fontSize: fontSize * scale,
                        lineHeight: 1.3,
                      }}
                    >
                      {(el.content || '\u00A0').split('\n').map((line, i) => (
                        <div key={i}>{line || '\u00A0'}</div>
                      ))}
                    </div>
                  )
                }

                case 'image':
                  return el.imageBase64 ? (
                    <div key={el.id} className="flex justify-center py-1">
                      <img
                        src={el.imageBase64}
                        alt=""
                        style={{ maxWidth: '100%', height: 'auto' }}
                      />
                    </div>
                  ) : (
                    <div
                      key={el.id}
                      className="flex items-center justify-center py-3 my-1 rounded"
                      style={{
                        border: '1px dashed #ccc',
                        color: '#bbb',
                        fontSize: 10,
                      }}
                    >
                      [Image belum dipilih]
                    </div>
                  )

                case 'qr':
                  return el.data ? (
                    <div key={el.id} className="flex justify-center py-2">
                      <QRCodeSVG
                        value={el.data}
                        size={Math.round(receiptWidth * 0.5)}
                        level="M"
                      />
                    </div>
                  ) : (
                    <div
                      key={el.id}
                      className="flex items-center justify-center py-3 my-1 rounded"
                      style={{
                        border: '1px dashed #ccc',
                        color: '#bbb',
                        fontSize: 10,
                      }}
                    >
                      [QR data kosong]
                    </div>
                  )

                case 'divider':
                  return (
                    <div
                      key={el.id}
                      style={{
                        textAlign: 'center',
                        letterSpacing: 0,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(el.char || '=').repeat(charsPerLine)}
                    </div>
                  )

                case 'blank':
                  return (
                    <div key={el.id}>
                      {Array.from({ length: el.lines || 1 }).map((_, i) => (
                        <div key={i}>{'\u00A0'}</div>
                      ))}
                    </div>
                  )

                default:
                  return null
              }
            })}
          </div>
        )}
      </div>

      {/* Torn paper edge */}
      <svg
        width={receiptWidth}
        height="12"
        viewBox={`0 0 ${receiptWidth} 12`}
        className="block"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      >
        <defs>
          <pattern id="tear" width="16" height="12" patternUnits="userSpaceOnUse">
            <polygon points="0,0 8,12 16,0" fill="#fafaf8" />
          </pattern>
        </defs>
        <rect width={receiptWidth} height="12" fill="url(#tear)" />
      </svg>

      {/* Paper size info */}
      <div className="mt-3 text-xs text-zinc-500 font-mono">
        {paperWidth}mm &bull; {charsPerLine} karakter/baris
      </div>
    </div>
  )
}

// === Main Page ===

function TestPage() {
  const config = Route.useLoaderData() as AppConfig
  const router = useRouter()
  const [elements, setElements] = useState<PrintElement[]>([])
  const [paperWidth, setPaperWidth] = useState<number>(config.printer.paperWidth || 80)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printResult, setPrintResult] = useState<{
    success: boolean
    error?: string
  } | null>(null)

  // Auto-dismiss print result after 4 seconds
  useEffect(() => {
    if (printResult) {
      const timer = setTimeout(() => setPrintResult(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [printResult])

  const addElement = useCallback((type: PrintElement['type']) => {
    setElements((prev) => [...prev, createDefault(type)])
  }, [])

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id))
  }, [])

  const updateElement = useCallback((id: string, updated: PrintElement) => {
    setElements((prev) => prev.map((el) => (el.id === id ? updated : el)))
  }, [])

  const moveElement = useCallback((id: string, direction: 'up' | 'down') => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id)
      if (idx < 0) return prev
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setElements([])
    setPrintResult(null)
  }, [])

  const handlePrint = async () => {
    if (!elements.length) return
    setIsPrinting(true)
    setPrintResult(null)
    try {
      const result = await executeTestPrint({
        data: { elements, paperWidth },
      })
      setPrintResult(result)
    } catch (error) {
      setPrintResult({ success: false, error: String(error) })
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-full bg-zinc-800 p-2.5 transition hover:bg-zinc-700"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold sm:text-2xl">Test Print</h1>
          </div>

          {/* Paper size toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 hidden sm:inline">Kertas:</span>
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              {[58, 80].map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`px-3 py-1.5 text-sm font-semibold transition ${
                    paperWidth === w
                      ? 'bg-teal-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_auto]">
          {/* Left — Controls */}
          <div className="space-y-5 min-w-0">
            {/* Bluetooth / Printer devices */}
            <BluetoothSection config={config} onPortChanged={() => router.invalidate()} />

            {/* Add element buttons */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Tambah Elemen
              </h2>
              <div className="flex flex-wrap gap-2">
                {ELEMENT_TYPES.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => addElement(type)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-teal-500/50 hover:bg-zinc-700 hover:text-white active:scale-95"
                  >
                    <Plus size={14} className="text-teal-400" />
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Elements list */}
            {elements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center">
                <p className="text-sm text-zinc-600">
                  Belum ada elemen. Klik tombol di atas untuk memulai.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {elements.map((el, idx) => (
                  <ElementCard
                    key={el.id}
                    element={el}
                    onChange={(updated) => updateElement(el.id, updated)}
                    onRemove={() => removeElement(el.id)}
                    onMoveUp={idx > 0 ? () => moveElement(el.id, 'up') : null}
                    onMoveDown={
                      idx < elements.length - 1
                        ? () => moveElement(el.id, 'down')
                        : null
                    }
                    paperWidth={paperWidth}
                  />
                ))}
              </div>
            )}

            {/* Action buttons */}
            {elements.length > 0 && (
              <div className="flex flex-wrap gap-3 rise-in">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting || elements.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-teal-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={18} />
                  {isPrinting ? 'Mencetak...' : 'Print'}
                </button>
                <button
                  onClick={clearAll}
                  disabled={isPrinting}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw size={16} />
                  Clear All
                </button>
              </div>
            )}

            {/* Print result notification */}
            {printResult && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium rise-in ${
                  printResult.success
                    ? 'border-green-800 bg-green-900/30 text-green-400'
                    : 'border-red-800 bg-red-900/30 text-red-400'
                }`}
              >
                {printResult.success
                  ? '✓ Print berhasil dikirim ke printer!'
                  : `✗ ${printResult.error}`}
              </div>
            )}
          </div>

          {/* Right — Preview */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
                Preview Cetakan
              </h2>
              <ReceiptPreview elements={elements} paperWidth={paperWidth} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
