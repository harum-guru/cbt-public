'use client';

import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import { formatWIB } from '@/lib/time';
import type { UserProfile } from '@/lib/types';

export default function AdminPendingTeachersPage() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('status', '==', 'pending_approval')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPending(snap.docs.map((d) => d.data() as UserProfile));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, []);

  const handleApprove = async (teacher: UserProfile) => {
    if (!profile) return;
    setBusyUid(teacher.uid);
    try {
      await updateDoc(doc(db, 'users', teacher.uid), {
        status: 'active',
        approvedBy: profile.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'approve_teacher',
        targetType: 'user',
        targetId: teacher.uid,
        meta: { email: teacher.email },
      });
      await addDoc(collection(db, 'notifications', teacher.uid, 'items'), {
        userId: teacher.uid,
        title: 'Akun Guru Disetujui',
        body: 'Akun Anda telah diaktifkan oleh administrator. Anda kini dapat membuat kelas dan ujian.',
        href: '/teacher',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${teacher.uid}`);
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (teacher: UserProfile) => {
    if (!profile) return;
    const reason = rejectReason[teacher.uid]?.trim() || 'Pendaftaran ditolak oleh administrator.';
    setBusyUid(teacher.uid);
    try {
      await updateDoc(doc(db, 'users', teacher.uid), {
        status: 'suspended',
        suspendedReason: reason,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'reject_teacher',
        targetType: 'user',
        targetId: teacher.uid,
        reason,
        meta: { email: teacher.email },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${teacher.uid}`);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Persetujuan Guru Baru">
      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat daftar pengajuan...</div>
        ) : pending.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-sm text-slate-500">
            Tidak ada akun guru yang sedang menunggu persetujuan.
          </div>
        ) : (
          pending.map((teacher) => (
            <div
              key={teacher.uid}
              className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{teacher.displayName}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {teacher.email}
                    {teacher.schoolName ? ` · ${teacher.schoolName}` : ''} · Mendaftar{' '}
                    {formatWIB(teacher.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyUid === teacher.uid}
                    onClick={() => handleApprove(teacher)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    disabled={busyUid === teacher.uid}
                    onClick={() => handleReject(teacher)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                  >
                    <XCircle className="w-4 h-4" />
                    Tolak
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={rejectReason[teacher.uid] || ''}
                onChange={(e) =>
                  setRejectReason((prev) => ({ ...prev, [teacher.uid]: e.target.value }))
                }
                placeholder="Alasan penolakan (opsional jika ditolak)"
                className="w-full px-3.5 py-2 rounded-lg border border-stone-200 text-xs"
              />
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
