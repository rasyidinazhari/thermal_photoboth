# Smart Photobooth 📸🤖

Smart Photobooth adalah aplikasi photo booth interaktif berbasis web yang dikembangkan menggunakan **TanStack Start**, **React**, dan **MediaPipe**. Aplikasi ini mendeteksi gestur tangan (5 jari terbuka) untuk secara otomatis mengambil foto, memproses gambar dengan efek animasi *cyber/matrix*, dan mencetak hasilnya secara langsung menggunakan *Thermal Printer*.

## 🌟 Fitur Utama

- **Deteksi Gestur Cerdas**: Menggunakan AI (Google MediaPipe) untuk mendeteksi telapak tangan dengan 5 jari terbuka sebagai *trigger* untuk memulai hitung mundur foto.
- **Cyber Scanning Gimmick**: Menampilkan animasi pemindaian bergaya peretas (*matrix glow*, laser dari atas ke bawah, efek *glitch*) selama proses *rendering* foto untuk pengalaman interaktif yang futuristik.
- **Dynamic Watermark & Frame**: Bingkai (frame) dan teks *watermark* otomatis disematkan pada hasil akhir gambar. *Watermark* otomatis menyesuaikan ukuran font agar tetap proporsional.
- **Background Neural Network**: Latar belakang aplikasi menggunakan partikel canvas interaktif yang menyerupai *neural network* otak manusia.
- **Integrasi Printer Thermal**: Terkoneksi secara langsung ke printer kasir/thermal lokal (USB/Network/Bluetooth) melalui pustaka `node-thermal-printer`.
- **Panel Konfigurasi Live**: Dilengkapi halaman `/settings` untuk mengatur teks *watermark*, bingkai overlay, timer QR, waktu pindai, dan koneksi printer tanpa perlu mengubah kode sumber.
- **QR Code Sharing**: Memungkinkan pengguna memindai QR code di layar untuk mengunduh foto langsung ke perangkat genggam.

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start/latest) (Full-stack React framework)
- **Styling**: Tailwind CSS v4 & Custom CSS Animations
- **Computer Vision**: `@mediapipe/tasks-vision`
- **Hardware Integration**: `node-thermal-printer`
- **Icons & UI**: `lucide-react`, `qrcode.react`

## 📋 Prasyarat

- **Node.js** v18+ (Disarankan versi LTS terbaru)
- Kamera Web (Webcam) terhubung ke perangkat.
- Printer Thermal POS (Epson / Star / Generic ESC/POS) - *Opsional, hanya jika fitur cetak digunakan*.

## 🚀 Instalasi

1. Clone repositori ini ke perangkat lokal Anda:
   ```bash
   git clone <repo-url>
   cd thermal-photoboth
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Jalankan aplikasi di mode pengembangan:
   ```bash
   npm run dev
   ```

4. Buka peramban (browser) dan akses:
   - Halaman Utama (Kamera): `http://localhost:3000`
   - Halaman Pengaturan: `http://localhost:3000/settings`

## 🖨️ Pengaturan Printer Thermal

Aplikasi menggunakan `node-thermal-printer` di sisi server. Pastikan printer Anda sudah dikonfigurasi di sistem operasi (Windows/Linux/Mac) dan dapat dikenali.

Buka **`http://localhost:3000/settings`** untuk memasukkan *interface* printer Anda. Contoh interface:
- **Mac/Linux**: `/dev/usb/lp0`
- **Windows**: `//localhost/ReceiptPrinter`
- **Jaringan**: `tcp://192.168.1.100:9100`

Jika Anda tidak memiliki printer, Anda bisa menonaktifkan fitur printer dari panel `/settings`.

## 📂 Struktur Data

Hasil jepretan foto pengguna akan disimpan sementara di direktori `data/photos` agar bisa diakses oleh QR Code. File `data/config.json` akan otomatis terbuat saat Anda menyimpan pengaturan di halaman `/settings`.

## 📄 Lisensi

Hak Cipta (c)rasyidinazhari. Semua Hak Dilindungi.
