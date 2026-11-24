'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { MathText } from '@/components/MathText';
import { QuestionImage } from '@/components/QuestionImage';
import { db } from '@/lib/firebase/client';
import type { AnswerKey, ExamAttempt, ExamQuestion } from '@/lib/types';

const LABELS = ['A', 'B', 'C', 'D', 'E'];

export default function TeacherStudentAttemptDetailPage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [keys, setKeys] = useState<Record<string, AnswerKey>>({});

  useEffect(() => {
    if (!examId || !attemptId) return;
    const u1 = onSnapshot(doc(db, 'exams', examId, 'attempts', attemptId), (s) => {
      if (s.exists()) setAttempt({ id: s.id, ...(s.data() as Omit<ExamAttempt, 'id'>) });
    });
    const u2 = onSnapshot(collection(db, 'exams', examId, 'questions'), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) }));
      list.sort((a, b) => a.order - b.order);
      setQuestions(list);
    });
    const u3 = onSnapshot(collection(db, 'exams', examId, 'answerKeys'), (s) => {
      const m: Record<string, AnswerKey> = {};
      s.docs.forEach((d) => {
        m[d.id] = d.data() as AnswerKey;
      });
      setKeys(m);
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, [examId, attemptId]);

  return (
    <AppShell requiredRole="teacher" title="Detail Jawaban Siswa">
      <div className="max-w-3xl space-y-6">
        <Link
          href={`/teacher/exams/${examId}/results`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Rekap Nilai
        </Link>

        {attempt && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {attempt.studentName || attempt.studentId}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nilai: <strong className="tabular-nums">{attempt.percentage ?? '—'}</strong> ·
                Benar: <strong className="tabular-nums">{attempt.correctCount ?? 0}</strong> soal
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const chosenId = attempt?.answers?.[q.id]?.optionId || null;
            const key = keys[q.id];
            const isCorrect = q.voided === 'all_correct' || (key && chosenId === key.correctOptionId);
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
                    const isKey = key?.correctOptionId === opt.id;
                    const isStudentChoice = chosenId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={`px-3 py-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                          isKey
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : isStudentChoice
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
                        <span className="shrink-0 font-semibold">
                          {isKey && 'Kunci'}
                          {isKey && isStudentChoice ? ' · ' : ''}
                          {isStudentChoice && 'Pilihan Siswa'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
