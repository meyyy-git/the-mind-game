# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Kelompok teman 2–4 orang yang bermain dari browser HP portrait atau desktop. Host mengatur room; penonton dapat mengikuti permainan berikutnya.

## Product Purpose

Adaptasi online The Mind original: kartu dimainkan berurutan tanpa membocorkan isi tangan, dengan timing pemain sebagai bagian permainan.

## Capabilities and Constraints

Room privat via kode/tautan, username tanpa akun, dua bahasa Indonesia/Inggris, kesiapan bersama, shuriken melalui voting, reconnect, pergantian host, dan SQLite persisten. Bun dan Socket.IO menjalankan satu instance di VPS Dokploy. Aturan lengkap: docs/PRD.md. Blind Mode belum termasuk implementasi.

## Brand Commitments

Pengguna meminta tema gelap dan misterius, aset kartu sendiri, antarmuka ramah, lalu secara eksplisit meminta revamp agar terasa sebagai game. Copy mengikuti aksi game, tidak memakai slogan generik. Nama kerja The Minds; tidak mengklaim afiliasi penerbit.

## Product Principles

- Kartu sendiri dan aksi berikutnya mudah ditemukan.
- Isi tangan pemain lain tetap tersembunyi.
- Animasi tidak memberi bantuan timing.
- Kendali host dan informasi penonton tidak mengganggu area permainan.

## Evidence on Hand

Wawancara pengguna, docs/PRD.md, kode game dan tes. Browser terhubung tidak tersedia saat revamp; hasil visual harus diperiksa saat browser tersedia.
