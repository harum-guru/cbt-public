'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Plus, Copy, Radio, BarChart3, Edit3, Archive, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { duplicateExamToDraft, syncExamRefsForClasses } from '@/lib/exam-helpers';
import { formatWIB } from '@/lib/time';
import type { Exam, ExamStatus } from '@/lib/types';

export default function TeacherExamsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ExamStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'exams'), where('teacherId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exam, 'id'>) }));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setExams(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'exams')
    );
    return () => unsub();
  }, [profile?.uid]);

  const handleDuplicate = async (exam: Exam) => {
    if (!profile) return;
    setBusyId(exam.id || null);
    try {
      const newId = await duplicateExamToDraft(exam, profile.uid, profile.displayName);
      router.push(`/teacher/exams/${newId}/edit`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'exams');
    } finally {
      setBusyId(null);
    }
  };

  const handleChangeStatus = async (exam: Exam, nextStatus: ExamStatus) => {
    if (!exam.id) return;
    setBusyId(exam.id);
    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await syncExamRefsForClasses(exam.id, { ...exam, status: nextStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${exam.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDraft = async (exam: Exam) => {
    if (!exam.id || (exam.attemptCount || 0) > 0) return;
    setBusyId(exam.id);
    try {
      await deleteDoc(doc(db, 'exams', exam.id));
      await syncExamRefsForClasses(exam.id, { ...exam, classIds: [] }, exam.classIds);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `exams/${exam.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = filter === 'all' ? exams : exams.filter((e) => e.status === filter);

  return (
    <AppShell
      requiredRole="teacher"
      title="Daftar Ujian"
      actions={
        <Link
          href="/teacher/exams/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Buat Ujian
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'Semua'],
              ['draft', 'Draft'],
              ['published', 'Dipublikasikan'],
              ['closed', 'Ditutup'],
              ['archived', 'Diarsipkan'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-stone-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat ujian...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">Tidak ada ujian pada kategori ini</p>
            <p className="text-xs text-slate-600 mt-1">
              Buat ujian baru untuk mulai menyusun soal pilihan ganda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exam) => (
              <div
                key={exam.id}
                className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`font-semibold ${
                        exam.status === 'published'
                          ? 'text-emerald-700'
                          : exam.status === 'closed'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {exam.status === 'published'
                        ? 'Dipublikasikan'
                        : exam.status === 'closed'
                          ? 'Ditutup'
                          : exam.status === 'archived'
                            ? 'Diarsipkan'
                            : 'Draft'}
                    </span>
                    <span>·</span>
                    <span>{exam.subject}</span>
                    <span>·</span>
                    <span className="tabular-nums">{exam.questionCount} soal</span>
                    <span>·</span>
                    <span className="tabular-nums">{exam.attemptCount || 0} pengerjaan</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1 truncate">{exam.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Jadwal: {formatWIB(exam.settings.opensAt, exam.settings.timezone || profile?.timezone)} s/d{' '}
                    {formatWIB(exam.settings.closesAt, exam.settings.timezone || profile?.timezone)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    href={`/teacher/exams/${exam.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editor
                  </Link>

                  {exam.status !== 'draft' && (
                    <>
                      <Link
                        href={`/teacher/exams/${exam.id}/monitor`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        Pantau
                      </Link>
                      <Link
                        href={`/teacher/exams/${exam.id}/results`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Hasil
                      </Link>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={busyId === exam.id}
                    onClick={() => handleDuplicate(exam)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplikat
                  </button>

                  {exam.status === 'published' && (
                    <button
                      type="button"
                      disabled={busyId === exam.id}
                      onClick={() => handleChangeStatus(exam, 'closed')}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                      Tutup
                    </button>
                  )}

                  {exam.status !== 'archived' && (exam.attemptCount || 0) > 0 && (
                    <button
                      type="button"
                      disabled={busyId === exam.id}
                      onClick={() => handleChangeStatus(exam, 'archived')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-600 hover:bg-stone-100"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Arsipkan
                    </button>
                  )}

                  {(exam.attemptCount || 0) === 0 && (
                    <button
                      type="button"
                      disabled={busyId === exam.id}
                      onClick={() => handleDeleteDraft(exam)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
