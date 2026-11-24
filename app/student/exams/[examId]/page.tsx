'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { ArrowLeft, AlertTriangle, Play, Clock, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatWIB } from '@/lib/time';
import type { Exam, ExamAttempt, ExamQuestion } from '@/lib/types';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function StudentExamConfirmPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!examId || !profile?.uid) return;
    (async () => {
      try {
        const examSnap = await getDoc(doc(db, 'exams', examId));
        if (examSnap.exists()) {
          setExam({ id: examSnap.id, ...(examSnap.data() as Omit<Exam, 'id'>) });
        }
        const attSnap = await getDocs(
          query(collection(db, 'exams', examId, 'attempts'), where('studentId', '==', profile.uid))
        );
        const list = attSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExamAttempt, 'id'>),
        }));
        list.sort((a, b) => a.attemptNumber - b.attemptNumber);
        setAttempts(list);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `exams/${examId}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, profile?.uid]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const activeAttempt = attempts.find((a) => a.status === 'in_progress');
  const openMs = exam?.settings.opensAt?.toMillis?.() || 0;
  const closeMs = exam?.settings.closesAt?.toMillis?.() || 0;
  const isWithinWindow = exam?.status === 'published' && now >= openMs && now <= closeMs;
  const attemptsLeft = exam ? exam.settings.maxAttempts - attempts.length : 0;

  const handleStart = async () => {
    if (!exam || !profile) return;
    if (activeAttempt) {
      router.push(`/student/exams/${examId}/take`);
      return;
    }
    if (!isWithinWindow) {
      setError('Ujian tidak berada dalam jadwal pengerjaan.');
      return;
    }
    if (attemptsLeft <= 0) {
      setError('Batas maksimal percobaan untuk ujian ini telah habis.');
      return;
    }

    setStarting(true);
    setError('');
    try {
      // Load questions (key-free subcollection!)
      const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
      const questionsList = qSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) }))
        .sort((a, b) => a.order - b.order);

      if (questionsList.length === 0) {
        setError('Soal ujian belum tersedia.');
        setStarting(false);
        return;
      }

      const questionOrder = exam.settings.shuffleQuestions
        ? shuffleArray(questionsList.map((q) => q.id))
        : questionsList.map((q) => q.id);

      const optionOrder: Record<string, string[]> = {};
      for (const q of questionsList) {
        const optIds = q.options.map((o) => o.id);
        optionOrder[q.id] = exam.settings.shuffleOptions ? shuffleArray(optIds) : optIds;
      }

      const nextAttemptNumber = attempts.length + 1;
      const attemptId = `${profile.uid}_${nextAttemptNumber}`;
      const deadlineMs = Math.min(
        Date.now() + exam.settings.durationMinutes * 60_000,
        closeMs
      );

      // Find student's matching classId
      const enrSnap = await getDocs(collection(db, 'users', profile.uid, 'enrollments'));
      const enrolledIds = enrSnap.docs.map((d) => d.id);
      const classId = exam.classIds.find((c) => enrolledIds.includes(c)) || exam.classIds[0];

      const batch = writeBatch(db);
      batch.set(doc(db, 'exams', examId, 'attempts', attemptId), {
        studentId: profile.uid,
        studentName: profile.displayName,
        ...(profile.studentNumber ? { studentNumber: profile.studentNumber } : {}),
        classId,
        attemptNumber: nextAttemptNumber,
        status: 'in_progress',
        startedAt: serverTimestamp(),
        deadline: Timestamp.fromMillis(deadlineMs),
        questionOrder,
        optionOrder,
        answers: {},
        answeredCount: 0,
        violations: 0,
        presence: 'online',
        lastHeartbeatAt: serverTimestamp(),
        flaggedForReview: false,
        resultReleased: false,
      });
      batch.update(doc(db, 'exams', examId), {
        attemptCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      if (exam.settings.proctoring?.requireFullscreen && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      router.push(`/student/exams/${examId}/take`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `exams/${examId}/attempts`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell requiredRole="student" title={exam?.title || 'Konfirmasi Ujian'}>
      <div className="max-w-2xl space-y-6">
        <Link
          href="/student"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard
        </Link>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat informasi ujian...</div>
        ) : !exam ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-sm text-slate-600">
            Ujian tidak ditemukan atau Anda tidak terdaftar pada kelas ujian ini.
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold text-blue-700">{exam.subject}</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">{exam.title}</h2>
              {exam.description && (
                <p className="text-sm text-slate-600 mt-3 leading-relaxed whitespace-pre-line">
                  {exam.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs">
              <div>
                <p className="text-slate-500">Jumlah Soal</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                  {exam.questionCount} PG
                </p>
              </div>
              <div>
                <p className="text-slate-500">Durasi</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                  {exam.settings.durationMinutes} menit
                </p>
              </div>
              <div>
                <p className="text-slate-500">Percobaan</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                  {attempts.length} / {exam.settings.maxAttempts}
                </p>
              </div>
              <div>
                <p className="text-slate-500">KKM</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">
                  {typeof exam.settings.passingScore === 'number' ? exam.settings.passingScore : '—'}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5">
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Jadwal Buka: <strong>{formatWIB(exam.settings.opensAt, exam.settings.timezone)}</strong>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Jadwal Tutup: <strong>{formatWIB(exam.settings.closesAt, exam.settings.timezone)}</strong>
              </p>
            </div>

            {/* Proctoring Notice (TAKE-14) */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <p className="font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                Tata Tertib &amp; Pencatatan Aktivitas Ujian
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Timer berjalan terus berdasarkan waktu server dan tidak berhenti saat tab ditutup.</li>
                {exam.settings.proctoring?.detectTabSwitch && (
                  <li>Perpindahan tab atau jendela akan dicatat otomatis beserta lama waktunya.</li>
                )}
                {exam.settings.proctoring?.requireFullscreen && (
                  <li>Ujian ini mewajibkan mode layar penuh selama pengerjaan berlangsung.</li>
                )}
                {exam.settings.proctoring?.blockCopyPaste && (
                  <li>Fitur salin-tempel dan klik kanan dinonaktifkan pada halaman ujian.</li>
                )}
                {exam.settings.proctoring?.onLimitReached === 'auto_submit' &&
                  exam.settings.proctoring?.violationLimit && (
                    <li>
                      Jika pelanggaran melebihi {exam.settings.proctoring.violationLimit} kali, ujian
                      akan dikirim otomatis.
                    </li>
                  )}
              </ul>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {activeAttempt ? (
                <Link
                  href={`/student/exams/${examId}/take`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
                >
                  <Play className="w-4 h-4" />
                  Lanjutkan Pengerjaan
                </Link>
              ) : isWithinWindow && attemptsLeft > 0 ? (
                <button
                  type="button"
                  disabled={starting}
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {starting ? 'Menyiapkan Soal...' : 'Mulai Ujian Sekarang'}
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-500">
                  {attemptsLeft <= 0
                    ? 'Semua kesempatan pengerjaan telah digunakan.'
                    : 'Ujian berada di luar jadwal pengerjaan.'}
                </span>
              )}

              {attempts.some((a) => a.status === 'submitted') && (
                <Link
                  href={`/student/exams/${examId}/result`}
                  className="px-5 py-3 rounded-xl border border-stone-200 text-sm font-semibold text-slate-700 hover:bg-stone-50"
                >
                  Lihat Hasil Sebelumnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
