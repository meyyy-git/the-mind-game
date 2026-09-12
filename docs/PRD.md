# PRD — The Minds Online

Tanggal: 10 September 2026  
Versi: 1.0  
Status: Dokumen kebutuhan berdasarkan wawancara; belum merupakan implementasi.  
Bahasa dokumen: Indonesia. Bahasa produk: Indonesia dan Inggris.  
Nama kerja proyek: The Minds Online. Acuan permainan: The Mind original, Wolfgang Warsch / NSV.

Dokumen ini menjadi satu acuan kebutuhan produk, aturan, pengalaman pengguna, arsitektur, dan penerimaan. Label **Disepakati** berarti keputusan eksplisit dalam wawancara; **Usulan** berarti rincian pelaksanaan yang direkomendasikan; **Terbuka** berarti belum diputuskan. Tidak ada target jumlah pengguna, spesifikasi VPS, atau tenggat peluncuran yang telah disepakati.

## 1. Executive Summary

### Problem Statement

Pengguna ingin memainkan The Mind original bersama teman dari lokasi berbeda melalui browser. Adaptasi harus menjaga kerahasiaan kartu, keputusan berdasarkan timing, serta satu hasil permainan yang konsisten meskipun koneksi pemain berbeda atau terputus.

### Proposed Solution

Web app multiplayer dengan room privat melalui kode atau tautan, 2–4 pemain, dan akses tanpa akun menggunakan username. Server mengendalikan aturan serta urutan aksi; progres tersimpan agar sesi dapat dilanjutkan setelah reconnect atau restart server.

**Disepakati:** hosting menggunakan VPS milik pengguna dengan Dokploy. Tidak menambah layanan hosting berbayar untuk versi awal; biaya VPS yang sudah ada tetap merupakan infrastruktur pengguna.

### Success Criteria

Berikut target penerimaan versi pertama, bukan klaim hasil pengujian atau target bisnis yang sudah diukur:

| ID | Ukuran keberhasilan | Target penerimaan |
|---|---|---|
| SC-01 | Permainan ujung ke ujung | Sesi 2, 3, dan 4 pemain dapat dibuat, dimainkan, diselesaikan, dan diulang di room yang sama |
| SC-02 | Ketepatan aturan | Semua skenario aturan pada dokumen ini lulus, termasuk hadiah, kekalahan, kesalahan, dan voting |
| SC-03 | Kerahasiaan dan konsistensi | Tidak ada isi tangan lawan dalam payload klien; setiap aksi valid diterapkan sekali dengan urutan server yang sama |
| SC-04 | Pemulihan | Refresh, reconnect, dan restart server memulihkan progres terakhir yang sudah dikonfirmasi server tanpa membagikan ulang kartu |
| SC-05 | Cakupan antarmuka | Seluruh alur inti tersedia dalam Indonesia/Inggris, dapat digunakan pada HP portrait dan desktop |

## 2. User Experience & Functionality

### 2.1 User Personas

| Persona | Kebutuhan |
|---|---|
| Host | Membuat room, mengundang teman, memilih kebijakan disconnect, memulai dan mengelola sesi |
| Pemain | Bergabung tanpa akun, melihat kartu sendiri, bermain dengan timing, kembali ke sesi setelah terputus |
| Penonton | Menonton meja tanpa akses kartu tangan, lalu mengikuti permainan berikutnya jika kursi tersedia |

Host adalah peran kendali yang melekat pada pemain, bukan akun khusus. Penonton tidak otomatis memperoleh peran host.

### 2.2 Aturan Dasar dan Acuan

**Disepakati:** gunakan aturan original dengan penyesuaian online eksplisit pada bagian selanjutnya.

| Pemain | Nyawa awal | Shuriken awal | Level terakhir |
|---|---:|---:|---:|
| 2 | 2 | 1 | 12 |
| 3 | 3 | 1 | 10 |
| 4 | 4 | 1 | 8 |

