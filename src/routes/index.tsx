import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { CameraScreen } from '../components/CameraScreen'
import { uploadPhoto } from '../server/upload'
import { QRCodeSVG } from 'qrcode.react'
import { Settings, Printer, Scan } from 'lucide-react'
import { getConfig } from '../server/config'
import type { AppConfig } from '../server/config'
import { triggerPrintPhoto } from '../server/printer'

export const Route = createFileRoute('/')({ 
  loader: async () => await getConfig(),
  component: App 
})

function ScannerOverlay() {
  const [textIndex, setTextIndex] = useState(0)
  const phrases = [
    "ANALYZING BIOMETRICS...",
    "APPLYING WATERMARK...",
    "ENCRYPTING DATA...",
    "COMPRESSING IMAGE...",
    "FINALIZING..."
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex(prev => (prev + 1) % phrases.length)
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/20 overflow-hidden font-mono text-green-400 select-none pointer-events-none">
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `linear-gradient(rgba(74,222,128,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.2) 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}
      />
      <div className="absolute left-0 right-0 h-[3px] bg-green-400 shadow-[0_0_20px_5px_rgba(74,222,128,0.8)] animate-laser-down" />
      <div className="relative z-10 flex flex-col items-center gap-2 p-6 rounded-xl bg-black/70 backdrop-blur-md border border-green-400/30 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 text-2xl md:text-3xl font-bold animate-pulse tracking-widest uppercase">
          <Scan size={32} /> 
          <span>Processing</span>
        </div>
        <div className="text-sm md:text-lg opacity-90 font-semibold tracking-wider">
          {phrases[textIndex]}
        </div>
      </div>
    </div>
  )
}

function App() {
  const config = Route.useLoaderData() as AppConfig
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rawPreviewUrl, setRawPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isPrintingManual, setIsPrintingManual] = useState(false)
  const [uploadedId, setUploadedId] = useState<string | null>(null)

  const handleCapture = (rawBlob: Blob, finalBlob: Blob) => {
    setRawPreviewUrl(URL.createObjectURL(rawBlob))
    setPreviewBlob(finalBlob)
    setPreviewUrl(URL.createObjectURL(finalBlob))
    setIsScanning(true)
    setUploadedId(null)
  }

  useEffect(() => {
    if (isScanning) {
      const timer = setTimeout(() => {
        setIsScanning(false)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [isScanning])

  const handleRetake = () => {
    setPreviewBlob(null)
    setPreviewUrl(null)
    setRawPreviewUrl(null)
    setUploadedId(null)
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const handleUpload = async () => {
    if (!previewBlob) return
    setIsUploading(true)
    try {
      const base64 = await blobToBase64(previewBlob)
      const result = await uploadPhoto({ data: { imageBase64: base64 } })
      
      if (result.success && result.id) {
        setUploadedId(result.id)
      } else {
        alert("Gagal menyimpan foto. Silakan coba lagi.")
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan saat mengunggah foto.")
    } finally {
      setIsUploading(false)
    }
  }

  const handlePrintManual = async () => {
    if (!uploadedId) return
    setIsPrintingManual(true)
    try {
      const result = await triggerPrintPhoto({ data: { id: uploadedId } })
      if (!result.success) {
        alert(`Gagal mencetak: ${result.error}`)
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan sistem saat mencoba mencetak.")
    } finally {
      setIsPrintingManual(false)
    }
  }

  useEffect(() => {
    if (uploadedId) {
      // Use config setting, convert to ms, fallback to 15000 if not set
      const displayTimeMs = (config.photo?.qrDisplaySeconds || 15) * 1000;
      const timer = setTimeout(() => {
        handleRetake()
      }, displayTimeMs)
      return () => clearTimeout(timer)
    }
  }, [uploadedId, config.photo.qrDisplaySeconds])

  if (previewUrl) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-900 p-4 sm:p-6 gap-4 sm:gap-6 overflow-hidden">
        
        {/* Preview Container */}
        <div className="relative overflow-hidden rounded-2xl shadow-2xl w-full max-w-5xl flex-1 flex items-center justify-center bg-black min-h-0">
          {/* We do NOT mirror the preview image here because the capture logic already 
              drew it mirrored on the canvas + overlaid the frame normally. */}
          {isScanning ? (
            <img src={rawPreviewUrl || previewUrl || undefined} alt="Scanning..." className="w-full h-full object-contain matrix-filter animate-reveal-down" />
          ) : (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rise-in" />
          )}
          
          {isScanning && <ScannerOverlay />}

          {!isScanning && uploadedId && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8 text-white overflow-y-auto">
              <div className="rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
                <div className="w-[45vw] h-[45vw] max-w-[256px] max-h-[256px] min-w-[150px] min-h-[150px]">
                  <QRCodeSVG 
                    value={`${config.photo?.qrBaseUrl || window.location.origin}/photo/${uploadedId}`}
                    width="100%"
                    height="100%"
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <h2 className="mt-4 sm:mt-6 text-xl sm:text-3xl font-bold text-center">Scan untuk Mengunduh!</h2>
              <p className="mt-2 text-sm sm:text-base text-center text-zinc-300">
                Otomatis kembali dalam {config.photo.qrDisplaySeconds} detik...
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons Container */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-5xl shrink-0 pb-2 min-h-[48px]">
          {!isScanning && (
            <div className="flex flex-col sm:flex-row justify-center gap-4 w-full rise-in" style={{ animationDelay: '150ms' }}>
              {!uploadedId ? (
                <>
                  <button
                    onClick={handleRetake}
                    disabled={isUploading}
                    className="rounded-full border-2 border-white bg-transparent px-8 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/10 active:scale-95 disabled:opacity-50 w-full sm:w-auto"
                  >
                    Ulangi
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="rounded-full bg-white px-8 py-3 font-semibold text-black shadow-lg transition hover:bg-gray-200 active:scale-95 disabled:opacity-50 w-full sm:w-auto"
                  >
                    {isUploading ? 'Menyimpan...' : 'Simpan & Dapatkan QR'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleRetake}
                    className="rounded-full bg-white/20 px-8 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/30 active:scale-95 w-full sm:w-auto"
                  >
                    Selesai (Kembali)
                  </button>
                  {config.printer.enabled && (
                    <button
                      onClick={handlePrintManual}
                      disabled={isPrintingManual}
                      className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 w-full sm:w-auto"
                    >
                      <Printer size={20} />
                      {isPrintingManual ? 'Mencetak...' : 'Print Foto'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="h-screen w-full relative bg-black">
      <CameraScreen onCapture={handleCapture} config={config} />
      
      {/* Settings Gear Icon */}
      <div className="absolute top-6 right-6 z-50">
        <Link 
          to="/settings" 
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition-all hover:bg-black/40 hover:rotate-90 active:scale-90"
        >
          <Settings size={24} />
        </Link>
      </div>
    </main>
  )
}
