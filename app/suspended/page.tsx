'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function SuspendedPage() {
  const { firebaseUser, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace('/login');
      return;
    }
    if (profile?.status === 'active') {
      router.replace(profile.role === 'teacher' ? '/teacher' : '/student');
    } else if (profile?.status === 'pending_approval') {
      router.replace('/pending-approval');
    }
  }, [loading, firebaseUser, profile, router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8">
        <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex items-center justify-center mb-5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Akun Ditangguhkan</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Akses akun Anda saat ini ditangguhkan oleh administrator.
          {profile?.suspendedReason ? (
            <span className="block mt-2 p-3 rounded-lg bg-stone-50 border border-stone-200 text-slate-800">
              Alasan: {profile.suspendedReason}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" />
          Keluar dari Akun
        </button>
      </div>
    </div>
  );
}
