# NYALUR

> **Transfer file P2P — tanpa iklan, tanpa kuota, langsung antar perangkat.**

Nyalur adalah aplikasi web (PWA) untuk transfer file peer-to-peer menggunakan WebRTC. File dikirim langsung antar perangkat melalui jaringan lokal — tanpa melalui server, tanpa kuota internet.

## ✨ Fitur

- 🟢 **Kirim** — Pilih file, hubungkan ke penerima, transfer langsung
- 🟠 **Terima** — Tampilkan QR code, tunggu koneksi, terima file
- 📊 **Progress real-time** — Progress bar dengan kecepatan transfer & estimasi waktu
- 📋 **Riwayat** — Lihat riwayat transfer tersimpan lokal
- 📱 **PWA** — Install ke home screen, terasa seperti app native
- 🔒 **Privat** — File tidak pernah melalui server (100% P2P via WebRTC)
- 🌙 **Dark mode** — Tampilan gelap dengan aksen neon hijau & orange

## 🚀 Cara Pakai

1. **Penerima**: Buka Nyalur → tap **TERIMA** → bagikan kode / QR ke pengirim
2. **Pengirim**: Buka Nyalur → tap **KIRIM** → pilih file → masukkan kode → kirim
3. File langsung ditransfer via jaringan lokal (tanpa kuota!)

## 🛠 Tech Stack

| Layer | Teknologi |
|-------|----------|
| UI Framework | Svelte 4 + Vite 5 |
| Styling | Tailwind CSS 3 |
| WebRTC | PeerJS |
| Storage | IndexedDB (idb) |
| QR Code | qrcode |

## 💻 Development

```bash
# Clone repo
git clone https://github.com/msukri89/Nyalur.git
cd Nyalur

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📂 Struktur Project

```
src/
├── App.svelte              # Router utama
├── main.js                 # Entry point
├── app.css                 # Tailwind + animasi
├── views/
│   ├── Home.svelte         # Home (tombol Kirim/Terima)
│   ├── Send.svelte         # Halaman kirim file
│   └── Receive.svelte      # Halaman terima file
└── lib/
    ├── peer-manager.js     # PeerJS connection manager
    ├── transfer-engine.js  # File chunking & transfer
    ├── history-db.js       # IndexedDB riwayat
    └── utils.js            # Format helpers
```

## 📜 License

MIT
