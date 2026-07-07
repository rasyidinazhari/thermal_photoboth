# Panduan Pengujian Printer Thermal di Windows

Berbeda dengan macOS yang memiliki keterbatasan pada protokol *Bluetooth Serial Port Profile (SPP)*, Windows memiliki dukungan yang sangat baik untuk pencetakan thermal via Bluetooth. Windows akan secara otomatis memetakan perangkat Bluetooth ke **COM Port** (Port Serial), yang bisa langsung digunakan oleh aplikasi Photobooth ini.

Berikut adalah panduan langkah demi langkah untuk menguji printer thermal (seperti Blueprint BP-ECO58) di sistem operasi Windows.

---

## 1. Pengujian via Bluetooth (Paling Direkomendasikan)

### A. Pairing Printer dengan Windows
1. Nyalakan printer thermal Anda (pastikan baterai terisi/terhubung ke listrik).
2. Di Windows, buka **Settings** > **Bluetooth & devices**.
3. Pastikan Bluetooth menyala, lalu klik **Add device**.
4. Pilih **Bluetooth**, lalu tunggu hingga nama printer Anda muncul (misalnya `BP-ECO58` atau `Printer_001`).
5. Klik pada printer tersebut. Jika dimintai PIN, masukkan PIN default (biasanya `0000` atau `1234`).
6. Tunggu hingga Windows memproses pemasangan. Statusnya akan berubah menjadi *Paired* (Dipasangkan).

### B. Menemukan Nomor COM Port
Windows secara otomatis membuat 2 port COM virtual untuk printer Bluetooth (satu untuk masuk, satu untuk keluar). Kita perlu mencari tahu nomor port yang tepat.

1. Buka **Control Panel** Windows.
2. Cari dan buka **Devices and Printers** (Atau bisa juga via **Device Manager** > **Ports (COM & LPT)**).
3. Cari ikon printer Bluetooth yang baru saja Anda pasangkan.
4. Klik kanan pada ikon tersebut, lalu pilih **Properties**.
5. Masuk ke tab **Hardware** atau **Services**.
6. Anda akan melihat informasi *Serial Port (SPP)* beserta nomor port-nya, misalnya **`COM3`** atau **`COM4`**. Catat nomor port ini.

### C. Mencetak dari Halaman Test (`/test`)
1. Buka aplikasi Photobooth di browser: `http://localhost:3000/test` (atau IP/port aplikasi Anda berjalan).
2. Lihat bagian **Perangkat Printer** di sebelah kiri.
3. Karena aplikasi berjalan di Windows, ia akan mencoba menampilkan daftar COM Port secara otomatis.
4. Cari nama port yang Anda catat tadi (misal: `COM3`) lalu klik **Gunakan**.
5. Jika port tidak muncul, Anda bisa mengetiknya secara manual di kolom **Input Port Manual**:
   - Ketik: `COM3` (sesuaikan dengan port Anda).
   - Tekan **Enter** untuk menyimpan.
6. Tambahkan beberapa elemen cetakan (Teks, Gambar, QR), lalu klik **Print**.
7. Printer akan segera mencetak!

---

## 2. Pengujian via Kabel USB

Jika Anda tidak ingin menggunakan Bluetooth, Anda juga bisa menggunakan kabel USB. Ada dua pendekatan untuk USB di Windows:

### Opsi A: Instalasi Driver Resmi (Sistem CUPS/Spooler)
1. Colokkan printer ke komputer menggunakan kabel USB.
2. Instal driver resmi printer (misalnya driver Blueprint) dari CD atau website resminya.
3. Pastikan printer bisa melakukan *Test Print* dari Control Panel Windows.
4. Catat **nama printer** persis seperti yang tertulis di Control Panel (misal: `BP_ECO58_Printer`).
5. Buka halaman `/test` di aplikasi kita.
6. Pada bagian **Input Port Manual**, ketikkan format berikut:
   `printer:BP_ECO58_Printer`
7. Tekan **Enter**, lalu coba cetak. Aplikasi akan mengirim perintah RAW ke antrian *spooler* Windows.

### Opsi B: USB via COM Port Virtual (Tanpa Driver Print)
Beberapa printer thermal memiliki mode USB yang mengemulasikan Port Serial.
1. Colokkan kabel USB.
2. Buka **Device Manager** > **Ports (COM & LPT)**.
3. Lihat apakah muncul port seperti *USB-SERIAL CH340 (COM5)* atau sejenisnya.
4. Jika muncul port COM baru, Anda bisa langsung mengetikkan port tersebut di aplikasi (misal: `COM5`) tanpa perlu menginstal driver printer khusus.

---

## 3. Pengujian via Jaringan Lokal (TCP/LAN)

Jika printer mendukung colokan kabel LAN RJ45 atau WiFi:
1. Pastikan printer terhubung ke router yang sama dengan komputer Windows.
2. Lakukan *Self Test* printer (tahan tombol FEED sambil menghidupkan printer) untuk melihat **IP Address** printer di kertas hasil cetaknya. (Misal: `192.168.1.50`).
3. Di halaman `/test` aplikasi, ketikkan di kolom **Input Port Manual**:
   `tcp://192.168.1.50:9100`
4. Tekan **Enter**, lalu klik **Print**. Pencetakan TCP sangat cepat dan stabil.

---

## Troubleshooting Cepat

*   **Log melaporkan sukses, tapi printer diam (di Bluetooth COM):** 
    Terkadang Windows membuat 2 port COM. Jika `COM3` tidak merespons, coba `COM4`. Hanya satu dari dua port tersebut yang bisa menerima data dengan benar.
*   **Error "Access Denied" pada port COM:**
    Pastikan tidak ada aplikasi lain (seperti aplikasi kasir atau software utility printer) yang sedang membuka/mengunci port COM tersebut. Tutup aplikasi lain lalu coba lagi.
