'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Lock, Clock, BarChart3 } from 'lucide-react';
import heroDeskImg from '@/src/assets/images/hero_ujianku_desk_1795492260850.jpg';
import teacherReviewImg from '@/src/assets/images/ujianku_teacher_review_1795492261622.jpg';
import studentFocusImg from '@/src/assets/images/ujianku_student_focus_1795492261556.jpg';
import { LandingInteractiveDemo } from '@/components/LandingInteractiveDemo';
import { useAuth } from '@/components/AuthProvider';

export default function LandingPage() {
  const { firebaseUser, profile, isAdmin } = useAuth();

  const dashboardHref = !firebaseUser
    ? '/login'
    : isAdmin
      ? '/admin'
      : profile?.role === 'teacher'
        ? '/teacher'
        : profile?.role === 'student'
          ? '/student'
          : '/register';

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      {/* Top Bar Contract: 1 Wordmark — 4 concise single-line links — 1 primary CTA */}
      <header className="bg-stone-50 border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            href="/"
            className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            UjianKu
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#simulasi" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Simulasi
            </a>
            <a href="#alur-guru" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Untuk Guru
            </a>
            <a href="#alur-siswa" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Untuk Siswa
            </a>
            <a href="#integritas" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Integritas
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              {firebaseUser ? 'Buka Ruang Kerja' : 'Masuk'}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12] text-balance">
              Ujian sekolah tertib, koreksi selesai seketika.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Platform ujian pilihan ganda untuk sekolah Indonesia dengan kunci jawaban terisolasi,
              deteksi pindah tab realtime, dan pemulihan jawaban otomatis saat koneksi terputus.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={firebaseUser ? dashboardHref : '/register'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
              >
                Mulai Buat Ujian
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#simulasi"
                className="inline-flex items-center px-5 py-3 rounded-lg border border-stone-300 bg-white text-slate-800 text-sm font-semibold hover:bg-stone-100 transition-colors whitespace-nowrap"
              >
                Coba Simulasi Soal
              </a>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Khusus soal pilihan ganda · Mendukung zona waktu WIB, WITA, WIT · Dukungan rumus KaTeX
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-stone-200 bg-stone-200">
              <Image
                src={heroDeskImg}
                alt="Siswa SMA mengerjakan ujian pilihan ganda terstruktur di laptop"
                fill
                priority
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Live Thing: Simulasi Ujian & Koreksi Otomatis */}
      <section id="simulasi" className="bg-stone-100 border-y border-stone-200 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Rasakan langsung lembar ujian dan koreksi otomatisnya
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Pilih jawaban, tandai ragu-ragu, uji pencatatan pindah tab, lalu kirim untuk melihat
              perhitungan skor otomatis dan pembahasan instan.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.06 }}
          >
            <LandingInteractiveDemo />
          </motion.div>
        </div>
      </section>

      {/* Alur Guru */}
      <section id="alur-guru" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-5"
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-stone-200 bg-stone-200">
              <Image
                src={teacherReviewImg}
                alt="Meja kerja guru menampilkan rekap nilai dan analisis butir soal"
                fill
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="lg:col-span-7"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Kendali penuh kelas dan pantauan realtime untuk guru
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Susun ujian pilihan ganda dalam hitungan menit, bagikan kode kelas 6 karakter, dan
              pantau seluruh siswa dari satu layar selama ujian berlangsung.
            </p>
            <div className="mt-8 space-y-5">
              <div className="pb-5 border-b border-stone-200">
                <p className="text-sm font-semibold text-slate-900">
                  01. Bank soal &amp; impor CSV
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Simpan soal pilihan ganda beserta rumus matematika KaTeX dan pembahasan untuk
                  dipakai ulang lintas kelas.
                </p>
              </div>
              <div className="pb-5 border-b border-stone-200">
                <p className="text-sm font-semibold text-slate-900">
                  02. Monitoring status &amp; pelanggaran
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Lihat siswa yang sedang mengerjakan, terputus, atau berpindah tab secara realtime,
                  lengkap dengan aksi paksa kirim.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  03. Analisis butir soal &amp; soal bermasalah
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Tinjau efektivitas pengecoh A–E, koreksi soal keliru dengan hitung ulang otomatis,
                  lalu ekspor rekap ke CSV.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Alur Siswa */}
      <section id="alur-siswa" className="bg-white border-y border-stone-200 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 grid lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-7 order-2 lg:order-1"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Fokus mengerjakan tanpa khawatir jawaban hilang
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed">
              Siswa bergabung ke kelas lewat kode 6 karakter, melihat jadwal ujian sesuai zona waktu
              guru (WIB, WITA, atau WIT), dan mengerjakan dengan antarmuka bebas gangguan di ponsel maupun laptop.
            </p>
            <div className="mt-8 grid sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-stone-50 border border-stone-200">
                <p className="text-sm font-semibold text-slate-900">Autosave &amp; Antrean Lokal</p>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Setiap pilihan tersimpan otomatis dan disinkronkan ulang jika koneksi sempat
                  terputus atau halaman dimuat ulang.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-stone-50 border border-stone-200">
                <p className="text-sm font-semibold text-slate-900">Aturan Transparan Sejak Awal</p>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Sebelum menekan Mulai, siswa melihat durasi, kebijakan pengawasan tab, serta
                  kapan nilai dan pembahasan dirilis.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="lg:col-span-5 order-1 lg:order-2"
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-stone-200 bg-stone-200">
              <Image
                src={studentFocusImg}
                alt="Siswa belajar fokus mengerjakan ujian online di meja kayu"
                fill
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Integritas & Keamanan */}
      <section id="integritas" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Dirancang menjaga kejujuran ujian dari sisi sistem
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-xl border border-stone-200">
            <Lock className="w-5 h-5 text-blue-700 mb-3" />
            <h3 className="text-base font-bold text-slate-900">Kunci Jawaban Terisolasi</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Dokumen soal dan kunci jawaban dipisahkan di database. Selama ujian berlangsung, kunci
              tidak pernah dikirim ke peramban siswa ataupun akun admin.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-stone-200">
            <Clock className="w-5 h-5 text-blue-700 mb-3" />
            <h3 className="text-base font-bold text-slate-900">Timer Otoritatif Server</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Waktu mulai dan tenggat pengumpulan mengikuti stempel waktu server, sehingga menutup
              tab atau mengubah jam perangkat tidak menghentikan timer.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-stone-200">
            <BarChart3 className="w-5 h-5 text-blue-700 mb-3" />
            <h3 className="text-base font-bold text-slate-900">Tata Kelola Admin &amp; Audit</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Persetujuan akun guru baru, penangguhan akun bermasalah, pengawasan lintas kelas, dan
              jejak audit admin tersimpan rapi tanpa bisa diubah.
            </p>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-slate-900 text-slate-300 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-lg font-bold text-white">UjianKu</p>
            <p className="text-xs text-slate-400 mt-1">
              Aplikasi Ujian Pilihan Ganda Sekolah · Mendukung WIB, WITA, dan WIT
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Link href="/login" className="hover:text-white transition-colors">
              Masuk
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              Daftar Akun
            </Link>
            <Link href="/forgot-password" className="hover:text-white transition-colors">
              Lupa Kata Sandi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
