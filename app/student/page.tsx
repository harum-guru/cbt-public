'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { BookOpen, Clock, CheckCircle2, Calendar, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatWIB } from '@/lib/time';
import type { ClassExamRef, ExamAttempt, StudentEnrollment } from '@/lib/types';

interface StudentExamCard extends ClassExamRef {
  classId: string;
  className: string;
  attempts: ExamAttempt[];
}

export default function StudentDashboardPage() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [examCards, setExamCards] = useState<StudentExamCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', profile.uid, 'enrollments'),
      async (snap) => {
        const list = snap.docs.map((d) => d.data() as StudentEnrollment);
        setEnrollments(list);

        const cardsMap = new Map<string, StudentExamCard>();
        for (const enr of list) {
          try {
            const refsSnap = await getDocs(collection(db, 'classes', enr.classId, 'examRefs'));
            for (const r of refsSnap.docs) {
              const refData = r.data() as ClassExamRef;
              if (refData.status !== 'published' && refData.status !== 'closed') continue;
              if (cardsMap.has(refData.examId)) continue;

              let studentAttempts: ExamAttempt[] = [];
              try {
                const attSnap = await getDocs(
                  query(
                    collection(db, 'exams', refData.examId, 'attempts'),
                    where('studentId', '==', profile.uid)
                  )
                );
                studentAttempts = attSnap.docs.map((ad) => ({
                  id: ad.id,
                  ...(ad.data() as Omit<ExamAttempt, 'id'>),
                }));
                studentAttempts.sort((a, b) => b.attemptNumber - a.attemptNumber);
              } catch {
                // ignore
              }

              cardsMap.set(refData.examId, {
                ...refData,
                classId: enr.classId,
                className: enr.className,
                attempts: studentAttempts,
              });
            }
          } catch {
            // ignore
          }
        }

        const merged = Array.from(cardsMap.values()).sort(
          (a, b) => (a.opensAt?.toMillis?.() || 0) - (b.opensAt?.toMillis?.() || 0)
        );
        setExamCards(merged);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${profile.uid}/enrollments`)
    );

    return () => unsub();
  }, [profile?.uid]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ongoing: StudentExamCard[] = [];
  const upcoming: StudentExamCard[] = [];
  const finished: StudentExamCard[] = [];

  for (const card of examCards) {
    const openMs = card.opensAt?.toMillis?.() || 0;
    const closeMs = card.closesAt?.toMillis?.() || 0;
    const hasInProgress = card.attempts.some((a) => a.status === 'in_progress');
    const hasSubmitted = card.attempts.some((a) => a.status === 'submitted');

    if (card.status === 'closed' || now > closeMs || (hasSubmitted && !hasInProgress)) {
      finished.push(card);
    } else if (now < openMs) {
      upcoming.push(card);
    } else {
      ongoing.push(card);
    }
  }

  return (
    <AppShell
      requiredRole="student"
      title="Dashboard Siswa"
      actions={
        <Link
          href="/student/classes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 whitespace-nowrap"
        >
          <BookOpen className="w-4 h-4" />
          Gabung Kelas
        </Link>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Kelas Diikuti</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {enrollments.length}
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Ujian Tersedia</p>
            <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">{ongoing.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Ujian Selesai</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {finished.length}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat daftar ujian...</div>
        ) : enrollments.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-base font-bold text-slate-900">Anda belum bergabung ke kelas mana pun</p>
            <p className="text-sm text-slate-600 mt-1 mb-5">
              Masukkan kode kelas 6 karakter dari guru Anda untuk melihat daftar ujian.
            </p>
            <Link
              href="/student/classes"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
            >
              Masukkan Kode Kelas
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Sedang Berlangsung */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-700" />
                Sedang Berlangsung ({ongoing.length})
              </h2>
              {ongoing.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-xl p-6 text-sm text-slate-500">
                  Tidak ada ujian yang sedang dibuka saat ini.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {ongoing.map((exam) => {
                    const inProgress = exam.attempts.some((a) => a.status === 'in_progress');
                    return (
                      <div
                        key={exam.examId}
                        className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-slate-500">
                            {exam.className} · {exam.subject} · {exam.questionCount || 0} soal
                          </p>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{exam.title}</h3>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Durasi {exam.durationMinutes} menit · Tutup: {formatWIB(exam.closesAt, exam.timezone)}
                          </p>
                        </div>
                        <Link
                          href={
                            inProgress
                              ? `/student/exams/${exam.examId}/take`
                              : `/student/exams/${exam.examId}`
                          }
                          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
                        >
                          {inProgress ? 'Lanjutkan Ujian' : 'Buka & Kerjakan'}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Akan Datang */}
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Akan Datang ({upcoming.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {upcoming.map((exam) => (
                    <div
                      key={exam.examId}
                      className="bg-white border border-stone-200 rounded-2xl p-5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs text-slate-500">
                          {exam.className} · {exam.subject}
                        </p>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{exam.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Dibuka: {formatWIB(exam.opensAt, exam.timezone)}
                        </p>
                      </div>
                      <Link
                        href={`/student/exams/${exam.examId}`}
                        className="px-3.5 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50 shrink-0"
                      >
                        Lihat Info
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Selesai */}
            {finished.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Selesai ({finished.length})
                </h2>
                <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-200">
                  {finished.map((exam) => {
                    const submitted = exam.attempts.filter((a) => a.status === 'submitted');
                    const best = submitted.reduce<number | null>(
                      (max, a) =>
                        typeof a.percentage === 'number'
                          ? max === null
                            ? a.percentage
                            : Math.max(max, a.percentage)
                          : max,
                      null
                    );
                    return (
                      <div
                        key={exam.examId}
                        className="px-6 py-4 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-slate-500">
                            {exam.className} · {exam.subject}
                          </p>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{exam.title}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {best !== null && (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              Nilai: {best}
                            </span>
                          )}
                          <Link
                            href={`/student/exams/${exam.examId}/result`}
                            className="px-3.5 py-1.5 rounded-lg bg-stone-100 text-slate-800 text-xs font-semibold hover:bg-stone-200"
                          >
                            Lihat Hasil
                          </Link>
                          <Link
                            href={`/student/exams/${exam.examId}`}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Info Ujian
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
