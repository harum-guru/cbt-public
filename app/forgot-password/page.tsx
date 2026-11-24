'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function ForgotPasswordPage() {
  const { sendResetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendResetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
          UjianKu
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-4">Atur Ulang Kata Sandi</h1>
        <p className="text-sm text-slate-600 mt-1">
          Masukkan email terdaftar untuk menerima tautan pemulihan kata sandi.
        </p>

        <div className="mt-6 bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Tautan pengaturan ulang kata sandi telah dikirim ke <strong>{email}</strong>.
                </span>
              </div>
              <Link
                href="/login"
                className="block w-full text-center py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
              >
                Kembali ke Halaman Masuk
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                Kirim Tautan Reset
              </button>
              <p className="text-xs text-center text-slate-500">
                <Link href="/login" className="text-blue-700 hover:underline font-medium">
                  Kembali ke halaman masuk
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
