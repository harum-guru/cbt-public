# PRD: Aplikasi Ujian Online

| | |
|---|---|
| **Nama produk (sementara)** | UjianKu |
| **Versi dokumen** | 1.4 |
| **Tanggal** | 24 November 2026 |
| **Tech stack** | Next.js (App Router, TypeScript), Firebase (Authentication, Firestore, Storage) |
| **Jenis soal yang didukung** | **Pilihan ganda saja** (satu jawaban benar) |

---

## 1. Ringkasan

UjianKu adalah aplikasi web ujian online yang memungkinkan **guru** mendaftar, membuat kelas, menyusun ujian pilihan ganda, mengatur jadwal serta aturan ujian, lalu memantau hasilnya. **Siswa** bergabung ke kelas guru mereka, mengerjakan ujian yang dipublikasikan, dan melihat hasilnya. Karena semua soal berupa pilihan ganda, **seluruh penilaian dilakukan otomatis** dan nilai siswa langsung tersedia begitu ujian dikirim.

### 1.1 Masalah yang diselesaikan
- Guru kesulitan membuat, membagikan, dan mengoreksi ujian secara manual atau lewat alat umum (form biasa) yang tidak punya kontrol waktu, pengacakan soal, dan rekap nilai.
- Siswa butuh tempat tunggal untuk melihat dan mengerjakan ujian dari gurunya.

### 1.2 Tujuan
1. Guru dapat membuat ujian lengkap (soal, jadwal, durasi, aturan) dalam kurang dari 10 menit untuk ujian 20 soal.
2. Siswa dapat mengerjakan ujian dengan stabil, termasuk saat koneksi putus sebentar (autosave).
3. Penilaian 100% otomatis, instan, dan akurat.
4. Kunci jawaban tidak pernah bocor ke sisi klien.

### 1.3 Bukan tujuan (v1)
- **Jenis soal selain pilihan ganda** (benar/salah, pilihan ganda kompleks, isian singkat, esai, menjodohkan, dll.). Tidak ada penilaian manual.
- Proctoring berbasis kamera/AI.
- Aplikasi mobile native (web responsif sudah cukup).
- Pembayaran/langganan.
- Multi-sekolah/multi-tenant: satu instalasi melayani satu organisasi, dan admin bersifat global (bukan admin per sekolah).
- Integrasi LMS (Google Classroom, Moodle).

---

## 2. Pengguna & Peran

| Peran | Deskripsi | Kemampuan utama |
|---|---|---|
| **Admin** | Tidak bisa mendaftar sendiri; akun pertama dibuat lewat skrip seed, akun berikutnya dibuat oleh admin lain | Mengelola pengguna (guru & siswa), menyetujui guru baru, menangguhkan akun, mengawasi semua kelas dan ujian, mengatur pengaturan platform, melihat audit log |
| **Guru** | Mendaftar mandiri (dapat memerlukan persetujuan admin) | Membuat kelas dan ujian; mengatur ujian; memantau; melihat rekap |
| **Siswa** | Mendaftar mandiri, lalu bergabung ke kelas lewat kode | Melihat ujian di kelasnya, mengerjakan, melihat hasil |

Satu akun hanya punya satu peran. Pada form registrasi publik hanya tersedia pilihan **Guru** dan **Siswa**; peran tidak bisa diubah sendiri oleh pengguna. Admin **tidak** membuat ujian, tidak mengerjakan ujian, dan tidak dapat membaca kunci jawaban (menjaga integritas ujian).

---

## 3. Alur Pengguna Utama

### 3.1 Guru
1. Daftar (email/password atau Google) dan pilih peran **Guru**. Jika pengaturan "persetujuan guru" aktif, akun berstatus *menunggu persetujuan* sampai admin menyetujui.
2. Buat **Kelas** (mis. "XI IPA 2") → sistem membuat **kode kelas** unik 6 karakter.
3. Bagikan kode kelas ke siswa.
4. Buat **Ujian**: isi info, tambah soal pilihan ganda, atur pengaturan, pilih kelas target.
5. **Publikasikan** ujian.
6. Pantau siswa yang sedang mengerjakan (live); nilai terhitung otomatis saat siswa mengirim.
7. Lihat rekap dan ekspor CSV.

### 3.2 Siswa
1. Daftar dan pilih peran **Siswa**.
2. Masukkan **kode kelas** untuk bergabung (bisa ke lebih dari satu kelas).
3. Lihat daftar ujian di dashboard (Akan datang / Sedang berlangsung / Selesai).
4. Buka ujian → halaman konfirmasi aturan → **Mulai**.
5. Kerjakan soal (timer berjalan, jawaban tersimpan otomatis) → **Kirim**.
6. Lihat hasil sesuai pengaturan guru.

### 3.3 Admin
1. Login memakai akun admin (dibuat lewat skrip seed atau oleh admin lain).
2. Buka dashboard untuk melihat ringkasan platform (jumlah guru, siswa, kelas, ujian berlangsung).
3. Tinjau daftar **guru menunggu persetujuan** → setujui atau tolak.
4. Kelola pengguna: cari, lihat detail, tangguhkan/aktifkan akun, kirim reset password.
5. Awasi kelas dan ujian seluruh platform (hanya-baca); bila ada ujian bermasalah, admin dapat menutup atau mengarsipkannya.
6. Atur pengaturan platform dan tinjau **audit log** tindakan admin.

