# Flexible Budget Cycles (Recurring & Custom Date Ranges)

## Problem Statement

How Might We memungkinkan pengguna mengontrol pos pengeluaran cepat bersiklus pendek (Mingguan) dan anggaran proyek temporer (Custom Date Range) tanpa menambah kerumitan form atau memperlambat performa kueri?

## Recommended Direction: Dual-Mode Budgets (Cadence vs Event)

Terapkan dua mode siklus anggaran yang kohesif:
1. **Recurring Cadence**:
   - `MONTHLY`: Selaras dengan siklus gajian pengguna (`budgetMonthStartDay`).
   - `WEEKLY`: Selaras dengan hari awal pekan pengguna (`weekStartsOn`). Otomatis bergulir setiap minggu.
2. **Custom Date Range (Project / Event)**:
   - Pengguna menentukan `startDate` dan `endDate` spesifik.
   - Ideal untuk liburan, renovasi, event 3 bulan, dsb.
   - Otomatis ditandai "Selesai" setelah melewati `endDate`.

## Technical & Performance Strategy

- **Prisma Schema Update**: Tambahkan kolom `period` (enum/text: `MONTHLY`, `WEEKLY`, `CUSTOM`), serta nullable `startDate` dan `endDate` pada tabel `Budget`.
- **Single Bounding-Box Query**: `getBudgetStatus()` menghitung rentang minimum dan maksimum dari seluruh budget aktif pengguna, mengambil mutasi transaksi dalam 1 kueri SQL, lalu memetakan ke masing-masing budget di level service.
- **Dashboard Safe-to-Spend**: Anggaran `CUSTOM` tidak memotong kalkulator _Safe to Spend_ harian, menjaga metrik arus kas harian tetap realistis.

## Key Assumptions to Validate

- [x] Pengguna pengeluaran cepat (F&B/entertainment) lebih mudah mengontrol batas mingguan daripada bulanan.
- [x] Anggaran proyek (Custom Range) dipandang sebagai alokasi terpisah yang tidak perlu mereset otomatis.
- [ ] Bounding-box SQL query mampu mengagregasi gabungan budget mingguan, bulanan, dan custom dalam < 15ms.

## MVP Scope

- Penambahan kolom `period`, `startDate`, `endDate` pada tabel `Budget` dan schema domain Zod.
- Komputasi dinamis rentang tanggal mingguan berdasarkan `weekStartsOn`.
- Pembaruan `BudgetForm` dengan pemilih mode: `Bulanan`, `Mingguan`, atau `Rentang Tanggal Khusus`.
- Badge periode pada kartu anggaran (`Mingguan`, `Bulanan`, `Custom`).
- Indikator progres waktu dan status selesai untuk budget `CUSTOM`.

## Not Doing (and Why)

- **Kompleksitas Cron Custom / Bi-weekly / Tri-weekly**: Ditolak untuk mencegah form menjadi membingungkan. Kasus 3 bulanan cukup diakomodasi oleh mode `CUSTOM` (pilih tanggal mulai dan 3 bulan ke depan).
- **Rollover Sisa Anggaran**: Ditolak untuk MVP; sisa uang minggu ini tidak otomatis ditambahkan ke minggu depan agar kalkulasi tetap deterministik dan bebas asumsi pembukuan ganda.
