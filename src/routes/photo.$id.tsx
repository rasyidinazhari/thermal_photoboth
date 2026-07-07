import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/photo/$id')({
  component: PhotoGalleryPage,
})

function PhotoGalleryPage() {
  const { id } = Route.useParams()
  const imageUrl = `/uploads/${id}.png`

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `photobooth-${id}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-zinc-900 p-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Foto Anda!</h1>
          <p className="mt-2 text-zinc-400">Terima kasih telah menggunakan Smart Photobooth.</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border-4 border-zinc-800 bg-black">
          {/* We mirror the image back here if we want, or keep it mirrored as it was taken. 
              Since it's saved as it appeared on screen (because we mirrored the canvas drawing), 
              we don't need to CSS-mirror it here. */}
          <img 
            src={imageUrl} 
            alt="Your Photobooth Capture" 
            className="w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Foto+Tidak+Ditemukan'
            }}
          />
        </div>

        <button
          onClick={handleDownload}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-lg font-bold text-black transition hover:bg-zinc-200 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Unduh Foto
        </button>
      </div>
    </div>
  )
}
