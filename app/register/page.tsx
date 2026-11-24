'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, MailCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { normalizeTimezone, TIMEZONE_OPTIONS } from '@/lib/time';
import type { IndonesianTimezone } from '@/lib/types';

export default function RegisterPage() {
  const {
    firebaseUser,
    profile,
    loading,
    isAdmin,
    platformSettings,
    signInWithGoogle,
    registerWithEmail,
    createUserProfile,
    refreshProfile,
    resendVerificationEmail,
    signOut,
  } = useAuth();
  const router = useRouter();

  const [roleDraft, setRoleDraft] = useState<'student' | 'teacher' | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [studentNumberDraft, setStudentNumberDraft] = useState<string | null>(null);
  const [schoolNameDraft, setSchoolNameDraft] = useState<string | null>(null);
  const [timezoneDraft, setTimezoneDraft] = useState<IndonesianTimezone | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const savedDraft = (() => {
    if (!firebaseUser || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(`ujianku_reg_${firebaseUser.uid}`);
      return raw ? (JSON.parse(raw) as { role?: 'student' | 'teacher'; displayName?: string; studentNumber?: string; schoolName?: string; timezone?: IndonesianTimezone }) : null;
    } catch {
      return null;
    }
  })();

  const role = roleDraft ?? (savedDraft?.role === 'teacher' || savedDraft?.role === 'student' ? savedDraft.role : 'student');
  const displayName = displayNameDraft ?? (savedDraft?.displayName || firebaseUser?.displayName || '');
  const studentNumber = studentNumberDraft ?? (savedDraft?.studentNumber || '');
  const schoolName = schoolNameDraft ?? (savedDraft?.schoolName || '');
  const timezone: IndonesianTimezone = timezoneDraft ?? normalizeTimezone(savedDraft?.timezone);
  const setRole = (v: 'student' | 'teacher') => setRoleDraft(v);
  const setDisplayName = (v: string) => setDisplayNameDraft(v);
  const setStudentNumber = (v: string) => setStudentNumberDraft(v);
  const setSchoolName = (v: string) => setSchoolNameDraft(v);
  const setTimezone = (v: IndonesianTimezone) => setTimezoneDraft(v);

  useEffect(() => {
    if (loading || !firebaseUser) return;
    if (profile) {
      if (profile.status === 'pending_approval') {
        router.replace('/pending-approval');
      } else if (profile.status === 'suspended') {
        router.replace('/suspended');
      } else if (isAdmin) {
        router.replace('/admin');
      } else if (profile.role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/student');
      }
    }
  }, [loading, firebaseUser, profile, isAdmin, router]);

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await createUserProfile({
        role,
        displayName: displayName || firebaseUser?.displayName || 'Pengguna',
        studentNumber,
        schoolName,
        timezone,
      });
      if (typeof window !== 'undefined' && firebaseUser) {
        window.localStorage.removeItem(`ujianku_reg_${firebaseUser.uid}`);
      }
      if (created.status === 'pending_approval') {
        router.replace('/pending-approval');
      } else if (created.role === 'teacher') {
        router.replace('/teacher');
      } else {
        router.replace('/student');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyelesaikan pendaftaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    setSubmitting(true);
    try {
      await registerWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        studentNumber,
        schoolName,
        timezone,
      });
      setInfo('Tautan verifikasi telah dikirim ke email Anda.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Registrasi Email/Password belum diaktifkan di Firebase Console. Silakan daftar langsung menggunakan tombol Google di bawah ini.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan masuk melalui halaman Login.');
      } else {
        setError(err instanceof Error ? err.message : 'Gagal mendaftar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal terhubung ke Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const studentRegClosed = platformSettings && !platformSettings.studentRegistrationOpen;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-lg w-full mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
            UjianKu
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">
            {firebaseUser ? 'Lengkapi Profil & Peran' : 'Daftar Akun Baru'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pilih peran sebagai Guru atau Siswa. Peran Admin hanya dibuat melalui pengelola sistem.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Case 1: Logged in with unverified email */}
          {firebaseUser && !firebaseUser.emailVerified ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-3">
                <MailCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Verifikasi Email Diperlukan</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Kami telah mengirim tautan verifikasi ke <strong>{firebaseUser.email}</strong>.
                    Buka kotak masuk Anda, klik tautannya, lalu tekan tombol di bawah ini.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={refreshProfile}
                  className="px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
                >
                  Saya Sudah Verifikasi
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail();
                    setInfo('Email verifikasi dikirim ulang.');
                  }}
                  className="px-4 py-2.5 rounded-lg border border-stone-300 text-slate-700 text-sm font-semibold hover:bg-stone-50"
                >
                  Kirim Ulang Tautan
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-900"
                >
                  Ganti Akun
                </button>
              </div>
            </div>
          ) : firebaseUser && firebaseUser.emailVerified ? (
            /* Case 2: Signed in & verified, needs role selection */
            <form onSubmit={handleCompleteProfile} className="space-y-5">
              <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-200 text-xs text-slate-600">
                Masuk sebagai <strong className="text-slate-900">{firebaseUser.email}</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Pilih Peran Anda
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={Boolean(studentRegClosed)}
                    onClick={() => setRole('student')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      role === 'student'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-stone-200 hover:border-stone-300'
                    } disabled:opacity-40`}
                  >
                    <p className="text-sm font-bold text-slate-900">Siswa</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {studentRegClosed ? 'Registrasi siswa ditutup' : 'Gabung kelas & ikut ujian'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      role === 'teacher'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Guru</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Buat kelas, soal, &amp; nilai
                    </p>
                  </button>
                </div>
                {role === 'teacher' && platformSettings?.requireTeacherApproval !== false && (
                  <p className="text-xs text-amber-700 mt-2">
                    Akun guru baru menunggu persetujuan admin sebelum dapat membuat kelas dan ujian.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Contoh: Nadia Kusuma"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              {role === 'student' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    NIS / Nomor Induk (Opsional)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    placeholder="Contoh: 202611045"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Asal Sekolah / Instansi
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Contoh: SMA Negeri 1 Bandung"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Zona Waktu Sekolah / Guru
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value as IndonesianTimezone)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    >
                      {TIMEZONE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  Simpan &amp; Lanjutkan
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-900"
                >
                  Keluar
                </button>
              </div>
            </form>
          ) : (
            /* Case 3: Not signed in yet */
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Saya mendaftar sebagai
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={Boolean(studentRegClosed)}
                    onClick={() => setRole('student')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      role === 'student'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Siswa</p>
                    <p className="text-xs text-slate-600 mt-0.5">Gabung kelas &amp; ujian</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      role === 'teacher'
                        ? 'border-blue-700 bg-blue-50/70'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Guru</p>
                    <p className="text-xs text-slate-600 mt-0.5">Susun &amp; pantau ujian</p>
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleRegister}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                Daftar Cepat dengan Google
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-xs text-slate-500">atau isi formulir email</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              <form onSubmit={handleEmailRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>

                {role === 'student' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      NIS / Nomor Induk (Opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      value={studentNumber}
                      onChange={(e) => setStudentNumber(e.target.value)}
                      placeholder="Contoh: 202611045"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Asal Sekolah / Instansi
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={150}
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="Contoh: SMA Negeri 1 Bandung"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Zona Waktu Sekolah / Guru
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value as IndonesianTimezone)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                      >
                        {TIMEZONE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alamat Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@sekolah.sch.id"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kata Sandi (min. 6 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  Daftar dengan Email
                </button>
              </form>

              <p className="text-xs text-center text-slate-600 pt-2 border-t border-stone-100">
                Sudah punya akun?{' '}
                <Link href="/login" className="text-blue-700 font-semibold hover:underline">
                  Masuk di sini
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
