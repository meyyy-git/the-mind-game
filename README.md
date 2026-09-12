# The Minds Online

Permainan kartu kooperatif 2–4 pemain di browser. Room privat, sesi tanpa akun, penonton, dua bahasa, dan progres tersimpan di SQLite. Kebutuhan lengkap ada di [PRD](docs/PRD.md).

## Menjalankan lokal

Memerlukan Bun 1.4.2 atau versi kompatibel. Dependency dikunci di `bun.lock`.

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

Buka **http://localhost:3000**. Untuk mencoba beberapa pemain, gunakan browser/profil privat berbeda. Dua tab dari browser yang sama adalah satu sesi; tab terbaru mengambil alih.

Untuk pengembangan dengan reload:

```sh
bun run dev
```

Frontend di http://localhost:5173; koneksi game diteruskan ke server port 3000. Jangan jalankan `start` dan `dev` bersamaan pada port yang sama.

## Pemeriksaan

```sh
bun test
bun run build
```

Tes meliputi aturan, permainan penuh 2/3/4 pemain, shuriken, privasi payload, aksi duplikat, host, expiry, koneksi Socket.IO nyata, dan pemulihan SQLite. Build memeriksa TypeScript dan menghasilkan frontend production.

## Deployment Dokploy

1. Masukkan proyek ke repository yang dihubungkan ke aplikasi Dokploy.
2. Pilih build **Dockerfile**, path `Dockerfile`, context root repository.
3. Tetapkan **satu replica**. Gunakan update order **stop-first** agar proses lama dan baru tidak mengelola room yang sama bersamaan. Deploy menyebabkan jeda singkat, kemudian pemain reconnect.
4. Tambahkan **Volume Mount** bernama `the-minds-data` ke `/app/data`. Jangan mount root `/app`. Direktori data harus dapat ditulis oleh user `bun` (UID 1000).
5. Tambahkan domain dengan port container **3000**, aktifkan HTTPS, dan set `APP_ORIGIN` ke origin persis, misalnya `https://game.example.com` tanpa slash akhir. Gunakan URL HTTPS publik, bukan alamat HTTP IP VPS.
6. Deploy dan periksa `/health`, yang mengembalikan `{"ok":true}` jika server sehat.
7. Uji dua browser: buat room, gabung, mulai, refresh, lalu redeploy untuk memastikan tangan/progres pulih dari volume.

