import {
  ArrowRight,
  CheckCircle,
  Cube,
  Database,
  LockKey,
  ShieldCheck,
  Sparkle,
  Vault,
  Wallet,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Cashflow3DSection } from "@/components/ledger/cashflow-3d-client";
import { LandingNav } from "@/components/ledger/landing-nav";
import { LandingProductPreview } from "@/components/ledger/landing-product-preview";
import { TaglineReveal } from "@/components/ledger/tagline-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Presisi integer murni",
    description:
      "Setiap angka rupiah disimpan dan dihitung sebagai bilangan bulat. Tidak ada pembulatan desimal yang membuat saldo akhir berselisih.",
  },
  {
    icon: Wallet,
    title: "Alokasi amplop terkunci",
    description:
      "Pengeluaran menarik dana dari pos pemasukan tertentu, bukan sekadar memotong angka saldo gelondongan tanpa rencana.",
  },
  {
    icon: Database,
    title: "Kedaulatan data lokal",
    description:
      "Basis data berada di server milikmu sendiri. Nol telemetri, nol pelacak iklan, dan bebas dari pengawasan pihak komersial.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Hubungkan akun dan saldo awal",
    description:
      "Daftarkan rekening bank, dompet tunai, atau pos dana awal yang kamu kelola secara terpusat.",
  },
  {
    step: "02",
    title: "Kunci pos anggaran wajib",
    description:
      "Pisahkan alokasi untuk tagihan rutin dan dana darurat sebelum menentukan sisa uang bebas belanja.",
  },
  {
    step: "03",
    title: "Pantau batas aman belanja",
    description:
      "Ketahui batas belanja harian yang aman atau gunakan asisten pintar untuk merangkum kondisi keuanganmu.",
  },
];

const COMPARISONS = [
  {
    feature: "Penyimpanan data transaksi",
    cashow: "Server pribadi milikmu sendiri",
    bank: "Peladen pihak ketiga komersial",
    sheet: "Layanan dokumen komersial",
  },
  {
    feature: "Ketepatan hitungan saldo",
    cashow: "Integer murni tanpa pembulatan palsu",
    bank: "Terkadang lambat sinkronisasi",
    sheet: "Rentan galat formula perhitungan",
  },
  {
    feature: "Alokasi amplop pemasukan",
    cashow: "Otomatis mengunci dana pos tertentu",
    bank: "Hanya menyajikan daftar mutasi kotor",
    sheet: "Harus dirumuskan manual berulang kali",
  },
  {
    feature: "Asisten tanya jawab keuangan",
    cashow: "Tersedia langsung membaca buku kas",
    bank: "Bantuan bot terbatas penawaran promo",
    sheet: "Tidak tersedia asisten percakapan",
  },
];