---

## 4. Kebutuhan Fungsional

Prioritas: **P0** = wajib untuk rilis pertama, **P1** = sebaiknya ada, **P2** = nanti.

### 4.1 Autentikasi & Akun
| ID | Kebutuhan | Prioritas |
|---|---|---|
| AUTH-1 | Registrasi & login dengan email/password (Firebase Auth) | P0 |
| AUTH-2 | Login dengan Google | P1 |
| AUTH-3 | Saat registrasi pengguna memilih peran guru/siswa (peran admin tidak tersedia); peran disimpan di dokumen `users` dan sebagai **custom claim** (`admin` / `teacher` / `student`) yang hanya dapat diubah lewat Admin SDK | P0 |
| AUTH-7 | Status akun: `active`, `pending_approval` (guru baru), `suspended`. Akun `pending_approval` hanya melihat halaman "menunggu persetujuan"; akun `suspended` tidak dapat login dan sesinya dicabut | P0 |
| AUTH-4 | Verifikasi email dan reset password | P1 |
| AUTH-5 | Edit profil (nama, foto, NIS/nomor induk opsional untuk siswa) | P1 |
| AUTH-6 | Route guard berbasis peran dan status: `/admin` hanya admin, `/teacher` hanya guru aktif, `/student` hanya siswa aktif; pemeriksaan dilakukan di middleware **dan** di server/Security Rules | P0 |

### 4.2 Manajemen Kelas (Guru)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| CLS-1 | Guru membuat, mengubah, mengarsipkan kelas | P0 |
| CLS-2 | Kode kelas unik otomatis; guru bisa me-reset kode | P0 |
| CLS-3 | Guru melihat daftar siswa dan dapat mengeluarkan siswa | P0 |
| CLS-4 | Siswa bergabung via kode kelas; bisa keluar dari kelas | P0 |
| CLS-5 | Opsi "perlu persetujuan guru" saat siswa bergabung | P2 |

### 4.3 Pembuatan Soal (Guru) — Pilihan Ganda Saja
| ID | Kebutuhan | Prioritas |
|---|---|---|
| Q-1 | Satu-satunya jenis soal adalah **pilihan ganda dengan tepat satu jawaban benar**. Tidak ada pilihan jenis soal di UI | P0 |
| Q-2 | Jumlah opsi per soal: minimal 2, maksimal 5 (default 4: A–D). Validasi: semua opsi terisi dan tepat satu opsi ditandai benar | P0 |
| Q-3 | Setiap soal: teks (rich text sederhana: bold, italic, list), gambar opsional (Firebase Storage), bobot/poin (default 1), pembahasan opsional | P0 |
| Q-4 | Opsi jawaban boleh berisi teks dan/atau gambar | P1 |
| Q-5 | Urutkan ulang soal (drag & drop), duplikat, hapus | P0 |
| Q-6 | Dukungan rumus matematika (KaTeX) pada soal dan opsi | P1 |
| Q-7 | Bank soal pribadi guru yang dapat dipakai ulang di banyak ujian | P1 |
| Q-8 | Impor soal dari CSV/Excel (kolom: soal, opsi A–E, kunci, bobot, pembahasan) | P2 |

### 4.4 Pembuatan & Pengaturan Ujian (Guru)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| EX-1 | Info ujian: judul, deskripsi/instruksi, mata pelajaran | P0 |
| EX-2 | Pilih satu atau lebih kelas target | P0 |
| EX-3 | **Jadwal**: waktu buka dan waktu tutup (zona waktu Asia/Jakarta secara default) | P0 |
| EX-4 | **Durasi** pengerjaan (menit) sejak siswa menekan Mulai | P0 |
| EX-5 | Acak urutan soal; acak urutan opsi jawaban | P0 |
| EX-6 | Jumlah percobaan maksimal per siswa (default 1) | P0 |
| EX-7 | Nilai kelulusan (KKM) opsional | P1 |
| EX-8 | Kebijakan tampilan hasil: (a) skor dan kunci/pembahasan langsung setelah kirim, (b) hanya skor langsung, kunci/pembahasan setelah guru merilis, (c) semua setelah guru merilis | P0 |
| EX-9 | Pengaturan navigasi: boleh/tidak kembali ke soal sebelumnya; satu soal per halaman atau semua | P1 |
| EX-10 | Status ujian: **Draft → Dipublikasikan → Ditutup → Diarsipkan** | P0 |
| EX-11 | Ujian yang sudah ada pengerjaan siswa: soal tidak boleh diubah (hanya bisa duplikat ujian), kecuali penanganan soal bermasalah (GRD-4) | P0 |
| EX-12 | Duplikat ujian | P1 |
| EX-13 | Perpanjang waktu untuk siswa tertentu (kasus khusus) | P2 |
| EX-14 | Kode akses/password ujian opsional | P2 |

