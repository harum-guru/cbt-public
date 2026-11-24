'use client';

import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import type { ClassRoom, UserProfile } from '@/lib/types';

export default function AdminClassesPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'classes'),
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
    );
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(
        snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => u.role === 'teacher' && u.status === 'active')
      );
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  const handleTransfer = async (cls: ClassRoom) => {
    if (!cls.id || !profile) return;
    const nextTeacherId = transferTarget[cls.id];
    const nextTeacher = teachers.find((t) => t.uid === nextTeacherId);
    if (!nextTeacher) return;

    setBusyId(cls.id);
    try {
      await updateDoc(doc(db, 'classes', cls.id), {
        teacherId: nextTeacher.uid,
        teacherName: nextTeacher.displayName,
        ...(nextTeacher.schoolName ? { schoolName: nextTeacher.schoolName } : {}),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'classCodes', cls.joinCode), {
        teacherId: nextTeacher.uid,
        teacherName: nextTeacher.displayName,
        ...(nextTeacher.schoolName ? { schoolName: nextTeacher.schoolName } : {}),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'transfer_class',
        targetType: 'class',
        targetId: cls.id,
        meta: { fromTeacherId: cls.teacherId, toTeacherId: nextTeacher.uid },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${cls.id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Pengawasan Kelas">
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Kelas</th>
                <th className="px-5 py-3 font-semibold">Guru Pemilik</th>
                <th className="px-5 py-3 font-semibold">Kode</th>
                <th className="px-5 py-3 font-semibold">Anggota</th>
                <th className="px-5 py-3 font-semibold">Pindah Kepemilikan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {classes.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{cls.name}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{cls.teacherName || cls.teacherId}</p>
                    {cls.schoolName && <p className="text-slate-500 mt-0.5">{cls.schoolName}</p>}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums">{cls.joinCode}</td>
                  <td className="px-5 py-3.5 font-mono text-xs tabular-nums">{cls.memberCount}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={transferTarget[cls.id!] || ''}
                        onChange={(e) =>
                          setTransferTarget((prev) => ({ ...prev, [cls.id!]: e.target.value }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                      >
                        <option value="">Pilih guru baru...</option>
                        {teachers
                          .filter((t) => t.uid !== cls.teacherId)
                          .map((t) => (
                            <option key={t.uid} value={t.uid}>
                              {t.displayName}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!transferTarget[cls.id!] || busyId === cls.id}
                        onClick={() => handleTransfer(cls)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
                      >
                        Pindahkan
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
