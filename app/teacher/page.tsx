'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Plus, BookOpen, FileText, Radio, BarChart3, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatWIB } from '@/lib/time';
import type { ClassRoom, Exam } from '@/lib/types';

export default function TeacherDashboardPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const cq = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
    const eq = query(collection(db, 'exams'), where('teacherId', '==', profile.uid));

    const unsubClasses = onSnapshot(
      cq,
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
    );

    const unsubExams = onSnapshot(
      eq,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exam, 'id'>) }));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setExams(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'exams')
    );

    return () => {
      unsubClasses();
      unsubExams();
    };
  }, [profile?.uid]);

  const activeClasses = classes.filter((c) => !c.isArchived);
  const totalStudents = activeClasses.reduce((sum, c) => sum + (c.memberCount || 0), 0);
  const publishedExams = exams.filter((e) => e.status === 'published');
  const draftExams = exams.filter((e) => e.status === 'draft');

  return (
    <AppShell
      requiredRole="teacher"
      title="Dashboard Guru"
      actions={
        <Link
          href="/teacher/exams/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Buat Ujian
        </Link>
      }
    >
      <div className="space-y-8">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Kelas Aktif</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {activeClasses.length}
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Total Siswa Terdaftar</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{totalStudents}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Ujian Dipublikasikan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {publishedExams.length}
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Ujian Draft</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {draftExams.length}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/teacher/classes"
            className="bg-white border border-stone-200 rounded-xl p-5 hover:border-blue-700/50 transition-colors flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-100 text-slate-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Kelola Kelas &amp; Kode Gabung</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Buat kelas baru dan bagikan kode 6 karakter kepada siswa.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </Link>

          <Link
            href="/teacher/question-bank"
            className="bg-white border border-stone-200 rounded-xl p-5 hover:border-blue-700/50 transition-colors flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-stone-100 text-slate-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Bank Soal Pribadi</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Simpan dan gunakan kembali soal pilihan ganda lintas ujian.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </Link>
        </div>

        {/* Recent Exams */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Ujian Terbaru</h2>
            <Link href="/teacher/exams" className="text-xs font-semibold text-blue-700 hover:underline">
              Lihat Semua
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Memuat daftar ujian...</div>
          ) : exams.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-slate-900">Belum ada ujian yang dibuat</p>
              <p className="text-xs text-slate-600 mt-1 mb-5">
                Buat kelas terlebih dahulu, lalu susun ujian pilihan ganda pertama Anda.
              </p>
              <Link
                href="/teacher/exams/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
              >
                <Plus className="w-4 h-4" />
                Buat Ujian Pertama
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {exams.slice(0, 8).map((exam) => (
                <div
                  key={exam.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
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
                      <span className="tabular-nums">{exam.settings.durationMinutes} menit</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">{exam.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Buka: {formatWIB(exam.settings.opensAt, exam.settings.timezone || profile?.timezone)} · Tutup:{' '}
                      {formatWIB(exam.settings.closesAt, exam.settings.timezone || profile?.timezone)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      href={`/teacher/exams/${exam.id}/edit`}
                      className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-slate-700 hover:bg-stone-50"
                    >
                      Kelola Soal
                    </Link>
                    {exam.status !== 'draft' && (
                      <>
                        <Link
                          href={`/teacher/exams/${exam.id}/monitor`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          Pantau Live
                        </Link>
                        <Link
                          href={`/teacher/exams/${exam.id}/results`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          Rekap Nilai
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