### 4.5 Pengerjaan Ujian (Siswa)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| TAKE-1 | Dashboard siswa menampilkan ujian dari kelas yang diikuti, dikelompokkan berdasarkan status | P0 |
| TAKE-2 | Halaman konfirmasi: instruksi, durasi, jumlah soal, aturan, lalu tombol Mulai | P0 |
| TAKE-3 | Saat Mulai, server mencatat `startedAt` dan menghitung `deadline = min(startedAt + durasi, waktu tutup ujian)`. **Timer otoritatif di server**, bukan di klien | P0 |
| TAKE-4 | Timer hitung mundur di UI; saat habis, jawaban dikirim otomatis | P0 |
| TAKE-5 | **Autosave** jawaban setiap kali siswa memilih opsi (debounce) dan ketahanan terhadap koneksi putus (antrean lokal + sinkron ulang) | P0 |
| TAKE-6 | Siswa dapat melanjutkan pengerjaan jika browser tertutup/refresh selama belum melewati deadline | P0 |
| TAKE-7 | Panel navigasi soal dengan penanda: terjawab, belum, ditandai ragu | P0 |
| TAKE-8 | Konfirmasi sebelum kirim, menampilkan jumlah soal yang belum dijawab | P0 |
| TAKE-9 | Setelah kirim tidak bisa diubah | P0 |
| TAKE-10 | Tampilan responsif (HP, tablet, laptop) | P0 |
| TAKE-11 | **Deteksi pindah tab/jendela**: halaman ujian mendeteksi tab tidak lagi terlihat (`visibilitychange`) dan jendela kehilangan fokus (`blur`), lalu mencatat event beserta waktu dan lama durasi pergi | P0 |
| TAKE-12 | **Deteksi tutup tab/browser dan koneksi terputus**: klien mengirim *heartbeat* berkala (mis. tiap 15 detik); event `beforeunload`/`pagehide` dicatat sebisanya, dan server menganggap siswa "terputus" bila heartbeat berhenti lebih dari 45 detik. Saat siswa kembali, dicatat event "kembali" beserta lama terputus | P0 |
| TAKE-13 | Opsional per ujian: wajib **layar penuh** (Fullscreen API); keluar dari layar penuh dicatat sebagai pelanggaran | P1 |
| TAKE-14 | Siswa melihat **peringatan** di layar saat pelanggaran terdeteksi ("Anda berpindah tab; aktivitas ini dicatat") dan diberi tahu aturan di halaman konfirmasi sebelum mulai | P0 |
| TAKE-15 | Opsional per ujian: **batas pelanggaran**; bila terlampaui, ujian otomatis dikirim (atau hanya ditandai untuk ditinjau guru, sesuai pilihan guru). Default: hanya mencatat dan menandai | P1 |
| TAKE-16 | Cegah kebiasaan curang ringan di halaman ujian: nonaktifkan klik kanan, salin-tempel pada area soal (dicatat sebagai event bila dicoba). Ini hanya penghalang, bukan jaminan | P1 |

### 4.6 Penilaian & Hasil (Otomatis Penuh)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| GRD-1 | Penilaian otomatis **di server** saat submit: jawaban benar mendapat poin soal tersebut, salah atau kosong mendapat 0 | P0 |
| GRD-2 | Skor akhir = total poin diperoleh / total poin × 100, dibulatkan 2 desimal. Tersedia seketika setelah submit | P0 |
| GRD-3 | Status lulus/tidak lulus jika KKM diatur | P1 |
| GRD-4 | Penanganan **soal bermasalah** (mis. kunci keliru): guru dapat memilih "beri poin ke semua siswa" atau "keluarkan dari penilaian", lalu sistem **menghitung ulang** semua attempt | P1 |
| GRD-5 | Guru merilis kunci/pembahasan sesuai kebijakan EX-8 | P0 |
| GRD-6 | Siswa melihat skor, status lulus/tidak, dan (jika diizinkan) jawabannya, kunci benar, dan pembahasan per soal | P0 |

### 4.7 Monitoring & Laporan (Guru)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| RPT-1 | **Monitoring ujian (live)**: halaman khusus guru yang menampilkan semua siswa di kelas target dengan status realtime: *belum mulai / sedang mengerjakan / terputus / selesai* | P0 |
| RPT-1a | Per siswa tampil: progres (jumlah soal terjawab / total), sisa waktu, waktu mulai, aktivitas terakhir (heartbeat), dan **jumlah pelanggaran** dengan penanda warna (hijau/kuning/merah sesuai ambang) | P0 |
| RPT-1b | Ringkasan di atas daftar: jumlah siswa belum mulai, sedang mengerjakan, terputus, selesai | P0 |
| RPT-1c | Guru dapat membuka **log aktivitas** siswa (pindah tab, kembali, terputus, keluar layar penuh) berurutan menurut waktu | P0 |
| RPT-1d | Aksi guru saat monitoring: **paksa kirim** (akhiri ujian siswa), dan **izinkan mulai ulang/lanjut** bagi siswa yang bermasalah teknis (dicatat sebagai tindakan guru) | P1 |
| RPT-1e | Pencarian dan filter daftar siswa (nama, status, pelanggaran) | P1 |
| RPT-2 | Rekap nilai per ujian: tabel siswa (nama, NIS bila diisi), skor, waktu pengerjaan, jumlah pelanggaran | P0 |
| RPT-3 | Statistik: rata-rata, tertinggi, terendah, persentase lulus | P1 |
| RPT-4 | Analisis butir soal: persentase siswa yang menjawab benar per soal dan distribusi pilihan jawaban (efektivitas pengecoh) | P1 |
| RPT-5 | Ekspor rekap ke CSV | P1 |
| RPT-6 | Rekap pelanggaran per ujian: siswa dengan pelanggaran terbanyak dan ekspor log aktivitas ke CSV | P1 |
| RPT-7 | Guru melihat jawaban per siswa (jawaban dipilih vs kunci) | P1 |

