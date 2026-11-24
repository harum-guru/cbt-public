'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { MathText } from '@/components/MathText';
import { QuestionImage } from '@/components/QuestionImage';
import { useAuth } from '@/components/AuthProvider';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { gradeAttempt } from '@/lib/grading';
import { formatWIB } from '@/lib/time';
import type { AnswerKey, Exam, ExamAttempt, ExamQuestion } from '@/lib/types';

const LABELS = ['A', 'B', 'C', 'D', 'E'];

interface CachedGrade {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalGraded: number;
  passed?: boolean;
  breakdown?: Record<string, { correctOptionId: string; explanation?: string; isCorrect: boolean }>;
}

export default function StudentExamResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKey>>({});
  const [serverGrade, setServerGrade] = useState<CachedGrade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId || !profile?.uid) return;
    (async () => {
      try {
        const examSnap = await getDoc(doc(db, 'exams', examId));
        if (!examSnap.exists()) {
          setLoading(false);
          return;
        }
        const examData = { id: examSnap.id, ...(examSnap.data() as Omit<Exam, 'id'>) };
        setExam(examData);

        const attSnap = await getDocs(
          query(
            collection(db, 'exams', examId, 'attempts'),
            where('studentId', '==', profile.uid),
            where('status', '==', 'submitted')
          )
        );
        const attList = attSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ExamAttempt, 'id'>) }))
          .sort((a, b) => b.attemptNumber - a.attemptNumber);
        setAttempts(attList);

        const latest = attList[0];
        if (!latest) {
          setLoading(false);
          return;
        }

        // Check cached server grade from submit
        if (typeof window !== 'undefined' && latest.id) {
          const cached = window.sessionStorage.getItem(`ujianku_grade_${examId}_${latest.id}`);
          if (cached) {
            try {
              setServerGrade(JSON.parse(cached) as CachedGrade);
            } catch {
              // ignore
            }
          }
        }

        const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
        const qList = qSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) }))
          .sort((a, b) => a.order - b.order);
        setQuestions(qList);

        const canShowKeys =
          examData.resultsReleased ||
          (examData.settings.resultsPolicy === 'answers_immediate' &&
            examData.settings.maxAttempts === 1);

        if (canShowKeys) {
          try {
            const kSnap = await getDocs(collection(db, 'exams', examId, 'answerKeys'));
            const kMap: Record<string, AnswerKey> = {};
            kSnap.docs.forEach((d) => {
              kMap[d.id] = d.data() as AnswerKey;
            });
            setAnswerKeys(kMap);
          } catch {
            // Fallback to server breakdown if keys rule not yet unlocked
          }
        } else if (
          examData.settings.resultsPolicy === 'score_immediate' &&
          typeof latest.percentage !== 'number' &&
          examData.sealedKeyToken &&
          auth.currentUser
        ) {
          const idToken = await auth.currentUser.getIdToken();
          const res = await fetch('/api/exams/grade', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              examId,
              sealedKeyToken: examData.sealedKeyToken,
              answers: latest.answers || {},
              passingScore: examData.settings.passingScore,
              includeKeyBreakdown: false,
            }),
          });
          if (res.ok) {
            const d = await res.json();
            if (!d.pendingTeacherSync) setServerGrade(d);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `exams/${examId}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, profile?.uid]);

  const latest = attempts[0];
  const hasAnswerKeys = Object.keys(answerKeys).length > 0;
  const computedFromKeys =
    latest && hasAnswerKeys
      ? gradeAttempt(questions, answerKeys, latest.answers || {}, exam?.settings.passingScore)
      : null;

  const canSeeScore =
    exam?.resultsReleased ||
    exam?.settings.resultsPolicy === 'answers_immediate' ||
    exam?.settings.resultsPolicy === 'score_immediate';

  const canSeeBreakdown =
    exam?.resultsReleased || exam?.settings.resultsPolicy === 'answers_immediate';

  const displayPercentage =
    typeof latest?.percentage === 'number'
      ? latest.percentage
      : computedFromKeys?.percentage ?? serverGrade?.percentage;
  const displayScore =
    typeof latest?.score === 'number'
      ? latest.score
      : computedFromKeys?.score ?? serverGrade?.score;
  const displayMax =
    typeof latest?.maxScore === 'number'
      ? latest.maxScore
      : computedFromKeys?.maxScore ?? serverGrade?.maxScore;
  const displayCorrect =
    typeof latest?.correctCount === 'number'
      ? latest.correctCount
      : computedFromKeys?.correctCount ?? serverGrade?.correctCount;
  const displayPassed =
    typeof latest?.passed === 'boolean'
      ? latest.passed
      : computedFromKeys?.passed ?? serverGrade?.passed;

  return (
    <AppShell requiredRole="student" title={`Hasil Ujian · ${exam?.title || ''}`}>
      <div className="max-w-3xl space-y-6">
        <Link
          href="/student"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Dashboard
        </Link>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat hasil ujian...</div>
        ) : !exam || !latest ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-sm text-slate-600">
            Belum ada pengumpulan ujian yang selesai.
          </div>
        ) : (
          <>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
              <p className="text-xs font-semibold text-blue-700">{exam.subject}</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{exam.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Dikirim pada {formatWIB(latest.submittedAt, exam.settings.timezone)} · Percobaan ke-{latest.attemptNumber}
              </p>

              {!canSeeScore ? (
                <div className="mt-6 p-5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3 text-sm text-slate-700">
                  <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">Jawaban Anda Berhasil Dikirim</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Nilai, kunci jawaban, dan pembahasan akan tersedia setelah guru merilis hasil
                      ujian.
                    </p>
                  </div>
                </div>
              ) : typeof displayPercentage !== 'number' ? (
                <div className="mt-6 p-5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                  Jawaban Anda telah tercatat. Nilai sedang disinkronkan oleh guru dan akan segera
                  muncul di sini.
                </div>
              ) : (
                <div className="mt-6 pt-6 border-t border-stone-200 grid sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Nilai Akhir (0–100)</p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
                      {displayPercentage}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Poin &amp; Benar</p>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {displayScore} / {displayMax} ({displayCorrect} soal)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status Kelulusan</p>
                    <p
                      className={`text-lg font-bold mt-1 ${
                        displayPassed === true
                          ? 'text-emerald-700'
                          : displayPassed === false
                            ? 'text-red-700'
                            : 'text-slate-900'
                      }`}
                    >
                      {displayPassed === true
                        ? `Lulus (KKM ${exam.settings.passingScore})`
                        : displayPassed === false
                          ? `Belum Lulus (KKM ${exam.settings.passingScore})`
                          : 'Selesai Dinilai'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {canSeeBreakdown && (hasAnswerKeys || serverGrade?.breakdown) && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">
                  Tinjauan Jawaban &amp; Pembahasan
                </h3>
                {questions.map((q, idx) => {
                  const chosenId = latest.answers?.[q.id]?.optionId || null;
                  const keyInfo = answerKeys[q.id] || serverGrade?.breakdown?.[q.id];
                  const isCorrect =
                    q.voided === 'all_correct' ||
                    (keyInfo && chosenId === keyInfo.correctOptionId);

                  return (
                    <div key={q.id} className="bg-white border border-stone-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-slate-700">Soal {idx + 1}</span>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isCorrect ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Keliru
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 mb-3">
                        <MathText text={q.text} />
                      </div>
                      {q.imageURL && (
                        <div className="mb-3">
                          <QuestionImage
                            src={q.imageURL}
                            alt={`Ilustrasi soal ${idx + 1}`}
                            className="max-h-60 rounded-xl border border-stone-200 object-contain"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => {
                          const isKey = keyInfo?.correctOptionId === opt.id;
                          const isChosen = chosenId === opt.id;
                          return (
                            <div
                              key={opt.id}
                              className={`px-3 py-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                                isKey
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : isChosen
                                    ? 'border-red-300 bg-red-50 text-red-900'
                                    : 'border-stone-200 text-slate-700'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <span>
                                  <strong>{LABELS[oIdx]}.</strong> <MathText text={opt.text} />
                                </span>
                                {opt.imageURL && (
                                  <QuestionImage
                                    src={opt.imageURL}
                                    alt={`Gambar opsi ${LABELS[oIdx]}`}
                                    className="mt-1.5 max-h-32 rounded-lg border border-stone-200 object-contain bg-white"
                                  />
                                )}
                              </div>
                              <span className="font-semibold shrink-0">
                                {isKey && 'Kunci'}
                                {isKey && isChosen ? ' · ' : ''}
                                {isChosen && 'Jawaban Anda'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {keyInfo?.explanation && (
                        <div className="mt-3 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-slate-700">
                          <strong>Pembahasan:</strong> <MathText text={keyInfo.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
