'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function PendingApprovalPage() {
  const { firebaseUser, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace('/login');
      return;
    }
    if (profile?.status === 'active') {
      router.replace(profile.role === 'teacher' ? '/teacher' : '/student');
    } else if (profile?.status === 'suspended') {
      router.replace('/suspended');
    }
  }, [loading, firebaseUser, profile, router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8">
        <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-5">
          <Clock className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Menunggu Persetujuan Admin</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Akun guru Anda (<strong>{profile?.email || firebaseUser?.email}</strong>) telah terdaftar
          dan sedang menunggu verifikasi dari administrator sekolah sebelum dapat membuat kelas dan
          ujian.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={refreshProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
          >
            <RefreshCw className="w-4 h-4" />
            Periksa Status
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 text-slate-700 text-sm font-semibold hover:bg-stone-50"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