### 4.8 Notifikasi
| ID | Kebutuhan | Prioritas |
|---|---|---|
| NTF-1 | Notifikasi in-app: ujian baru dipublikasikan, kunci/pembahasan dirilis | P1 |
| NTF-2 | Email pengingat sebelum ujian dimulai | P2 |
| NTF-3 | Notifikasi ke guru saat akun disetujui/ditolak admin | P1 |

### 4.9 Administrasi (Admin)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| ADM-1 | **Dashboard admin**: total guru, siswa, kelas, ujian; ujian yang sedang berlangsung; guru menunggu persetujuan | P0 |
| ADM-2 | **Daftar pengguna**: cari (nama/email), filter (peran, status), lihat detail (kelas, ujian, aktivitas terakhir) | P0 |
| ADM-3 | **Tangguhkan/aktifkan akun** guru atau siswa. Saat ditangguhkan: login diblokir, token dicabut (`revokeRefreshTokens`), attempt siswa yang sedang `in_progress` dikirim otomatis dengan jawaban tersimpan | P0 |
| ADM-4 | **Persetujuan guru baru**: daftar guru `pending_approval` dengan aksi setujui/tolak (disertai alasan). Dapat dinyalakan/dimatikan lewat pengaturan platform | P0 |
| ADM-5 | Akun admin pertama dibuat lewat **skrip seed** (Admin SDK); admin tidak bisa mendaftar lewat form publik | P0 |
| ADM-6 | Admin membuat/menghapus akun admin lain (tidak dapat menghapus dirinya sendiri; minimal selalu ada 1 admin aktif) | P1 |
| ADM-7 | Kirim email **reset password** ke pengguna | P1 |
| ADM-8 | **Pengawasan** semua kelas dan ujian (hanya-baca): detail ujian, jumlah peserta, status, dan halaman monitoring live. Kunci jawaban **tidak** dapat dibaca admin | P1 |
| ADM-9 | **Intervensi ujian**: tutup/arsipkan ujian bermasalah dan pindahkan kepemilikan kelas ke guru lain (misal guru berhenti) | P1 |
| ADM-10 | Ubah peran pengguna (siswa ↔ guru) bila salah memilih saat registrasi | P1 |
| ADM-11 | **Audit log**: setiap tindakan admin (setujui/tolak, tangguhkan, ubah peran, intervensi ujian) dicatat dengan pelaku, target, waktu, dan alasan; log tidak dapat diubah | P1 |
| ADM-12 | **Pengaturan platform**: persetujuan guru (default aktif), buka/tutup registrasi siswa, batas ukuran upload gambar, zona waktu default | P1 |
| ADM-13 | Hapus akun permanen (soft delete dengan anonimisasi data pribadi; data ujian/nilai tetap dipertahankan) | P2 |

---

## 5. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| **Keamanan** | Kunci jawaban tidak pernah dikirim ke klien selama ujian; penilaian di server; Firestore Security Rules ketat berbasis peran dan kepemilikan; validasi input di server (Zod); rate-limit pada endpoint submit/join |
| **Integritas waktu** | Seluruh keputusan waktu (mulai, deadline, tolak submit terlambat) memakai `serverTimestamp` |
| **Kinerja** | Halaman ujian dimuat < 2 detik pada 4G; mendukung minimal **300 siswa serentak** per ujian pada v1 |
| **Ketersediaan** | Autosave dan pemulihan sesi saat koneksi putus; pesan jelas saat offline |
| **Responsif & aksesibilitas** | Mobile-first; kontras warna memadai; navigasi keyboard untuk halaman ujian |
| **Privasi** | Siswa hanya melihat data miliknya sendiri; guru hanya melihat siswa di kelasnya |
| **Lokalisasi** | Bahasa Indonesia (UI), zona waktu default Asia/Jakarta (WIB); struktur teks siap i18n |
| **Observability** | Error tracking (mis. Sentry) dan log server untuk submit/penilaian |

---

## 6. Arsitektur Teknis

### 6.1 Stack
- **Frontend/Backend**: Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui.
- **Auth**: Firebase Authentication (+ custom claims untuk peran).
- **Database**: Cloud Firestore.
- **File**: Firebase Storage (gambar soal/opsi, foto profil).
- **Server-side**: Next.js Route Handlers / Server Actions memakai **Firebase Admin SDK** untuk operasi sensitif.
- **Form & validasi**: React Hook Form + Zod.
- **State/data klien**: Firebase Web SDK (listener realtime untuk monitoring), TanStack Query bila perlu.
- **Hosting**: Vercel atau Firebase App Hosting.

### 6.2 Prinsip kunci: pemisahan kunci jawaban
Soal yang dilihat siswa tidak boleh memuat kunci jawaban. Karena itu data soal dipisah:

