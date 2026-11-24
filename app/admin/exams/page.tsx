'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import { formatWIB } from '@/lib/time';
import type { Exam, ExamStatus } from '@/lib/types';

export default function AdminExamsPage() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'exams'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exam, 'id'>) }));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setExams(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'exams')
    );
    return () => unsub();
  }, []);

  const handleIntervene = async (exam: Exam, nextStatus: ExamStatus) => {
    if (!exam.id || !profile) return;
    setBusyId(exam.id);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: nextStatus === 'closed' ? 'close_exam' : 'archive_exam',
        targetType: 'exam',
        targetId: exam.id,
        meta: { title: exam.title },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${exam.id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Pengawasan Ujian (Hanya-Baca)">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Untuk menjaga integritas ujian, akun administrator hanya dapat memantau pelaksanaan dan
          tidak memiliki akses membaca kunci jawaban.
        </p>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Ujian</th>
                  <th className="px-5 py-3 font-semibold">Guru</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Jadwal Tutup</th>
                  <th className="px-5 py-3 font-semibold">Peserta</th>
                  <th className="px-5 py-3 font-semibold text-right">Intervensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {exams.map((ex) => (
                  <tr key={ex.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{ex.title}</p>
                      <p className="text-xs text-slate-500">{ex.subject}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{ex.teacherName || ex.teacherId}</p>
                      {ex.schoolName && <p className="text-slate-500 mt-0.5">{ex.schoolName}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold capitalize">{ex.status}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {formatWIB(ex.settings.closesAt)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                      {ex.attemptCount || 0}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/admin/exams/${ex.id}`}
                          className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                        >
                          Pantau
                        </Link>
                        {ex.status === 'published' && (
                          <button
                            type="button"
                            disabled={busyId === ex.id}
                            onClick={() => handleIntervene(ex, 'closed')}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                          >
                            Tutup Paksa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
