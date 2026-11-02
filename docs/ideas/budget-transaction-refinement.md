# Refinement: Hierarchical Budget-to-Transaction Aggregation

## Problem Statement

How Might We memastikan kalkulasi kuota pengeluaran pada Anggaran (Budget) secara akurat mengakumulasi seluruh subkategori yang relevan, serta memberikan visibilitas mutasi pengeluaran secara instan tanpa merusak kesederhanaan model data?

## Recommended Direction: Frictionless Category Roll-up

Pertahankan arsitektur relasi dinamis (read-time derived) antara Transaction dan Budget melalui Category, dengan 3 penyempurnaan utama:
1. **Recursive Child Aggregation**: Kalkulasi pengeluaran budget kategori induk otomatis merangkul semua transaksi yang tercatat di subkategorinya.
2. **Contextual Transaction Jump**: Setiap kartu budget menyediakan tautan navigasi langsung ke halaman Transaksi dengan parameter filter kategori dan rentang siklus berjalan.
3. **Pacing Indicator (Daily Safe Pace)**: Memberikan konteks pengeluaran harian yang aman (Sisa Kuota / Sisa Hari) agar anggaran tidak sekadar menjadi angka statis pasif.

## Key Assumptions to Validate

- [x] Pengguna mengharapkan belanja di subkategori otomatis memotong kuota anggaran kategori induk.
- [x] Transaksi yang dihitung ke budget IDR terkunci pada mata uang akun IDR (base currency).
- [ ] Kueri agregasi pengeluaran dengan relasi anak-ke-induk tetap ringan dan efisien.

## MVP Scope

- Perbaikan fungsi `getBudgetStatus()` di `packages/services/src/budgets.ts` untuk memetakan child categories ke parent category totals.
- Filter akun mata uang: hanya mengagregasi pengeluaran dari akun dengan currency IDR.
- Menambahkan parameter `range` (`from` & `to`) dan `transactionCount` ke output status anggaran.
- Peningkatan UI pada `apps/web/app/app/budgets/page.tsx` & komponen kartu anggaran:
  - Tautan _"Lihat transaksi periode ini"_ yang mengarahkan ke halaman transaksi dengan filter kategori & rentang tanggal siklus aktif.
  - Indikator kecepatan laju pengeluaran harian (Daily Pacing).

## Not Doing (and Why)

- **Menambahkan `budgetId` fisik ke tabel `Transaction`**: Ditolak karena menciptakan duplikasi kebenaran dan rawan out-of-sync saat mutasi diedit.
- **Multi-currency rate conversion di dalam budget**: Ditolak untuk MVP; transaksi non-IDR tidak dicampuradukkan dengan budget nominal IDR untuk menghindari distorsi nilai tukar fiktif.
- **Hard-blocking saat overbudget**: Cashow adalah aplikasi pencatatan keuangan pribadi, bukan alat pemblokir transaksi.