- `questions` → konten yang aman dibaca siswa (teks, opsi, bobot).
- `answerKeys` → opsi yang benar & pembahasan; **hanya bisa dibaca guru pemilik** dan Admin SDK.

Operasi yang **wajib lewat server (Admin SDK)**:
1. **Start attempt**: validasi jadwal, kuota percobaan, keanggotaan kelas; buat `attempt` dengan `startedAt` & `deadline`; kembalikan soal (sudah diacak sesuai pengaturan, tanpa kunci).
2. **Submit attempt**: validasi belum lewat deadline (+ toleransi kecil, mis. 10 detik); baca `answerKeys`; hitung skor; simpan hasil.
3. **Release results**: ubah status rilis dan buka akses kunci/pembahasan sesuai kebijakan.
4. **Regrade**: hitung ulang semua attempt saat guru menangani soal bermasalah.
5. **Join class**: validasi kode kelas.

Autosave jawaban boleh langsung dari klien ke dokumen `attempts/{id}` miliknya, dengan Security Rules yang menolak penulisan setelah `submitted` atau lewat deadline serta melarang perubahan field skor.

### 6.3 Model Data Firestore

```
users/{uid}
  role: "admin" | "teacher" | "student"
  status: "active" | "pending_approval" | "suspended"
  displayName, email, photoURL
  studentNumber?                             // NIS opsional, tidak diverifikasi
  approvedBy?, approvedAt?, suspendedReason?
  createdAt, lastLoginAt

platformSettings/main                        // hanya admin yang menulis
  requireTeacherApproval: boolean            // default true
  studentRegistrationOpen: boolean           // default true
  maxUploadSizeMB: number
  defaultTimezone: "Asia/Jakarta"

auditLogs/{logId}                            // append-only, dibuat oleh server
  actorId, actorEmail
  action: "approve_teacher" | "reject_teacher" | "suspend_user" | "activate_user"
        | "change_role" | "create_admin" | "close_exam" | "transfer_class" | ...
  targetType: "user" | "class" | "exam"
  targetId
  reason?, meta?
  at: Timestamp (server)

classes/{classId}
  teacherId
  name, description
  joinCode            // unik, 6 karakter
  isArchived
  memberCount
  createdAt

classes/{classId}/members/{studentUid}
  displayName, email
  joinedAt

exams/{examId}
  teacherId
  title, description, subject
  classIds: string[]
  status: "draft" | "published" | "closed" | "archived"
  settings: {
    opensAt, closesAt            // Timestamp
    durationMinutes
    shuffleQuestions, shuffleOptions
    maxAttempts
    passingScore?                // 0-100
    resultsPolicy: "answers_immediate" | "score_immediate" | "after_release"
    allowBackNavigation
    proctoring: {
      detectTabSwitch: boolean         // default true
      requireFullscreen: boolean       // default false
      blockCopyPaste: boolean          // default true
      violationLimit?: number          // ambang peringatan/aksi
      onLimitReached: "flag_only" | "auto_submit"   // default flag_only
    }
  }
  totalPoints, questionCount
  resultsReleased: boolean
  createdAt, updatedAt

exams/{examId}/questions/{questionId}        // aman dibaca siswa saat ujian berlangsung
  order
  text, imageURL?
  options: [{ id, text, imageURL? }]          // 2-5 opsi
  points                                      // default 1
  voided?: "all_correct" | "excluded"         // diisi saat soal bermasalah (GRD-4)

exams/{examId}/answerKeys/{questionId}       // hanya guru + Admin SDK
  correctOptionId: string                     // tepat satu
  explanation?

exams/{examId}/attempts/{attemptId}
  studentId, classId
  attemptNumber
  status: "in_progress" | "submitted"
  startedAt, deadline, submittedAt?
  questionOrder: string[]                    // urutan soal yang diacak
  optionOrder: { [questionId]: string[] }    // urutan opsi yang diacak
  answers: { [questionId]: { optionId, flagged, updatedAt } }
  answeredCount: number                      // untuk progres di monitoring
  violations: number                         // counter ringkas
  presence: "online" | "disconnected"        // diperbarui server dari heartbeat
  lastHeartbeatAt: Timestamp
  flaggedForReview: boolean
  score?, maxScore?, percentage?, passed?    // hanya ditulis server
  correctCount?
  resultReleased: boolean
  gradedAt?

exams/{examId}/attempts/{attemptId}/events/{eventId}   // log aktivitas, append-only
  type: "tab_hidden" | "tab_visible" | "window_blur" | "window_focus"
      | "fullscreen_exit" | "page_unload" | "disconnected" | "reconnected"
      | "copy_attempt" | "paste_attempt" | "teacher_action"
  at: Timestamp (server)
  durationAwayMs?                            // lama pergi/terputus
  meta?                                      // info tambahan ringan

notifications/{userId}/items/{id}            // P1
questionBank/{questionId}                    // P1: bank soal pribadi guru
  teacherId, text, options, correctOptionId, explanation, tags
```

**Indeks komposit yang dibutuhkan** (awal): `exams` by `classIds` array-contains + `status` + `opensAt`; `attempts` by `studentId` + `examId`.