Kartu bernilai 1–100. Setiap level mengocok ulang seluruh dek; pemain menerima kartu sejumlah level. Pemain memainkan kartu terendahnya satu per satu, tanpa giliran dan tanpa mengungkapkan isi tangan. Nyawa maksimum lima; shuriken maksimum tiga. Tim menang setelah menyelesaikan level terakhir, kalah ketika nyawa habis. Acuan: [buku aturan resmi NSV](https://www.nsv.de/wp-content/uploads/2024/04/TheMind_GB.pdf) dan [salinan aturan original](https://www.brettspiele-report.de/images/t/the-mind/The-Mind-Spielanleitung.pdf).

| Setelah menyelesaikan level | Hadiah |
|---|---|
| 2, 5, 8 | Tambah satu shuriken |
| 3, 6, 9 | Tambah satu nyawa |

Hadiah tidak melampaui batas inventori dan hanya diberikan pada level yang dimainkan. Rincian pemetaan hadiah: [ringkasan The Mind Cafe](https://themindcafe.com.sg/wp-content/uploads/2019/06/The-Mind.pdf). Hadiah diberikan sekali, termasuk jika konfirmasi level terkirim ulang.

### 2.3 Alur Utama

1. Pengguna membuka aplikasi atau tautan room dan memasukkan username.
2. Pengguna membuat room atau bergabung melalui kode/tautan.
3. Host menjadi pemain pertama. Peserta berikutnya mengisi kursi kosong di lobi; jika penuh atau permainan berjalan, masuk sebagai penonton.
4. Host memilih pengaturan room lalu menekan “Bagikan kartu” ketika 2–4 pemain terhubung. Tidak ada kesiapan di lobi.
5. Server membagikan kartu. Semua pemain online menekan “Siap” sebelum level aktif.
6. Pemain memainkan kartu; server memvalidasi dan mengirim hasil yang sesuai untuk setiap peserta.
7. Kesalahan, voting, atau gangguan koneksi mengikuti aturan jeda masing-masing.
8. Popup muncul saat lolos level, menang, atau kalah. Setiap peserta menutup popup sendiri. Setelah lolos level, pemain melihat kartu baru lalu menyatakan siap; setelah menang/kalah, host dapat kembali ke lobi.

**Disepakati dalam revisi workflow:** kesiapan hanya dilakukan setelah melihat kartu. Host membagikan kartu dari lobi; level aktif otomatis saat semua pemain online siap, tanpa hitung mundur. “Batal siap” tersedia hanya selama masih menunggu.

### 2.4 User Stories dan Acceptance Criteria

#### US-01 — Identitas tanpa akun

Sebagai peserta, saya ingin masuk menggunakan username agar dapat bermain tanpa registrasi.

- **Disepakati:** username wajib sebelum membuat atau bergabung ke room.
- Username unik dalam satu room, termasuk antara pemain dan penonton; perbandingan tidak membedakan huruf besar/kecil.
- Nama yang sudah digunakan harus diganti; pesan kesalahan mengikuti bahasa pengguna.
- Identitas sesi tidak bergantung pada username. Mengetahui nama pemain tidak memberi akses ke kartunya.
- Sesi disimpan di browser untuk refresh/reconnect. Pemulihan otomatis lintas perangkat tidak dijanjikan.
- Koneksi terbaru untuk sesi yang sama mengambil alih; koneksi lama dinonaktifkan dan tidak boleh mengirim aksi yang diterima server.
- **Usulan:** trim spasi, validasi nama kosong dan batas panjang di server, serta tampilkan username sebagai teks biasa.
- **Terbuka:** batas panjang dan karakter username yang diizinkan.

#### US-02 — Membuat dan bergabung ke room

Sebagai host, saya ingin membagikan kode atau tautan privat agar teman dapat bergabung langsung.

- **Disepakati:** tersedia pembuatan room, tampilan kode, dan tautan undangan yang dapat disalin.
- Host otomatis menjadi pemain pertama.
- Kapasitas pemain 2–4; tidak ada matchmaking publik.
- Jika room belum mulai dan belum penuh, peserta baru menjadi pemain; jika tidak, menjadi penonton.
- Peserta dapat mengetahui apakah kode salah atau room sudah kedaluwarsa.
- Pengaturan aturan dasar seperti nyawa, target level, dan hadiah tidak dapat diubah.
- **Usulan:** pengaturan koneksi hanya diubah host di lobi dan dikunci selama pertandingan.
- **Terbuka:** batas penonton dan jumlah room serentak; ditentukan setelah spesifikasi VPS diketahui.

#### US-03 — Memainkan kartu

Sebagai pemain, saya ingin memainkan kartu terendah dengan satu ketukan agar timing tidak terhambat dialog.

- **Disepakati:** hanya kartu terendah di tangan yang dapat dimainkan; tanpa konfirmasi dan tanpa undo.
- Server menentukan urutan berdasarkan penerimaan aksi, bukan waktu klik yang diklaim browser.
- Server tidak menyusun ulang aksi berdasarkan nilai kartu.
- Selisih koneksi dapat memengaruhi dua aksi yang sangat berdekatan.
- Klien menampilkan tangan sendiri, jumlah kartu masing-masing pemain, dan kartu teratas tumpukan.
- Tidak ada riwayat angka kartu yang sudah dimainkan.
- **Usulan:** animasi tidak mengubah urutan keputusan server. Umpan balik lokal boleh menunjukkan aksi tertunda; hasil final menunggu server.
- Aksi yang sudah diterapkan tidak boleh diterapkan lagi saat dikirim ulang.

#### US-04 — Kesiapan dan jeda

Sebagai pemain, saya ingin mengetahui kapan permainan aktif agar semua peserta memulai dari keadaan yang jelas.

- **Disepakati:** awal level dan kelanjutan permainan memerlukan “Siap” dari semua pemain online.
- Permainan aktif segera setelah syarat siap terpenuhi, tanpa countdown.
- Setiap jeda baru mereset kesiapan; klik siap dari fase sebelumnya tidak berlaku untuk fase baru.
- Pemain dapat membatalkan kesiapan selama fase kesiapan. Setelah level aktif, server menolak pembatalan tersebut.
- Tidak tersedia tombol “Fokus ulang” yang dapat digunakan pemain sewaktu-waktu.
- Host dapat meminta unpause untuk jeda koneksi, termasuk ketika pemain masih offline, setelah peringatan risiko.
- Permintaan unpause tetap menuju fase kesiapan; bukan melewati kesiapan pemain online.
- Host tidak dapat menggunakan unpause untuk mengabaikan persetujuan shuriken, menghidupkan kembali pertandingan selesai, atau melewati validasi aturan.

#### US-05 — Kesalahan dan akhir level

Sebagai pemain, saya ingin kesalahan dijelaskan bersama agar memahami kehilangan nyawa sebelum melanjutkan.

- **Disepakati:** jika kartu yang diterima lebih tinggi dari kartu tangan yang masih tersisa, permainan berhenti untuk resolusi kesalahan.
- Satu aksi salah mengurangi satu nyawa, sekalipun beberapa kartu atau pemain terlewat.
- Semua kartu tangan yang lebih rendah ditampilkan lalu dibuang, termasuk kartu pemain offline.
- Kartu pemicu tetap menjadi kartu teratas; kartu yang dibuang tidak menggantikannya.
- Setelah resolusi, pemain online menekan “Siap”; level tidak dimulai ulang.
- Jika nyawa habis, hasilnya kalah dan tidak meminta siap untuk melanjutkan.
- Revisi terbaru: kesalahan urutan kartu juga membuka popup pribadi berisi kartu terlewat dan sisa nyawa. Jika nyawa habis, tampilkan popup kalah saja. Setelah kesalahan nonfatal, pemain menutup popup lalu menekan “Siap”; seluruh tangan saat itu dibuang dan level yang sama selalu dibagikan ulang. Kartu sisa tidak dilanjutkan dan level tidak naik karena kesalahan.
- Popup hasil mencatat level yang selesai/gagal, sisa nyawa/shuriken, dan hadiah yang benar-benar ditambahkan (tanpa hadiah palsu ketika inventori penuh).
- Popup menang/kalah juga menampilkan ringkasan pertandingan: jumlah kesalahan dan jumlah shuriken yang dipakai.
- Popup ditutup per peserta. Menutupnya tidak menutup popup peserta lain dan tidak otomatis menandai siap. Keputusan penutupan disimpan di browser; hasil terakhir disimpan di room untuk reconnect.
- **Usulan:** setelah resolusi kesalahan atau shuriken, jika semua tangan kosong dan nyawa masih ada, level selesai; hadiah diberikan sekali sebelum transisi berikutnya.
- **Usulan:** bila aksi terakhir sekaligus menghabiskan nyawa, kekalahan didahulukan dari penyelesaian level atau hadiah.

#### US-06 — Shuriken dengan persetujuan bersama

Sebagai pemain, saya ingin mengusulkan shuriken agar tim dapat mengambil keputusan bersama.

- **Disepakati:** satu pemain mengusulkan; permainan dijeda dan voting dibuka.
- Semua pemain pertandingan harus menyetujui, termasuk pemain offline yang harus kembali terlebih dahulu. Penonton tidak ikut voting.
- Jika semua setuju, satu shuriken dikurangi dan setiap pemain yang masih memiliki kartu membuang kartu terendah secara terbuka.
- Jika satu pemain menolak, usulan batal tanpa mengurangi shuriken.
- Setelah voting selesai, semua pemain online menekan “Siap” untuk melanjutkan.
- **Usulan:** pengusul dihitung setuju; hanya satu voting aktif; usulan tidak tersedia jika inventori nol atau pertandingan tidak aktif.
- Pemain yang tangannya kosong tetap anggota tim untuk persetujuan, tetapi tidak membuang kartu.
- Usulan tidak otomatis disetujui karena timeout, pergantian host, atau disconnect.

#### US-07 — Penanganan koneksi terputus

Sebagai host, saya ingin memilih kebijakan disconnect sesuai kebutuhan kelompok.

| Pengaturan | Perilaku yang disepakati |
|---|---|
| Jeda otomatis — default | Saat pemain aktif terdeteksi offline, aksi kartu dihentikan |
| Lanjut sementara | Permainan dapat tetap aktif selama batas waktu reconnect, lalu dijeda jika pemain belum kembali |
| Batas waktu | 30, 60, atau 120 detik; default 60 detik |
| Unpause oleh host | Boleh setelah peringatan; kartu offline tetap diperhitungkan dan dapat menyebabkan kehilangan nyawa |

- Disconnect tidak membuang kartu, mengganti pemain dengan bot, atau memainkan kartu otomatis.
- Pemain yang kembali mendapat kartu dan progres sesi yang sama.
- Jika semua pemain aktif offline, permainan dijeda meskipun masih ada penonton.
- Disconnect penonton tidak menjeda pertandingan.
- **Usulan:** batas waktu dihitung server sejak koneksi dinyatakan putus, bukan sejak pengguna merasa kehilangan jaringan.
- **Usulan:** jika beberapa pemain offline, deadline paling awal memicu jeda.
- **Usulan:** unpause host mengesampingkan deadline yang sudah menyebabkan jeda agar permainan tidak langsung dijeda lagi oleh kejadian yang sama. Disconnect baru tetap mengikuti kebijakan room.
- **Terbuka:** perilaku pemain yang kembali ketika permainan masih aktif dalam masa tenggang. Rekomendasi: tetap dijeda untuk kesiapan bersama sebelum dia kembali beraksi.

#### US-08 — Kendali host dan moderasi

Sebagai host, saya ingin mengelola peserta agar room tetap dapat digunakan ketika komposisi atau koneksi berubah.

- **Disepakati:** saat host offline, kendali berpindah ke pemain online yang paling awal bergabung.
- Host lama yang kembali menjadi pemain biasa.
- Penonton tidak otomatis menjadi host, termasuk saat semua pemain aktif offline.
- Host dapat mengeluarkan pemain maupun penonton.
- Mengeluarkan pemain dari pertandingan berjalan membatalkan pertandingan dan mengembalikan peserta yang tersisa ke lobi.
- Mengeluarkan penonton tidak memengaruhi pertandingan.
- Host dapat mengakhiri sesi pertandingan jika pemain tidak kembali.
- **Usulan:** jika semua pemain offline, pemain aktif pertama yang kembali memperoleh kendali; ini tidak memberikan kendali kepada penonton.
- **Usulan:** pengeluaran memutus akses sesi peserta ke room. Larangan permanen berbasis perangkat/IP tidak termasuk keputusan yang telah disepakati.
- **Terbuka:** perilaku “keluar permanen” oleh pemain sendiri selama pertandingan; berbeda dari reconnect sementara.

#### US-09 — Penonton dan bermain ulang

Sebagai penonton, saya ingin melihat permainan dan mengikuti pertandingan berikutnya tanpa mengganggu pertandingan aktif.

- **Disepakati:** penonton melihat meja, indikator peserta, jumlah kartu, level, nyawa, dan shuriken; tidak melihat isi tangan.
- Penonton tidak dapat memainkan kartu, menekan siap sebagai pemain, melakukan voting, atau memegang kendali host otomatis.
- Setelah menang/kalah, tersedia kembali ke lobi dan bermain ulang dalam room yang sama.
- Penonton dapat menjadi pemain pada permainan berikutnya jika tersedia kursi.
- Host membagikan kartu untuk pertandingan berikutnya dengan 2–4 pemain terhubung, tanpa kesiapan di lobi.
- **Usulan:** kursi pemain lama tetap dipertahankan di lobi; penonton mengambil kursi yang tersedia melalui aksi “Ikut bermain”.

#### US-10 — Pemulihan dan kedaluwarsa

Sebagai pemain, saya ingin sesi tetap dapat dilanjutkan setelah refresh, restart, atau deploy ulang.

- **Disepakati:** perubahan aksi disimpan sebelum hasil final dikirim kepada peserta.
- Restart/deploy memulihkan progres terakhir yang dikonfirmasi, lalu menjeda pertandingan sampai pemain online siap.
- Tidak boleh terjadi pembagian ulang kartu atau pengurangan nyawa/shuriken kedua kali akibat reconnect.
- Room kedaluwarsa 24 jam sejak pemain aktif terakhir keluar; penonton tidak memperpanjangnya.
- Hitungan dibatalkan ketika pemain aktif kembali; dimulai lagi ketika pemain aktif terakhir kemudian keluar.
- **Usulan:** kedaluwarsa menghapus state room dan menutup koneksi penonton yang tersisa dengan pesan yang jelas.
- **Usulan:** setelah downtime, server memeriksa deadline tersimpan sebelum menerima reconnect. Status semua koneksi dipulihkan sebagai offline; state game tetap tersimpan.
- **Terbuka:** acuan awal 24 jam jika proses mati mendadak ketika pemain masih tercatat online. Rekomendasi: gunakan waktu liveness terakhir yang tersimpan dan dokumentasikan ketelitiannya.

#### US-11 — Antarmuka, bahasa, dan suara

Sebagai peserta, saya ingin memainkan game dari HP atau desktop dengan bahasa pilihan saya.

- **Disepakati:** desain utama HP portrait, dengan dukungan desktop.
- Tema gelap dan misterius, desain kartu serta ilustrasi buatan sendiri, angka besar, animasi singkat.
- Bahasa Indonesia/Inggris dipilih per peserta dan disimpan di browser; tidak mengubah bahasa peserta lain.
- Panduan aturan tersedia dari lobi dalam kedua bahasa; membukanya tidak menandai siap.
- Suara untuk kartu, kehilangan nyawa, shuriken, dan perpindahan level; tersedia mute pribadi yang tersimpan.
- Tidak ada metronom, countdown untuk timing kartu, atau audio berkala sebagai alat bantu.
- Tidak ada voice/video bawaan; peserta dapat menggunakan panggilan eksternal tanpa membocorkan kartu.
- **Usulan target QA:** tidak ada gulir horizontal pada lebar 360–1440 px; tombol aksi minimal 44 × 44 CSS px; navigasi keyboard, fokus terlihat, kontras teks memadai, dan dukungan reduced motion.
- **Usulan:** suara mulai setelah interaksi pengguna sesuai pembatasan browser; kegagalan audio tidak menghalangi permainan.

### 2.5 State dan Prioritas Peristiwa

Model berikut adalah **usulan implementasi** untuk memenuhi keputusan produk, bukan kewajiban memakai library state machine.

| State | Aksi utama | Transisi |
|---|---|---|
| Lobi | Bergabung, pengaturan, host membagikan kartu | Kesiapan level |
| Kesiapan | Pemain online menyatakan atau membatalkan siap; menutup popup hasil secara pribadi | Aktif bila semua pemain online siap |
| Aktif | Main kartu, usul shuriken | Kesalahan, voting, jeda koneksi, selesai level/pertandingan |
| Voting shuriken | Setuju/tolak | Resolusi lalu kesiapan; offline tidak menghilangkan kewajiban voting |
| Resolusi kesalahan | Tampilkan hasil server | Kesiapan, selesai level, atau kalah |
| Jeda koneksi/pemulihan | Reconnect, host meminta unpause | Kesiapan setelah kebijakan jeda dipenuhi |
| Selesai | Tampilkan menang/kalah/dibatalkan | Lobi untuk pertandingan baru |
| Kedaluwarsa | Tidak menerima aksi room | Pengguna membuat atau mencari room lain |

Server memproses aksi dalam satu urutan per room. Aksi yang datang setelah perubahan fase harus divalidasi terhadap fase terbaru. Contoh: aksi kartu yang diterima sesudah voting dimulai ditolak, bukan ditunda untuk dimainkan otomatis setelah voting.

Disconnect tidak boleh menghapus konteks voting. Jika jeda koneksi terjadi saat voting, persetujuan tetap belum selesai; host tidak boleh mengubahnya menjadi permainan aktif. Pemulihan restart mempertahankan konteks pertandingan dan voting; **usulan:** persetujuan voting yang belum selesai diminta ulang setelah reconnect agar tidak memakai persetujuan lama tanpa konteks.

### 2.6 Penyesuaian dari Permainan Fisik

- Ritual kesiapan menjadi tombol per pemain online.
- Permintaan fokus ulang bebas tidak tersedia, sesuai keputusan pengguna.
- Server mendeteksi kesalahan dan menentukan urutan aksi.
- Terdapat kebijakan disconnect, unpause host, penonton, dan pemulihan sesi.
- Riwayat kartu tidak tersedia; tampilan standar hanya menunjukkan kartu teratas.
- Aturan kartu, nyawa, hadiah, dan target level tetap baku.

**Keputusan Blind Mode:** jadikan tantangan opsional setelah menang, default tidak aktif. Host mendapat tombol “Mulai Blind Mode” dari hasil kemenangan; jika dipilih, tim memulai lagi dari level 1 memakai nyawa/shuriken tersisa, kartu dimainkan tertutup, lalu urutan diperiksa saat level selesai. Mode ini terpisah dari rematch normal dan tidak mengubah aturan normal. Implementasi engine Blind Mode masih menjadi pekerjaan lanjutan karena membutuhkan state kartu tertutup dan evaluasi urutan akhir level. Acuan: [aturan original, halaman kedua](https://www.brettspiele-report.de/images/t/the-mind/The-Mind-Spielanleitung.pdf).

### 2.7 Non-Goals

Tidak termasuk versi pertama berdasarkan ruang lingkup saat ini:

- Akun, password, profil lintas perangkat, dan pengambilalihan sesi berdasarkan username.
- Matchmaking publik, leaderboard, ranking, monetisasi, bot, atau lawan AI.
- Voice/video bawaan dan chat untuk membocorkan informasi kartu.
- Modifikasi jumlah nyawa, target level, atau hadiah melalui pengaturan room.
- Undo, pengurutan kartu otomatis, riwayat angka, dan alat bantu menghitung timing.
- Aplikasi native mobile, multi-instance backend, Redis, atau layanan database terpisah.
- Varian The Mind Extreme atau Soulmates. Blind Mode original tetap berstatus terbuka, bukan otomatis dikeluarkan.

## 3. AI System Requirements (If Applicable)

Tidak berlaku. Produk tidak memerlukan model AI, layanan inferensi, agent, embedding, atau API AI. Ilustrasi merupakan aset antarmuka; tidak ada fitur generasi AI runtime yang disepakati.

## 4. Technical Specifications

### 4.1 Stack yang Disepakati

| Lapisan | Teknologi | Peran |
|---|---|---|
| Frontend | React, TypeScript, Vite | Antarmuka permainan dan build frontend |
| Navigasi | TanStack Router | Halaman masuk, lobi, dan room |
| Styling | CSS biasa | Layout, tema, animasi |
| Runtime/package manager | Bun | Menjalankan server dan mengelola dependency |
| Realtime | Socket.IO | Pengiriman aksi, update, koneksi dan reconnect |
| Persistensi | SQLite melalui bun:sqlite | State room dan sesi yang dapat dipulihkan |
| Deployment | Satu aplikasi Docker di VPS Dokploy | Satu instance backend dengan volume persisten |

TanStack Start dan TanStack Query tidak termasuk stack yang ditetapkan. Versi dependency akan dipilih dan dikunci saat implementasi; PRD tidak menetapkan versi yang belum diuji bersama.

### 4.2 Architecture Overview

Browser mengirim aksi melalui Socket.IO. Server memeriksa identitas, peran, fase, dan kepemilikan kartu; memproses perubahan dalam urutan room; menyimpan perubahan; baru mengirim konfirmasi serta tampilan yang sesuai kepada tiap peserta.

**Usulan rancangan minimum:**

- Satu proses Bun melayani aset frontend hasil build dan koneksi Socket.IO pada origin yang sama.
- Logika aturan berupa fungsi TypeScript yang dapat diuji tanpa browser atau Socket.IO.
- State aktif room berada di memori, dengan snapshot SQLite sebagai sumber pemulihan; memori baru dianggap final setelah penyimpanan berhasil.
- Satu transaksi menyimpan perubahan state dan informasi pencegah duplikasi aksi secara atomik.
- Setiap room memiliki nomor revisi; setiap aksi memiliki identitas unik dan identitas pertandingan agar paket lama tidak memengaruhi permainan baru.
- Bila penyimpanan gagal, server tidak mengonfirmasi keberhasilan atau melanjutkan dari state yang belum tersimpan.
- Socket.IO membantu koneksi, tetapi autentikasi sesi, pemulihan progres, dan penolakan aksi duplikat tetap diimplementasikan aplikasi.

### 4.3 Data Minimum

Nama tabel dan bentuk schema belum dikunci. Data yang dibutuhkan:

| Entitas | Isi minimum |
|---|---|
| Room | ID/kode, konfigurasi disconnect, status, revisi, host, waktu dibuat dan deadline kedaluwarsa |
| Peserta | ID sesi internal, username, peran, urutan bergabung, status koneksi dan waktu liveness |
| Pertandingan | ID, daftar pemain tetap, level/target, nyawa, shuriken, tangan, kartu teratas, fase, hasil |
| Koordinasi | Kesiapan, voting, penyebab jeda, deadline disconnect dan override host |
| Keandalan | Token sesi yang dapat divalidasi dan catatan aksi yang cukup untuk mencegah penerapan ulang |

Preferensi bahasa dan mute disimpan di browser. Kartu dan progres tidak boleh bergantung hanya pada local storage. Menyimpan state internal tidak berarti menyediakan riwayat kartu kepada pengguna.

### 4.4 Integration Points

- HTTP untuk aset aplikasi serta kebutuhan masuk/membuat/menemukan room; pembagian endpoint rinci ditetapkan saat implementasi.
- Socket.IO untuk bergabung sebagai sesi sah, kesiapan, aksi kartu, voting, moderasi, dan update state.
- SQLite pada direktori volume persisten, termasuk file pendamping bila memakai WAL.
- Reverse proxy deployment harus meneruskan koneksi Socket.IO dan menggunakan HTTPS/WSS.
- Tidak ada integrasi akun pihak ketiga, pembayaran, atau provider cloud tambahan.

### 4.5 Security & Privacy

Persyaratan pelaksanaan untuk menjaga keputusan produk:

- Server adalah otoritas penuh; jangan percaya nilai kartu, hak host, hasil voting, atau waktu aksi yang dikirim klien.
- Gunakan token sesi acak yang tidak dapat ditebak. Tautan undangan tidak memuat token pemilik sesi.
- Validasi tipe, ukuran, rentang, dan frekuensi pesan; aksi terlarang harus ditolak server meskipun tombolnya tidak terlihat.
- Setiap pemain hanya menerima tangan sendiri; penonton tidak menerima tangan mana pun. Status kartu publik hanya dikirim sesuai fase.
- Tampilan error/shuriken boleh mengungkap kartu yang memang dibuang; tidak membuat riwayat angka permanen di UI.
- Jangan mencatat token sesi atau isi tangan dalam log operasional biasa.
- Pakai query berparameter dan transaksi untuk perubahan terkait.
- Peserta yang dikeluarkan atau koneksi yang digantikan tidak boleh terus menerima data privat atau mengirim aksi sah.
- Aset grafis dibuat sendiri sebagaimana disepakati. Nama kerja proyek bukan klaim afiliasi resmi dengan penerbit.

### 4.6 Operasional dan Persistensi

- **Disepakati:** satu instance backend. Menambah replica memerlukan desain sinkronisasi room baru dan tidak dilakukan diam-diam.
- Mount direktori database ke volume persisten agar pergantian container tidak menghapus progres.
- **Usulan:** health check terpisah dari kesiapan room; shutdown menghentikan penerimaan aksi baru sebelum menutup penyimpanan.
- Restart dengan storage sehat harus memulihkan semua aksi yang sebelumnya diakui; ini tidak mencakup kehilangan disk/VPS.
- **Terbuka:** strategi backup, kapasitas disk, lokasi VPS, domain, serta akses deployment belum diberikan.
- Anggaran tambahan layanan adalah nol untuk versi pertama. Tidak ada jaminan kapasitas atau latency tanpa pengukuran VPS aktual.

### 4.7 Verification Plan

Pemeriksaan diarahkan pada perilaku, bukan jumlah unit test:

| Area | Skenario wajib |
|---|---|
| Aturan | Konfigurasi 2/3/4 pemain; pembagian unik; hadiah dan batas inventori; menang/kalah |
| Kesalahan | Beberapa kartu rendah pada beberapa pemain hanya mengurangi satu nyawa; kartu offline ikut resolusi |
| Shuriken | Semua setuju, satu menolak, pemain offline, inventori nol, dan tangan kosong |
| Urutan | Dua aksi berdekatan, paket duplikat, klik dari fase lama, aksi setelah pertandingan baru |
| Sesi | Refresh, token salah, username kembar, koneksi baru menggantikan lama, peserta dikeluarkan |
| Koneksi | Dua kebijakan disconnect, tiga timeout, override host, seluruh pemain offline, host kembali |
| Pemulihan | Restart setelah commit sebelum broadcast; storage gagal; voting terputus; deadline room terlewati |
| Privasi | Inspeksi payload pemain dan penonton untuk memastikan tidak ada tangan lawan |
| Antarmuka | HP/desktop, kedua bahasa, keyboard, reduced motion, mute dan audio diblokir browser |
| Deployment | Container dapat dibangun; restart dengan volume sama mempertahankan progres; akses realtime melalui proxy |

Target latency, jumlah room, dan batas penonton ditetapkan setelah uji pada VPS, bukan berdasarkan benchmark runtime pihak lain.

## 5. Risks & Roadmap

### 5.1 Risiko Utama

| Risiko | Dampak | Penanganan |
|---|---|---|
| Perbedaan latency | Dua kartu berdekatan dapat diterima berbeda dari urutan klik lokal | Urutan server konsisten dan dijelaskan; tidak menjanjikan kompensasi latency |
| Jeda dan voting bertumpuk | Permainan dapat dilanjutkan tanpa persetujuan yang semestinya | Simpan konteks fase; unpause tidak mengesampingkan voting |
| Reconnect/retry | Aksi atau hadiah diterapkan dua kali | Identitas aksi, revisi, transaksi, dan uji kegagalan |
| Restart atau storage gagal | Progres hilang atau memori berbeda dengan disk | Persist sebelum konfirmasi; volume; pemulihan teruji |
| Kartu privat bocor | Permainan kehilangan integritas | Payload per peserta dan pemeriksaan otorisasi server |
| Room/penonton berlebihan | Sumber daya VPS habis | Ukur pemakaian dan tetapkan batas sebelum dibuka lebih luas |
| Tanpa akun | Sesi tidak pulih jika penyimpanan browser hilang | Jelaskan batas pemulihan; username tidak dapat mengambil alih |
| Cakupan original belum lengkap | Klaim adaptasi penuh tidak sesuai fitur | Putuskan Blind Mode dan dokumentasikan deviasi online |

### 5.2 Phased Rollout

Tahapan berikut adalah urutan pengerjaan yang diusulkan, bukan pengurangan fitur yang telah disepakati atau jadwal yang dijanjikan.

| Tahap | Hasil | Gate |
|---|---|---|
| Fondasi | Aturan, penyimpanan, sesi, room dan koneksi | Aturan serta privasi teruji |
| Alur permainan lengkap | Lobi, kartu, level, kesalahan, shuriken, hasil dan rematch | Permainan 2–4 pemain ujung ke ujung |
| Ketahanan online | Disconnect, host, penonton, pemulihan dan kedaluwarsa | Seluruh skenario koneksi/restart wajib lulus |
| MVP siap dipakai | Antarmuka final, dua bahasa, suara, panduan dan container | Seluruh SC-01 sampai SC-05 lulus |
| v1.1 | Perbaikan berdasarkan penggunaan dan hasil pengukuran | Tidak menambah fitur tanpa kebutuhan yang disetujui |
| v2.0 | Belum ditentukan | Perlu keputusan produk baru; akun/matchmaking/multi-instance bukan komitmen |

### 5.3 Keputusan Terbuka sebelum Bagian Terkait Diimplementasikan

1. **Blind Mode original:** desain sudah diputuskan sebagai tantangan opsional setelah menang; implementasi engine belum dikerjakan.
2. **Identitas dan kapasitas:** panjang/karakter username serta batas penonton dan room berdasarkan kemampuan VPS.
3. **Reconnect selama masa tenggang:** apakah kedatangan kembali selalu memicu kesiapan bersama; rekomendasi ya.
4. **Keluar permanen:** rekomendasi membatalkan pertandingan dan kembali ke lobi, sejajar dengan mengeluarkan pemain; belum disepakati.
5. **Kedaluwarsa saat crash:** acuan waktu ketika semua koneksi hilang tanpa event disconnect yang sempat disimpan.
6. **Deployment:** domain, spesifikasi/lokasi VPS, akses Dokploy, dan kebijakan backup.

Dokumen ini memenuhi permintaan penyusunan PRD. Pembuatan aplikasi dan deployment belum dilakukan sebagai bagian dari pekerjaan dokumentasi ini.

### 5.4 Catatan Implementasi — 10 September 2026

Setelah dokumen ini dibuat, pengguna mengizinkan implementasi. Mode standar, antarmuka, server, penyimpanan, dan paket Docker telah ditulis. Rincian operasional serta pilihan pelaksanaan berada di [README](../README.md). Implementasi memilih username 1–24 karakter, batas awal 100 room/12 penonton, kesiapan ulang saat reconnect, pembatalan saat pemain keluar permanen, dan liveness 15 detik untuk pemulihan expiry setelah crash. Pilihan ini merupakan keputusan implementasi, bukan hasil wawancara tambahan.

Blind Mode masih belum diimplementasikan. Build dan pengujian otomatis dilakukan lokal; QA visual, build Docker, dan deployment Dokploy belum diverifikasi karena browser terhubung, Docker, serta akses VPS tidak tersedia dalam sesi implementasi.