Reverse proxy harus meneruskan `/socket.io/` termasuk upgrade WebSocket. Tidak perlu database terpisah atau port database publik. Rujukan: [Dokploy Applications](https://docs.dokploy.com/docs/core/applications) dan [Volumes/Mounts](https://docs.dokploy.com/docs/core/applications/advanced).

Untuk mesin yang memiliki Docker, pemeriksaan container dapat dijalankan dengan:

```sh
docker build -t the-minds .
docker run --rm -p 3000:3000 -v the-minds-data:/app/data the-minds
```

Dockerfile memakai image Bun resmi dan menjalankan tes/build sebelum menghasilkan image runtime. Rujukan: [Bun Docker guide](https://bun.sh/guides/ecosystem/docker).

## Konfigurasi

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port HTTP dan Socket.IO |
| `DB_PATH` | `data/game.sqlite` | File SQLite; Docker memakai `/app/data/game.sqlite` |
| `APP_ORIGIN` | Pencocokan host untuk lokal | Wajib diisi origin HTTPS aplikasi saat production |
| `MAX_ROOMS` | `100` | Batas awal room tersimpan, bukan klaim kapasitas VPS |
| `MAX_SPECTATORS` | `12` | Batas penonton tiap room |

Server memakai satu proses dan satu snapshot SQLite per room. Setiap perubahan disimpan sebelum konfirmasi, dengan WAL dan synchronous FULL. Snapshot baru tidak menggantikan state memori jika penyimpanan gagal. Kegagalan penyimpanan menghentikan penerimaan aksi; perbaiki storage lalu restart. `/health` mengembalikan status 503 pada kondisi tersebut.

Backup bukan pengganti volume: gunakan snapshot SQLite konsisten atau hentikan aplikasi sebelum menyalin direktori data. Jangan menyalin file utama SQLite saja saat WAL aktif. Penjadwalan backup VPS belum diatur.

## Keputusan pelaksanaan

- Username 1–24 karakter: huruf Unicode, angka, spasi, titik, tanda hubung, atau underscore; dinormalisasi dan unik tanpa membedakan kapital.
- Reconnect pemain saat pertandingan masih aktif memulai kesiapan bersama. Host dapat melanjutkan dengan pemain offline, tetapi tidak dapat melewati voting shuriken.
- Keluar permanen pemain membatalkan pertandingan seperti pengeluaran pemain oleh host. Menjadi penonton hanya tersedia di lobi.
- Jika seluruh pemain offline, host diberikan kepada pemain pertama yang kembali. Penonton tidak memperoleh kendali otomatis.
- Crash tanpa disconnect memakai liveness terakhir (disimpan setiap 15 detik) sebagai acuan expiry. Room berakhir 24 jam setelah pemain terakhir keluar; penonton tidak memperpanjangnya.
- Kartu yang dibuang saat kesalahan/shuriken tetap terlihat sampai semua siap, termasuk bila pengosongan itu menyelesaikan level.
- Host langsung “Bagikan kartu” dari lobi. Pemain menekan “Siap” setelah melihat kartu dan dapat memilih “Batal siap” selama permainan belum aktif.
- Lolos level, menang, kalah, dan kesalahan urutan kartu membuka popup pribadi. “Lanjut” menutup popup tanpa menandai siap; hadiah dan inventori diambil dari snapshot hasil server. Kesalahan menampilkan kartu terlewat serta sisa nyawa; jika nyawa habis, hanya popup kalah yang muncul. Kesalahan tidak menaikkan level; jika semua tangan kosong, level yang sama dibagikan ulang.
- Popup menang/kalah menampilkan ringkasan: level terakhir, jumlah kesalahan, shuriken terpakai, dan inventori tersisa.
- Meja menampilkan rail progres level: level selesai berwarna gold, level aktif berwarna mint, dan level berikutnya redup.
- Batas awal 100 room dan 12 penonton dapat disesuaikan setelah mengukur VPS. Pembatasan pembuatan/koneksi berbasis alamat transport; di balik proxy dapat terhitung bersama, tidak mempercayai header IP kiriman klien.
- **Blind Mode sudah ditentukan sebagai tantangan opsional setelah menang, default off.** Host akan memulainya dari popup kemenangan. Engine kartu tertutup dan evaluasi akhir level belum diimplementasikan; mode normal tetap menjadi jalur utama.

## Status verifikasi lingkungan ini

Build TypeScript/Vite dan tes Bun dapat dijalankan di lingkungan pengembangan ini. Docker tidak tersedia dan browser terhubung tidak tersedia, sehingga build container, QA visual, dan koneksi melalui Dokploy harus diverifikasi pada lingkungan yang menyediakannya. Deployment VPS belum dilakukan.

## Struktur

| Lokasi | Isi |
|---|---|
| `server/game.ts` | Aturan dan transisi room |
| `server/store.ts` | Snapshot SQLite dan pemulihan |
| `server/app.ts` | HTTP, Socket.IO, validasi sesi, batas trafik |
| `shared/types.ts` | Kontrak aksi dan tampilan publik |
| `src/main.tsx` | UI React dan navigasi TanStack Router |
| `src/styles.css` | Desain responsif dan animasi |
| `tests/` | Tes aturan, persistensi, dan integrasi |

Desain kartu/ilustrasi dibuat untuk proyek ini. Nama proyek merupakan nama kerja, tanpa klaim afiliasi resmi dengan penerbit The Mind.

## Antarmuka game

Revamp 11 September 2026 menggunakan menu awal terpusat, meja berwarna ungu malam, token pemain, kartu di tengah, dan tangan pribadi di bawah meja. Panel pemain/pengaturan dapat dibuka saat diperlukan. Teks Indonesia/Inggris menjelaskan aksi dan keadaan permainan; detail visual tercatat di `DESIGN.md`.

Font judul dan angka kartu memakai **Grenze**, disimpan lokal di `public/fonts/grenze.ttf`. Sumber: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/grenze), lisensi SIL Open Font License di `public/fonts/OFL.txt`. Tidak ada permintaan font ke pihak ketiga saat bermain.

Pemeriksaan kode untuk pengumuman pembaca layar, nama panjang, dan pesan tangan kosong selesai. Hasil render, interaksi touch, dan pembaca layar sebenarnya masih perlu diperiksa melalui browser; pemeriksaan kode tidak menggantikan pengujian tersebut.