### 6.4 Ringkasan Security Rules
- `users/{uid}`: pemilik dapat membaca dan mengubah profilnya (nama, foto) saja; field `role` dan `status` **tidak dapat diubah klien**. Saat dokumen dibuat, role hanya boleh `teacher`/`student` dan status awal ditentukan server. Admin dapat membaca semua pengguna; perubahan role/status dilakukan lewat server (Admin SDK).
- **Admin**: dikenali dari custom claim `role == "admin"`. Dapat membaca `users`, `classes`, `exams`, `attempts`, dan `events` (untuk pengawasan), tetapi **tidak dapat membaca `answerKeys`** dan tidak dapat menulis langsung ke koleksi ujian dari klien; tindakan intervensi lewat server dan selalu menulis ke `auditLogs`.
- `platformSettings`: baca oleh semua pengguna terautentikasi (field yang diperlukan, mis. registrasi terbuka), tulis hanya admin. `auditLogs`: baca hanya admin, tulis hanya server.
- Semua aturan guru/siswa di bawah hanya berlaku jika `status == "active"`.
- `classes`: tulis hanya guru pemilik; siswa hanya membaca kelas yang diikutinya.
- `exams` & `questions`: tulis hanya guru pemilik dan hanya saat `draft` (soal terkunci setelah ada attempt); baca siswa hanya jika anggota kelas target dan ujian berstatus `published`.
- `answerKeys`: baca/tulis hanya guru pemilik.
- `attempts`: siswa hanya membaca/menulis attempt miliknya; penulisan `answers` hanya saat `in_progress` dan sebelum `deadline`; field skor, `status` submitted, `violations`, `presence`, dan `flaggedForReview` tidak dapat ditulis siswa; guru pemilik ujian dapat membaca semua attempt ujiannya (termasuk untuk monitoring realtime).
- `events`: siswa hanya dapat **menambah** (create) event untuk attempt miliknya yang masih `in_progress`; tidak bisa mengubah atau menghapus. Guru pemilik ujian dapat membaca. Counter `violations` diperbarui oleh server (Cloud Function/Route Handler), bukan klien.

### 6.5 Mekanisme Monitoring & Deteksi
- **Pencatatan event**: klien mengirim event ke endpoint server (`POST /api/attempts/{id}/events`), server menambahkan timestamp, menyimpan ke `events`, dan menaikkan `violations` bila event termasuk pelanggaran. Dengan begitu siswa tidak dapat memalsukan waktu atau menghapus log.
- **Heartbeat**: klien mengirim heartbeat tiap ±15 detik ke server yang memperbarui `lastHeartbeatAt`. Status `disconnected` ditentukan dari selisih `lastHeartbeatAt` dan waktu sekarang (dihitung saat guru memantau atau lewat job terjadwal), bukan bergantung pada event penutupan tab saja.
- **Batasan teknis yang diakui**: browser tidak menjamin event `beforeunload`/`pagehide` terkirim saat tab ditutup paksa atau baterai habis (khususnya di HP). Karena itu deteksi "tutup tab" mengandalkan **heartbeat berhenti**, dan event unload hanya pelengkap (`navigator.sendBeacon`).
- **Realtime untuk guru**: halaman monitor memakai listener Firestore pada koleksi `attempts` ujian terkait; `answeredCount`, `violations`, dan `lastHeartbeatAt` diperbarui ringan (hindari menulis tiap detik untuk menekan biaya).
- **Pelanggaran bukan bukti mutlak**: pindah tab bisa terjadi karena notifikasi HP, panggilan masuk, dsb. Karena itu default sistem hanya **mencatat dan menandai**; keputusan akhir ada pada guru.

---

## 7. Peta Halaman (Routes)

**Publik**
- `/` Landing page
- `/login`, `/register`, `/forgot-password`

**Umum (terautentikasi)**
- `/pending-approval` (guru menunggu persetujuan), `/suspended` (akun ditangguhkan)

**Admin** (`/admin/...`)
- `/admin` Dashboard (ringkasan platform)
- `/admin/users`, `/admin/users/[uid]` (daftar, detail, tangguhkan/aktifkan, ubah peran)
- `/admin/teachers/pending` (persetujuan guru baru)
- `/admin/classes`, `/admin/exams`, `/admin/exams/[examId]` (pengawasan hanya-baca, monitoring live, tutup/arsipkan)
- `/admin/admins` (kelola akun admin, P1)
- `/admin/audit-logs`
- `/admin/settings`

**Guru** (`/teacher/...`)
- `/teacher` Dashboard (ujian aktif, ringkasan)
- `/teacher/classes`, `/teacher/classes/[classId]` (siswa, kode kelas)
- `/teacher/exams`, `/teacher/exams/new`
- `/teacher/exams/[examId]/edit` (info, soal, pengaturan, publikasi)
- `/teacher/exams/[examId]/monitor` (monitoring live: status siswa, progres, sisa waktu, pelanggaran)
- `/teacher/exams/[examId]/monitor/[attemptId]` (log aktivitas satu siswa)
- `/teacher/exams/[examId]/results` (rekap, statistik, analisis butir soal, ekspor)
- `/teacher/exams/[examId]/results/[attemptId]` (jawaban per siswa, P1)
- `/teacher/question-bank` (P1)
- `/profile`

