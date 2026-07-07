import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getConfig, saveConfig } from '../server/config'
import type { AppConfig } from '../server/config'
import { useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'

export const Route = createFileRoute('/settings')({
  loader: async () => {
    return await getConfig()
  },
  component: SettingsPage,
})

function SettingsPage() {
  const initialConfig = Route.useLoaderData()
  const [config, setConfig] = useState<AppConfig>(initialConfig)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await saveConfig({ data: config })
      if (res.success) {
        alert("Konfigurasi berhasil disimpan!")
        router.invalidate() // Reload the loader data
      } else {
        alert("Gagal menyimpan konfigurasi.")
      }
    } catch (e) {
      alert("Error saat menyimpan.")
    } finally {
      setIsSaving(false)
    }
  }

  // Helper for reading image as base64 for frame upload
  const handleFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        // Create an image object to shrink it
        const img = new Image();
        img.onload = () => {
          // Max width 800px to keep base64 string small
          const targetWidth = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > targetWidth) {
            height = Math.round((height * targetWidth) / width);
            width = targetWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Save as compressed base64
            const compressedBase64 = canvas.toDataURL('image/png');
            setConfig(c => ({
              ...c,
              frame: { ...c.frame, imageUrl: compressedBase64 }
            }))
          }
        };
        img.src = reader.result as string;
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white sm:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="rounded-full bg-zinc-800 p-3 transition hover:bg-zinc-700">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold">Konfigurasi Photobooth</h1>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-lagoon px-6 py-3 font-bold text-sea-ink transition hover:bg-lagoon-deep disabled:opacity-50"
            style={{ backgroundColor: 'var(--lagoon)', color: 'var(--sea-ink)' }}
          >
            <Save size={20} />
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>

        {/* Frame Settings */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">1. Frame / Bingkai Digital</h2>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={config.frame.enabled}
                onChange={e => setConfig(c => ({...c, frame: {...c.frame, enabled: e.target.checked}}))}
                className="h-5 w-5 rounded accent-lagoon"
              />
              <span className="text-lg">Aktifkan Frame (Watermark)</span>
            </label>

            {config.frame.enabled && (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-700 p-6">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Upload Frame (PNG Transparan)</label>
                <input 
                  type="file" 
                  accept="image/png"
                  onChange={handleFrameUpload}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
                />
                {config.frame.imageUrl && (
                  <div className="mt-4">
                    <p className="text-xs text-zinc-500 mb-2">Preview Frame:</p>
                    <img src={config.frame.imageUrl} alt="Frame Preview" className="h-32 object-contain bg-zinc-800 rounded-lg p-2" />
                    <button 
                      onClick={() => setConfig(c => ({...c, frame: {...c.frame, imageUrl: ""}}))}
                      className="mt-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Hapus Frame
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Watermark Settings */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">2. Teks Watermark</h2>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={config.watermark?.enabled ?? true}
                onChange={e => setConfig(c => ({...c, watermark: {...(c.watermark || {}), enabled: e.target.checked, text: c.watermark?.text || ""}}))}
                className="h-5 w-5 rounded accent-lagoon"
              />
              <span className="text-lg">Tampilkan Teks Watermark di Foto</span>
            </label>

            {(config.watermark?.enabled ?? true) && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Teks Watermark</label>
                <input 
                  type="text" 
                  value={config.watermark?.text ?? ""}
                  onChange={e => setConfig(c => ({...c, watermark: {...(c.watermark || {}), enabled: c.watermark?.enabled ?? true, text: e.target.value}}))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
                  placeholder="Contoh: thermal photoboth by ASIRO"
                />
                <p className="mt-2 text-xs text-zinc-500">Teks ini akan otomatis diubah ukurannya secara proporsional sesuai layar.</p>
              </div>
            )}
          </div>
        </section>

        {/* Photo Settings */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">3. Pengaturan Foto</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Hitung Mundur (Detik)</label>
              <input 
                type="number" 
                min="1" max="10"
                value={config.photo.countdownSeconds}
                onChange={e => setConfig(c => ({...c, photo: {...c.photo, countdownSeconds: parseInt(e.target.value)}}))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Tampil QR Code (Detik)</label>
              <input 
                type="number" 
                min="5" max="60"
                value={config.photo.qrDisplaySeconds}
                onChange={e => setConfig(c => ({...c, photo: {...c.photo, qrDisplaySeconds: parseInt(e.target.value)}}))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-2">Base URL QR Code (Opsional)</label>
              <input 
                type="text" 
                value={config.photo.qrBaseUrl ?? ""}
                onChange={e => setConfig(c => ({...c, photo: {...c.photo, qrBaseUrl: e.target.value}}))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
                placeholder="Contoh: http://192.168.1.10:3000"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Jika dikosongkan, QR akan otomatis menggunakan URL perangkat ini. Isi jika Anda menjalankan UI di localhost namun ingin QR dapat dipindai oleh HP pengunjung melalui IP jaringan lokal.
              </p>
            </div>
          </div>
        </section>

        {/* Printer Settings */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold">4. Konfigurasi Printer Thermal</h2>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={config.printer.enabled}
                onChange={e => setConfig(c => ({...c, printer: {...c.printer, enabled: e.target.checked}}))}
                className="h-5 w-5 rounded accent-lagoon"
              />
              <span className="text-lg">Aktifkan Tombol Cetak Foto Manual</span>
            </label>

            {config.printer.enabled && (
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Interface / Alamat (misal: tcp://192.168.1.100, /dev/usb/lp0, atau \\.\COM3 untuk Bluetooth)
                  </label>
                  <input 
                    type="text" 
                    value={config.printer.interface}
                    onChange={e => setConfig(c => ({...c, printer: {...c.printer, interface: e.target.value}}))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
                    placeholder="tcp://192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Ukuran Kertas</label>
                  <select 
                    value={config.printer.paperWidth}
                    onChange={e => setConfig(c => ({...c, printer: {...c.printer, paperWidth: parseInt(e.target.value)}}))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lagoon focus:outline-none"
                  >
                    <option value={80}>80mm</option>
                    <option value={58}>58mm</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>
        
      </div>
    </div>
  )
}
