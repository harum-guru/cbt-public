'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { firebaseUser, profile, loading, needsProfileSetup, isAdmin, signInWithGoogle, signInWithEmail } =
    useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser) {
      if (needsProfileSetup) {
        router.replace('/register');
        return;
      }
      if (profile?.status === 'pending_approval') {
        router.replace('/pending-approval');
        return;
      }
      if (profile?.status === 'suspended') {
        router.replace('/suspended');
        return;
      }
      if (isAdmin) {
        router.replace('/admin');
      } else if (profile?.role === 'teacher') {
        router.replace('/teacher');
      } else if (profile?.role === 'student') {
        router.replace('/student');
      }
    }
  }, [loading, firebaseUser, profile, needsProfileSetup, isAdmin, router]);

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Provider Email/Password belum diaktifkan di Firebase Console (Authentication -> Sign-in method). Gunakan tombol Masuk dengan Google atau aktifkan Email/Password terlebih dahulu.'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Email atau kata sandi tidak cocok.');
      } else {
        setError(err instanceof Error ? err.message : 'Gagal masuk.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
            UjianKu
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Masuk ke Akun Anda</h1>
          <p className="text-sm text-slate-600 mt-1">
            Masuk sebagai Guru, Siswa, atau Administrator sekolah.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogle}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Masuk dengan Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs text-slate-500">atau masuk dengan email</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Kata Sandi</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-700 hover:underline font-medium"
                >
                  Lupa kata sandi?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Masuk dengan Email
            </button>
          </form>

          <p className="text-xs text-center text-slate-600 pt-2 border-t border-stone-100">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-700 font-semibold hover:underline">
              Daftar sebagai Guru atau Siswa
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