**Siswa** (`/student/...`)
- `/student` Dashboard (ujian mendatang/berlangsung/selesai)
- `/student/classes` + form gabung kelas
- `/student/exams/[examId]` (konfirmasi & instruksi)
- `/student/exams/[examId]/take` (halaman pengerjaan)
- `/student/exams/[examId]/result` (hasil)
- `/profile`

---

## 8. Aturan Bisnis Penting

1. Ujian hanya dapat dikerjakan jika `status = published`, waktu sekarang berada di antara `opensAt` dan `closesAt`, siswa anggota salah satu kelas target, dan percobaan belum melebihi `maxAttempts`.
2. `deadline` = yang lebih awal antara `startedAt + durasi` dan `closesAt`.
3. Submit setelah `deadline` ditolak; namun jawaban yang sudah ter-autosave sebelum deadline tetap dinilai (sistem melakukan auto-submit dari data tersimpan).
4. Soal yang tidak dijawab bernilai 0 (tidak ada pengurangan poin untuk jawaban salah).
5. Jika ada beberapa percobaan, nilai yang dipakai = **nilai tertinggi** (default; dapat diubah guru: tertinggi / terakhir).
6. Soal ujian tidak dapat diedit setelah ada attempt; untuk perubahan, guru menduplikat ujian. Satu-satunya pengecualian adalah penanganan soal bermasalah (GRD-4) yang memicu hitung ulang.
7. Menghapus kelas/ujian yang sudah memiliki attempt bersifat **arsip** (soft delete), bukan hapus permanen.
8. Ujian wajib memiliki minimal 1 soal yang valid sebelum dapat dipublikasikan.
9. **Timer tidak berhenti** saat siswa pindah tab, tertutup, atau terputus; waktu tetap berjalan berdasarkan `deadline` server.
10. Pelanggaran dihitung per event "pergi" (`tab_hidden`, `window_blur` yang bukan akibat `tab_hidden` yang sama, `fullscreen_exit`); event berurutan yang terjadi dalam 1 detik dihitung satu pelanggaran agar tidak dobel.
11. Jika `onLimitReached = auto_submit` dan batas terlampaui, server mengirim ujian dengan jawaban yang sudah tersimpan dan mencatat alasannya di log.
12. Guru wajib diberi tahu bahwa data pelanggaran bersifat indikatif; aturan pemantauan harus tampil jelas kepada siswa sebelum ujian dimulai (TAKE-14).
13. Guru berstatus `pending_approval` tidak dapat membuat kelas/ujian; guru yang ditangguhkan tidak dapat login, tetapi ujian dan kelasnya tetap ada dan dapat dipindahkan admin ke guru lain.
14. Jika pengaturan persetujuan guru dimatikan, guru baru langsung berstatus `active`. Mengubah pengaturan ini tidak memengaruhi guru yang sudah ada.
15. Admin tidak dapat menangguhkan atau menghapus dirinya sendiri, dan sistem selalu menyisakan minimal satu admin aktif.
16. Setiap tindakan admin yang mengubah data pengguna, kelas, atau ujian wajib tercatat di `auditLogs`.

---

## 9. Pelacakan Keberhasilan (Metrik)

| Metrik | Target awal |
|---|---|
| Guru yang membuat ujian pertama dalam 24 jam setelah mendaftar | ≥ 50% |
| Waktu pembuatan ujian 20 soal | < 10 menit |
| Attempt yang selesai tanpa kehilangan jawaban | ≥ 99% |
| Error submit/penilaian | < 0,5% |
| Kunci jawaban bocor ke klien | 0 kejadian |

---

## 10. Rencana Rilis (Milestone)

| Fase | Cakupan | Estimasi |
|---|---|---|
| **M0 – Fondasi** | Setup Next.js + Firebase, auth, peran, route guard, layout dasar, Security Rules awal | 1 minggu |
| **M1 – Kelas** | CRUD kelas, kode kelas, gabung kelas | 1 minggu |
| **M1b – Admin dasar** | Skrip seed admin, custom claims 3 peran, status akun, dashboard admin, daftar pengguna, persetujuan guru, tangguhkan/aktifkan, pengaturan platform inti | 1 minggu |
| **M2 – Pembuatan ujian** | Editor soal pilihan ganda, pengaturan ujian, publikasi, pemisahan `answerKeys` | 1–2 minggu |
| **M3 – Pengerjaan & penilaian** | Start/submit server-side, timer, autosave, pemulihan sesi, penilaian otomatis, halaman hasil siswa | 2 minggu |
| **M4 – Deteksi & monitoring** | Deteksi pindah/tutup tab, heartbeat, log event, peringatan ke siswa, halaman monitoring live untuk guru, log aktivitas per siswa | 1–2 minggu |
| **M5 – Laporan** | Rekap, ekspor CSV, rilis kunci/pembahasan | 1 minggu |
| **M6 – Penyempurnaan (P1)** | Admin lanjutan (pengawasan ujian, intervensi, audit log, kelola admin), layar penuh wajib, batas pelanggaran + auto-submit, aksi guru (paksa kirim/izinkan lanjut), KaTeX, gambar pada opsi, bank soal, statistik & analisis butir soal, penanganan soal bermasalah, notifikasi | 2 minggu |
| **M7 – Hardening** | Uji beban 300 siswa serentak, audit rules, aksesibilitas, monitoring error | 1 minggu |

