'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { AlertCircle, CheckCircle2, LogOut, UserPlus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { joinCodeSchema } from '@/lib/validation';
import { formatWIB } from '@/lib/time';
import type { StudentEnrollment } from '@/lib/types';

export default function StudentClassesPage() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', profile.uid, 'enrollments'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as StudentEnrollment);
        list.sort((a, b) => (b.joinedAt?.toMillis?.() || 0) - (a.joinedAt?.toMillis?.() || 0));
        setEnrollments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${profile.uid}/enrollments`)
    );
    return () => unsub();
  }, [profile?.uid]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');
    setSuccess('');

    const parsed = joinCodeSchema.safeParse({ joinCode });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Kode kelas tidak valid.');
      return;
    }

    const code = parsed.data.joinCode;
    setBusy(true);
    try {
      const codeSnap = await getDoc(doc(db, 'classCodes', code));
      if (!codeSnap.exists()) {
        setError('Kode kelas tidak ditemukan. Periksa kembali kode dari guru Anda.');
        return;
      }
      const codeData = codeSnap.data() as {
        classId: string;
        teacherId: string;
        teacherName?: string;
        schoolName?: string;
        className: string;
        isArchived: boolean;
      };
      if (codeData.isArchived) {
        setError('Kelas ini sudah diarsipkan dan tidak menerima anggota baru.');
        return;
      }
      if (enrollments.some((en) => en.classId === codeData.classId)) {
        setError('Anda sudah tergabung di kelas ini.');
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'classes', codeData.classId, 'members', profile.uid), {
        studentUid: profile.uid,
        displayName: profile.displayName,
        ...(profile.studentNumber ? { studentNumber: profile.studentNumber } : {}),
        joinCode: code,
        joinedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', profile.uid, 'enrollments', codeData.classId), {
        classId: codeData.classId,
        className: codeData.className,
        teacherId: codeData.teacherId,
        ...(codeData.teacherName ? { teacherName: codeData.teacherName } : {}),
        ...(codeData.schoolName ? { schoolName: codeData.schoolName } : {}),
        joinedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'classes', codeData.classId), {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      setJoinCode('');
      setSuccess(`Berhasil bergabung ke kelas ${codeData.className}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'classes/members');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (enr: StudentEnrollment) => {
    if (!profile) return;
    setBusy(true);
    setError('');
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'classes', enr.classId, 'members', profile.uid));
      batch.delete(doc(db, 'users', profile.uid, 'enrollments', enr.classId));
      batch.update(doc(db, 'classes', enr.classId), {
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${profile.uid}/enrollments/${enr.classId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requiredRole="student" title="Kelas Saya & Gabung Kelas">
      <div className="space-y-6 max-w-3xl">
        <form
          onSubmit={handleJoin}
          className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">Gabung Kelas dengan Kode</h2>
          <p className="text-xs text-slate-600">
            Masukkan 6 karakter kode kelas yang dibagikan oleh guru mata pelajaran Anda.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              maxLength={6}
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Contoh: 7K9P2M"
              className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-base tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              Gabung Kelas
            </button>
          </div>
        </form>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="text-base font-bold text-slate-900">
              Kelas yang Diikuti ({enrollments.length})
            </h3>
          </div>
          {enrollments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Anda belum bergabung ke kelas apa pun.
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {enrollments.map((enr) => (
                <div key={enr.classId} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{enr.className}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {enr.teacherName ? `${enr.teacherName} · ` : ''}
                      {enr.schoolName ? `${enr.schoolName} · ` : ''}
                      Bergabung {formatWIB(enr.joinedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleLeave(enr)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar Kelas
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
