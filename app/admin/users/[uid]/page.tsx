'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import { formatWIB } from '@/lib/time';
import type { UserProfile, UserRole } from '@/lib/types';

export default function AdminUserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { profile: adminProfile, sendResetPassword } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) setUser(snap.data() as UserProfile);
    });
    return () => unsub();
  }, [uid]);

  const isSelf = adminProfile?.uid === uid;

  const handleToggleSuspend = async () => {
    if (!user || !adminProfile || isSelf) return;
    setBusy(true);
    try {
      const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
      await updateDoc(doc(db, 'users', uid), {
        status: nextStatus,
        suspendedReason: nextStatus === 'suspended' ? reason.trim() || 'Ditangguhkan admin' : '',
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: adminProfile.uid,
        actorEmail: adminProfile.email,
        action: nextStatus === 'suspended' ? 'suspend_user' : 'activate_user',
        targetType: 'user',
        targetId: uid,
        reason: reason.trim() || undefined,
      });
      setNotice(
        nextStatus === 'suspended' ? 'Akun berhasil ditangguhkan.' : 'Akun berhasil diaktifkan kembali.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setBusy(false);
    }
  };

  const handleChangeRole = async (nextRole: Extract<UserRole, 'teacher' | 'student'>) => {
    if (!user || !adminProfile || isSelf || user.role === 'admin') return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: adminProfile.uid,
        actorEmail: adminProfile.email,
        action: 'change_role',
        targetType: 'user',
        targetId: uid,
        meta: { from: user.role, to: nextRole },
      });
      setNotice(`Peran pengguna diubah menjadi ${nextRole === 'teacher' ? 'Guru' : 'Siswa'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResetPass = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await sendResetPassword(user.email);
      setNotice(`Email reset kata sandi telah dikirim ke ${user.email}.`);
    } catch {
      setNotice('Gagal mengirim email reset kata sandi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Detail Pengguna">
      <div className="max-w-2xl space-y-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Daftar Pengguna
        </Link>

        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{notice}</span>
          </div>
        )}

        {!user ? (
          <div className="p-8 text-sm text-slate-500">Memuat data pengguna...</div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.displayName}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{user.email}</p>
              {user.schoolName && (
                <p className="text-xs font-medium text-slate-700 mt-1">
                  Sekolah / Instansi: {user.schoolName}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>
                  Peran:{' '}
                  <strong className="text-slate-900 capitalize">
                    {user.role === 'teacher' ? 'Guru' : user.role === 'student' ? 'Siswa' : 'Admin'}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Status: <strong className="text-slate-900">{user.status}</strong>
                </span>
                <span>·</span>
                <span>Terdaftar: {formatWIB(user.createdAt)}</span>
              </div>
            </div>

            {!isSelf && user.role !== 'admin' && (
              <div className="pt-5 border-t border-stone-200 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Ubah Peran (bila salah memilih saat registrasi)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || user.role === 'student'}
                      onClick={() => handleChangeRole('student')}
                      className="px-4 py-2 rounded-lg border border-stone-200 text-xs font-semibold disabled:opacity-40"
                    >
                      Jadikan Siswa
                    </button>
                    <button
                      type="button"
                      disabled={busy || user.role === 'teacher'}
                      onClick={() => handleChangeRole('teacher')}
                      className="px-4 py-2 rounded-lg border border-stone-200 text-xs font-semibold disabled:opacity-40"
                    >
                      Jadikan Guru
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alasan Penangguhan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Contoh: Pelanggaran tata tertib atau akun tidak aktif"
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm mb-3"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleToggleSuspend}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                      user.status === 'suspended'
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                        : 'bg-red-700 text-white hover:bg-red-800'
                    }`}
                  >
                    {user.status === 'suspended' ? 'Aktifkan Akun Kembali' : 'Tangguhkan Akun'}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-5 border-t border-stone-200">
              <button
                type="button"
                disabled={busy}
                onClick={handleResetPass}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
              >
                <KeyRound className="w-4 h-4" />
                Kirim Email Reset Kata Sandi
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