---

## 11. Asumsi yang Diambil

Hal-hal berikut diputuskan tanpa konfirmasi; mudah diubah jika tidak sesuai:

1. **Hanya pilihan ganda dengan satu jawaban benar**, 2–5 opsi per soal. Bobot poin per soal dapat diatur (default 1).
2. **Hubungan guru–siswa lewat kelas dengan kode gabung** (bukan lewat undangan email atau kode per ujian).
3. **Pendaftaran siswa mandiri** (guru tidak membuatkan akun siswa).
4. Satu akun = satu peran.
5. Bahasa UI Bahasa Indonesia, zona waktu WIB.
6. Pelanggaran (pindah/tutup tab) secara default hanya **dicatat dan ditandai**, tidak otomatis menggugurkan ujian; guru dapat mengaktifkan auto-submit dengan batas pelanggaran.
7. Tidak ada pengurangan nilai untuk jawaban salah; percobaan ganda → nilai tertinggi yang dipakai.
8. Skala awal ≤ 300 siswa serentak per ujian dan satu sekolah/organisasi (tanpa multi-tenant).
9. UI memakai Tailwind + shadcn/ui.
10. **Tiga peran: admin, guru, siswa.** Admin bersifat global untuk satu instalasi (bukan admin per sekolah), tidak bisa mendaftar sendiri, dan tidak membuat/mengerjakan ujian.
11. **Persetujuan guru baru oleh admin aktif secara default** (dapat dimatikan), agar tidak sembarang orang bisa memakai peran guru. Registrasi siswa tetap terbuka.
12. Admin dapat melihat (hanya-baca) semua kelas, ujian, dan monitoring, tetapi **tidak dapat membaca kunci jawaban**.

## 12. Keputusan atas Pertanyaan Terbuka

Semua pertanyaan terbuka sebelumnya sudah diputuskan dengan pilihan yang paling sederhana:

1. **Verifikasi identitas siswa → tidak ada verifikasi.** Siswa cukup mendaftar dengan nama dan email. Tersedia kolom **NIS/nomor induk opsional** di profil, hanya untuk memudahkan guru mencocokkan siswa di rekap nilai (tidak divalidasi). Kontrol akses cukup lewat kode kelas, dan guru dapat mengeluarkan siswa yang tidak dikenal.
2. **Multi-sekolah → tidak didukung.** Satu instalasi melayani satu organisasi dengan satu admin global. Tidak ada `schoolId` pada model data. Jika kebutuhan ini muncul kelak, ditangani sebagai proyek terpisah.
3. **Skala dan biaya → target v1: hingga 1.000 pengguna terdaftar dan 300 siswa mengerjakan ujian serentak.** Memakai **Firebase Blaze plan** (bayar sesuai pemakaian) dengan *budget alert*, karena kuota gratis Spark tidak cukup (heartbeat 300 siswa saja sudah puluhan ribu penulisan per jam ujian, sementara batas gratis Firestore 20.000 penulisan per hari). Untuk skala ini biaya diperkirakan kecil, dan angka pastinya diverifikasi saat uji beban di fase hardening (M7).

Tidak ada pertanyaan terbuka yang tersisa.

---

## 13. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kunci jawaban bocor lewat klien | Ujian tidak valid | Pisah `answerKeys`, penilaian server, Security Rules ketat |
| Siswa memanipulasi timer di klien | Waktu tidak adil | Deadline otoritatif di server |
| Koneksi siswa putus saat ujian | Jawaban hilang | Autosave + antrean lokal + pemulihan sesi |
| Lonjakan penulisan saat ujian serentak | Biaya/limit Firestore | Debounce autosave, satu dokumen attempt per siswa, uji beban |
| Kecurangan (kerja sama, buka tab lain) | Integritas nilai | Acak soal/opsi, deteksi pindah/tutup tab, monitoring live, jadwal ketat; proctoring kamera di luar cakupan v1 |
| Deteksi tab tidak 100% andal (terutama di HP/browser tertentu) | Salah tuduh atau pelanggaran terlewat | Andalkan heartbeat server, tampilkan data sebagai indikator bukan vonis, keputusan di tangan guru |
| Biaya penulisan Firestore dari heartbeat & event saat ujian serentak | Biaya/limit | Heartbeat ≥ 15 detik, tulis ringkasan (bukan tiap detik), batasi/gabungkan event beruntun, uji beban 300 siswa |
| Kunci jawaban salah ditemukan setelah ujian berjalan | Nilai tidak adil | Fitur penanganan soal bermasalah + hitung ulang (GRD-4) |
| Biaya Firebase membengkak | Anggaran | Batasi listener realtime, indeks tepat, pantau penggunaan |
| Akun admin diambil alih | Seluruh data pengguna terekspos | Wajib verifikasi email, disarankan MFA untuk admin, admin hanya dibuat lewat server, semua tindakan tercatat di audit log |
| Pengguna menaikkan perannya sendiri (mis. jadi admin/guru aktif) | Pelanggaran akses | Role & status hanya lewat custom claims/Admin SDK, Security Rules menolak perubahan dari klien |
