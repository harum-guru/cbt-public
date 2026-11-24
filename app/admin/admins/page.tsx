'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ShieldPlus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import type { AdminRecord, UserProfile } from '@/lib/types';

export default function AdminManageAdminsPage() {
  const { profile } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'admins'),
      (snap) => setAdmins(snap.docs.map((d) => d.data() as AdminRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
    );
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => d.data() as UserProfile));
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  const candidates = users.filter(
    (u) => u.status === 'active' && u.role !== 'admin' && !admins.some((a) => a.uid === u.uid)
  );

  const handleAddAdmin = async () => {
    const target = users.find((u) => u.uid === selectedUid);
    if (!target || !profile) return;
    setBusy(true);
    try {
      await setDoc(doc(db, 'admins', target.uid), {
        uid: target.uid,
        email: target.email,
        displayName: target.displayName,
        addedBy: profile.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', target.uid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'create_admin',
        targetType: 'user',
        targetId: target.uid,
        meta: { email: target.email },
      });
      setSelectedUid('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `admins/${target.uid}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAdmin = async (adm: AdminRecord) => {
    if (!profile || adm.uid === profile.uid || admins.length <= 1) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'admins', adm.uid));
      await updateDoc(doc(db, 'users', adm.uid), {
        role: 'teacher',
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'remove_admin',
        targetType: 'user',
        targetId: adm.uid,
        meta: { email: adm.email },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `admins/${adm.uid}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Kelola Akun Admin">
      <div className="max-w-2xl space-y-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Tambahkan Administrator Baru</h2>
          <p className="text-xs text-slate-600">
            Pilih akun pengguna terverifikasi yang ingin diberi hak akses administrator.
          </p>
          <div className="flex gap-3">
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
            >
              <option value="">Pilih pengguna aktif...</option>
              {candidates.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.displayName} ({c.email})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedUid || busy}
              onClick={handleAddAdmin}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold disabled:opacity-40"
            >
              <ShieldPlus className="w-4 h-4" />
              Jadikan Admin
            </button>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="text-sm font-bold text-slate-900">Daftar Admin Aktif ({admins.length})</h3>
          </div>
          <div className="divide-y divide-stone-200">
            {admins.map((adm) => (
              <div key={adm.uid} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{adm.displayName}</p>
                  <p className="text-xs text-slate-500">{adm.email}</p>
                </div>
                {adm.uid !== profile?.uid && admins.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemoveAdmin(adm)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Cabut Admin
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