const FAQS = [
  {
    question: "Mengapa Cashow memakai sistem alokasi amplop?",
    answer:
      "Dengan mengaitkan setiap pengeluaran ke pos pemasukan tertentu, kamu terhindar dari ilusi saldo rekening yang tampak banyak padahal sudah menjadi hak pembayaran tagihan rutin.",
  },
  {
    question: "Apakah data keuangan saya aman dan terisolasi?",
    answer:
      "Sangat aman. Cashow dirancang untuk dioperasikan di server milikmu sendiri. Tidak ada data transaksi yang dikirimkan ke pihak periklanan atau pelacak komersial.",
  },
  {
    question: "Bagaimana cara kerja perhitungan integer tanpa desimal?",
    answer:
      "Semua nilai mata uang diproses sebagai bilangan bulat murni. Pendekatan ini menghilangkan galat pembulatan angka pecahan yang kerap terjadi pada aplikasi keuangan biasa.",
  },
  {
    question: "Apakah aplikasi ini nyaman diakses lewat ponsel pintar?",
    answer:
      "Tentu. Seluruh antarmuka dirancang responsif dan mendukung pemasangan aplikasi web progresif sehingga bisa diakses cepat layaknya aplikasi bawaan.",
  },
  {
    question: "Bagaimana cara kerja asisten pintar di Cashow?",
    answer:
      "Asisten membaca buku kas langsung secara lokal untuk menjawab pertanyaan seputar saldo, batas belanja aman harian, dan ringkasan pengeluaran tanpa perantara.",
  },
  {
    question: "Apakah saya perlu kartu kredit untuk mulai memakai Cashow?",
    answer:
      "Tidak. Cashow merupakan peranti lunak yang bisa kamu pasang dan gunakan secara bebas di peladen atau komputer lokal milikmu.",
  },
  {
    question: "Bagaimana jika saya ingin mengekspor atau memindahkan data?",
    answer:
      "Kamu memiliki akses langsung ke basis data lokal dan berkas cadangan sehingga data bisa dipindahkan kapan saja tanpa hambatan.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cashow",
  operatingSystem: "Web",
  applicationCategory: "FinanceApplication",
  description:
    "Buku kas pribadi mandiri berpresisi integer dengan alokasi amplop terkunci dan kedaulatan data lokal.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "IDR",
  },
  featureList: [
    "Presisi integer tanpa selisih desimal",
    "Alokasi amplop terkunci",
    "Kedaulatan data lokal mandiri",
    "Simulasi arus kas 3D interaktif",
    "Asisten buku kas terintegrasi",
  ],
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
      {/* Schema.org Structured Data */}
      <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>

      {/* Accessibility skip link */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-md"
      >
        Lewati ke konten utama
      </a>

      {/* Floating navigation header */}
      <LandingNav
        cta={
          <Suspense fallback={<LandingCtaFallback size="sm" />}>
            <LandingCta size="sm" />
          </Suspense>
        }
      />

      <main id="content" className="flex flex-1 flex-col">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24 lg:px-8">
          {/* Subtle radial ambient backdrop glow */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center overflow-hidden"
            aria-hidden="true"
          >
            <div className="h-[420px] w-[720px] rounded-full bg-primary/10 blur-[110px] dark:bg-primary/15" />
          </div>

          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            {/* Editorial kicker */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 backdrop-blur-xs">
              <span className="size-1.5 rounded-full bg-primary" />
              <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                Buku Kas Mandiri · Integer Presisi
              </p>
            </div>

            {/* Main Headline */}
            <h1 className="mt-5 max-w-[680px] font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-black via-zinc-800 to-[#666666] bg-clip-text text-transparent dark:from-white dark:via-zinc-200 dark:to-[#9B9B9B]">
                Ikuti ke mana setiap rupiah mengalir
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-5 max-w-[640px] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              Pencatat keuangan pribadi yang berjalan di server pribadimu. Pastikan setiap rupiah
              terikat pada pos anggaran tertentu dengan kepastian bilangan bulat penuh dan privasi
              data mutlak.
            </p>

            {/* Primary Action Button */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Suspense fallback={<LandingCtaFallback size="base" />}>
                <LandingCta size="base" />
              </Suspense>
            </div>

            {/* Proof signals strip */}
            <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 border-y border-border py-4 sm:grid-cols-3 sm:gap-8">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <CheckCircle className="size-4 text-primary shrink-0" weight="fill" />
                <span>Presisi bilangan bulat mutlak</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <LockKey className="size-4 text-primary shrink-0" weight="fill" />
                <span>100% basis data lokal mandiri</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Sparkle className="size-4 text-primary shrink-0" weight="fill" />
                <span>Asisten tanya jawab cerdas</span>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE 3D ARUS KAS SIMULATION */}
        <section id="simulasi-3d" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-[680px] text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-0.5 text-xs text-muted-foreground">
                <Cube className="size-3.5 text-primary" weight="bold" />
                <span>Eksplorasi Interaktif Tiga Dimensi</span>
              </div>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Visualisasi fisik alokasi amplop dan arus kas
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                Inti logam di pusat merepresentasikan buku kas berpresisi integer. Tiga cincin
                konsentris mengikat aliran transaksi ke pos masing masing sehingga tidak ada saldo
                mengambang tanpa tujuan.
              </p>
            </div>

            {/* 3D WebGL Canvas Component */}
            <div className="mt-8">
              <Cashflow3DSection />
            </div>

            {/* Explanatory telemetry callouts */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <p className="font-heading text-sm font-semibold text-foreground">
                    Cincin Kebutuhan Pokok
                  </p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Alokasi primer untuk sewa tempat tinggal, belanja dapur, dan tagihan listrik yang
                  dikunci pertama kali.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan-500" />
                  <p className="font-heading text-sm font-semibold text-foreground">
                    Cincin Dana Darurat
                  </p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Pos cadangan likuid yang dijaga ketat di rekening terpisah, pantang dipakai untuk
                  belanja impulsif.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <p className="font-heading text-sm font-semibold text-foreground">
                    Cincin Bebas Belanja
                  </p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Sisa alokasi bersih yang diubah menjadi kuota belanja harian aman agar kamu bisa
                  menikmati hidup tanpa rasa bersalah.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* MANDATORY TAGLINE REVEAL SECTION (B11) */}
        <section className="border-t border-border bg-muted/20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Prinsip Dasar
            </p>
            <div className="mt-6 flex justify-center">
              <TaglineReveal
                text="Setiap rupiah memiliki tujuan yang pasti sebelum kamu mulai membelanjakannya."
                className="max-w-[680px] font-heading text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
              />
            </div>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Bukan sekadar mencatat pengeluaran yang telah terjadi, tetapi merencanakan ke mana
              dana dialokasikan agar keuangan pribadimu tetap terukur dan tenang.
            </p>
          </div>
        </section>

        {/* PRODUCT INTERFACE PREVIEW */}
        <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Antarmuka Kerja
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Jernih, terstruktur, dan bebas distraksi
              </h2>
              <p className="mt-3 text-base text-muted-foreground text-pretty">
                Seluruh metrik penting disajikan tanpa grafik rumit yang membingungkan.
              </p>
            </div>

            <div className="mt-10 w-full">
              <LandingProductPreview />
            </div>
          </div>
        </section>

        {/* THREE CORE PILLARS SECTION */}
        <section
          id="integritas"
          className="border-t border-border px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Arsitektur Pembukuan
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Dirancang untuk kepastian matematis penuh
              </h2>
              <p className="mt-3 text-base text-muted-foreground text-pretty">
                Tiga pilar teknis yang membedakan Cashow dari aplikasi pencatat kas biasa.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {PRINCIPLES.map((p) => {
                const IconComponent = p.icon;
                return (
                  <div
                    key={p.title}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-xs"
                  >
                    <div>
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <IconComponent className="size-5" />
                      </div>
                      <h3 className="mt-4 font-heading text-base font-semibold tracking-tight text-card-foreground">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                        {p.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monospace Code / Ledger Comparison */}
            <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8">
              <div className="border-b border-border pb-4">
                <p className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                  Perbandingan Komputasi Angka
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Lihat perbedaan antara akumulasi bilangan pecahan dengan kalkulasi integer murni.
                </p>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 font-mono text-xs">
                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                  <p className="font-semibold text-muted-foreground">
                    # Pendekatan Aplikasi Biasa (Float)
                  </p>
                  <p className="text-foreground">0.1 + 0.2 = 0.30000000000000004</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Galat desimal menyelinap ke saldo akumulatif seiring ribuan mutasi kas dicatat.
                  </p>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="font-semibold text-primary"># Pendekatan Cashow (Integer Murni)</p>
                  <p className="text-foreground font-semibold">100000n + 200000n = 300000n tepat</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Setiap rupiah dihitung tanpa desimal palsu. Saldo selalu seimbang hingga
                    transaksi terakhir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section
          id="cara-kerja"
          className="border-t border-border bg-muted/20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Alur Praktis
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Tiga langkah memulai ketertiban finansial
              </h2>
              <p className="mt-3 text-base text-muted-foreground text-pretty">
                Mulai dari saldo awal hingga kebiasaan evaluasi yang mudah dijalankan setiap hari.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.step} className="rounded-xl border border-border bg-card p-6 shadow-xs">
                  <span className="font-mono text-xl font-bold tracking-tight text-primary">
                    {s.step}
                  </span>
                  <h3 className="mt-3 font-heading text-base font-semibold tracking-tight text-card-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARISON / TRANSPARENCY SECTION */}
        <section id="transparansi" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-[680px] text-center">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Perbandingan Transparan
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Mengapa bukan aplikasi biasa atau lembar sebar
              </h2>
              <p className="mt-3 text-base text-muted-foreground text-pretty">
                Lihat perbedaan prinsip pengelolaan kas mandiri dibanding alternatif lainnya.
              </p>
            </div>

            <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="p-4 font-semibold text-foreground sm:px-6">Fitur Utama</th>
                      <th className="p-4 font-semibold text-primary sm:px-6">Cashow</th>
                      <th className="p-4 font-semibold text-muted-foreground sm:px-6">
                        Aplikasi Bank Umum
                      </th>
                      <th className="p-4 font-semibold text-muted-foreground sm:px-6">
                        Lembar Sebar Manual
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {COMPARISONS.map((item) => (
                      <tr key={item.feature} className="transition-colors hover:bg-muted/30">
                        <td className="p-4 font-medium text-foreground sm:px-6">{item.feature}</td>
                        <td className="p-4 font-medium text-foreground sm:px-6">
                          <span className="inline-flex items-center gap-1.5 text-primary">
                            <CheckCircle className="size-4 shrink-0" weight="fill" />
                            {item.cashow}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground sm:px-6">
                          <span className="inline-flex items-center gap-1.5">
                            <XCircle className="size-4 shrink-0 text-muted-foreground/60" />
                            {item.bank}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground sm:px-6">
                          <span className="inline-flex items-center gap-1.5">
                            <XCircle className="size-4 shrink-0 text-muted-foreground/60" />
                            {item.sheet}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section
          id="faq"
          className="border-t border-border bg-muted/20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
        >
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                Tanya Jawab
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Pertanyaan yang sering diajukan
              </h2>
              <p className="mt-3 text-base text-muted-foreground text-pretty">
                Semua rincian penting seputar pemasangan, privasi, dan mekanisme perhitungan.
              </p>
            </div>

            <div className="mt-10">
              <Accordion className="rounded-xl border border-border bg-card p-2 sm:p-4">
                {FAQS.map((faq, index) => (
                  <AccordionItem
                    key={faq.question}
                    value={`item-${index}`}
                    className="border-border"
                  >
                    <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground text-pretty">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* FINAL CTA & RISK REVERSAL SECTION */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center shadow-xs sm:p-12">
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Vault className="size-5" />
            </div>

            <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Mulai kendalikan arus kas pribadimu hari ini
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Pasang langsung di server pribadimu. Nikmati pembukuan yang selalu seimbang, aman, dan
              sepenuhnya berada di bawah kendalimu.
            </p>

            <div className="mt-8 flex justify-center">
              <Suspense fallback={<LandingCtaFallback size="base" />}>
                <LandingCta size="base" />
              </Suspense>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Didukung teknologi buku besar berbasis bilangan bulat murni.
            </p>
          </div>
        </section>
      </main>

      {/* ACCESSIBLE FOOTER */}
      <footer className="border-t border-border bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
              Cashow
            </span>
            <span className="text-xs text-muted-foreground">
              Buku kas pribadi mandiri berpresisi tinggi
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <a href="#simulasi-3d" className="transition-colors hover:text-foreground">
              Simulasi 3D
            </a>
            <a href="#integritas" className="transition-colors hover:text-foreground">
              Integritas
            </a>
            <a href="#cara-kerja" className="transition-colors hover:text-foreground">
              Cara Kerja
            </a>
            <a href="#transparansi" className="transition-colors hover:text-foreground">
              Transparansi
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              Tanya Jawab
            </a>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Masuk
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Kedaulatan data finansial seutuhnya di tanganmu.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * The primary action in SaaS mode:
 * - Logged-in session -> /app ("Buka Buku Kas")
 * - Logged-out visitor -> /setup ("Mulai Sekarang") & /login link
 */
async function LandingCta({
  size = "base",
  className,
}: {
  size?: "sm" | "base";
  className?: string;
}) {
  await connection();

  const baseClass =
    size === "sm"
      ? "inline-flex items-center justify-center gap-1.5 rounded-full bg-primary py-2 px-3 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "inline-flex items-center justify-center gap-2 rounded-full bg-primary py-2 px-4 text-base font-semibold text-primary-foreground shadow-xs transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary/90 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const resolvedClass = cn(baseClass, className);

  const user = await getSessionUser();
  if (user !== null) {
    return (
      <Link className={resolvedClass} href="/app">
        Buka Buku Kas
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link className={resolvedClass} href="/setup">
        Mulai Sekarang
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border bg-card/60 px-3.5 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          size === "sm" ? "text-xs py-1.5 px-3" : "text-sm",
        )}
      >
        Masuk
      </Link>
    </div>
  );
}

function LandingCtaFallback({
  size = "base",
  className,
}: {
  size?: "sm" | "base";
  className?: string;
}) {
  const baseClass =
    size === "sm"
      ? "inline-flex items-center justify-center gap-1.5 rounded-full bg-primary py-2 px-3 text-sm font-semibold text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "inline-flex items-center justify-center gap-2 rounded-full bg-primary py-2 px-4 text-base font-semibold text-primary-foreground shadow-xs transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary/90 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link className={cn(baseClass, className)} href="/setup">
        Mulai Sekarang
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
