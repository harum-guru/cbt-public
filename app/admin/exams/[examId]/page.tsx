'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { db } from '@/lib/firebase/client';
import { formatShortTimeWIB } from '@/lib/time';
import type { Exam, ExamAttempt } from '@/lib/types';

export default function AdminExamDetailMonitorPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);

  useEffect(() => {
    if (!examId) return;
    const u1 = onSnapshot(doc(db, 'exams', examId), (s) => {
      if (s.exists()) setExam({ id: s.id, ...(s.data() as Omit<Exam, 'id'>) });
    });
    const u2 = onSnapshot(collection(db, 'exams', examId, 'attempts'), (s) => {
      setAttempts(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamAttempt, 'id'>) })));
    });
    return () => {
      u1();
      u2();
    };
  }, [examId]);

  return (
    <AppShell requiredRole="admin" title={`Pengawasan Ujian · ${exam?.title || ''}`}>
      <div className="space-y-6">
        <Link
          href="/admin/exams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Daftar Ujian
        </Link>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-sm font-bold text-slate-900">
              Peserta Pengerjaan ({attempts.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Siswa</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Progres</th>
                  <th className="px-5 py-3 font-semibold">Pelanggaran</th>
                  <th className="px-5 py-3 font-semibold">Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {a.studentName || a.studentId}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {a.status === 'submitted' ? 'Selesai' : 'Sedang Mengerjakan'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                      {a.answeredCount} / {a.questionOrder.length}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums">{a.violations}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                      {formatShortTimeWIB(a.lastHeartbeatAt)}
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
