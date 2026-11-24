'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Download, CheckCircle2, Unlock } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { MathText } from '@/components/MathText';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { analyzeExamItems, buildCsv, gradeAttempt } from '@/lib/grading';
import { formatDurationMs, formatWIB, normalizeTimezone } from '@/lib/time';
import { notifyClassStudents, regradeAllSubmittedAttempts } from '@/lib/exam-helpers';
import type { AnswerKey, AttemptEvent, Exam, ExamAttempt, ExamQuestion, QuestionVoidStatus } from '@/lib/types';

export default function TeacherExamResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKey>>({});
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [tab, setTab] = useState<'scores' | 'items'>('scores');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!examId) return;
    const unsubExam = onSnapshot(doc(db, 'exams', examId), (snap) => {
      if (snap.exists()) setExam({ id: snap.id, ...(snap.data() as Omit<Exam, 'id'>) });
    });
    const unsubQ = onSnapshot(collection(db, 'exams', examId, 'questions'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) }));
      list.sort((a, b) => a.order - b.order);
      setQuestions(list);
    });
    const unsubK = onSnapshot(collection(db, 'exams', examId, 'answerKeys'), (snap) => {
      const m: Record<string, AnswerKey> = {};
      snap.docs.forEach((d) => {
        m[d.id] = d.data() as AnswerKey;
      });
      setAnswerKeys(m);
    });
    const unsubA = onSnapshot(
      collection(db, 'exams', examId, 'attempts'),
      (snap) => {
        setAttempts(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamAttempt, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `exams/${examId}/attempts`)
    );

    return () => {
      unsubExam();
      unsubQ();
      unsubK();
      unsubA();
    };
  }, [examId]);

  const passingScore = exam?.settings.passingScore;
  const submittedAttempts = useMemo(() => {
    return attempts
      .filter((a) => a.status === 'submitted')
      .map((att) => {
        if (typeof att.percentage === 'number') return att;
        const calc = gradeAttempt(
          questions,
          answerKeys,
          att.answers || {},
          passingScore
        );
        return { ...att, ...calc };
      })
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  }, [attempts, questions, answerKeys, passingScore]);

  // Persist ungraded attempts automatically
  useEffect(() => {
    if (!exam || questions.length === 0 || Object.keys(answerKeys).length === 0) return;
    const ungraded = attempts.filter((a) => a.status === 'submitted' && !a.gradedAt);
    if (ungraded.length > 0) {
      regradeAllSubmittedAttempts(examId, exam, questions, answerKeys, ungraded).catch(() => {});
    }
  }, [examId, exam, questions, answerKeys, attempts]);

  const stats = useMemo(() => {
    if (submittedAttempts.length === 0) {
      return { avg: 0, max: 0, min: 0, passRate: 0 };
    }
    const vals = submittedAttempts.map((a) => a.percentage || 0);
    const avg = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const passed = submittedAttempts.filter((a) => a.passed).length;
    const passRate = Math.round((passed / submittedAttempts.length) * 100);
    return { avg, max, min, passRate };
  }, [submittedAttempts]);

  const itemAnalysis = useMemo(() => {
    return analyzeExamItems(questions, answerKeys, submittedAttempts);
  }, [questions, answerKeys, submittedAttempts]);

  const handleReleaseResults = async () => {
    if (!exam) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'exams', examId), {
        resultsReleased: true,
        updatedAt: serverTimestamp(),
      });
      await regradeAllSubmittedAttempts(
        examId,
        { ...exam, resultsReleased: true },
        questions,
        answerKeys,
        attempts
      );
      await notifyClassStudents(
        exam.classIds,
        `Hasil & Pembahasan Dirilis: ${exam.title}`,
        'Kunci jawaban dan pembahasan ujian sekarang tersedia untuk ditinjau.',
        `/student/exams/${examId}/result`
      );
      setNotice('Hasil, kunci jawaban, dan pembahasan telah dirilis kepada siswa.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleVoidQuestion = async (qId: string, voided: QuestionVoidStatus) => {
    if (!exam) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, 'exams', examId, 'questions', qId), { voided });
      const nextQuestions = questions.map((q) => (q.id === qId ? { ...q, voided } : q));
      const count = await regradeAllSubmittedAttempts(
        examId,
        exam,
        nextQuestions,
        answerKeys,
        attempts
      );
      setNotice(`Soal diperbarui dan ${count} nilai siswa telah dihitung ulang.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/questions/${qId}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadScoresCsv = () => {
    const activeTz = normalizeTimezone(exam?.settings?.timezone || profile?.timezone);
    const csv = buildCsv(
      ['Nama Siswa', 'NIS', 'Percobaan', 'Skor', 'Skor Maksimal', 'Nilai (0-100)', 'Status', 'Pelanggaran', `Waktu Kirim (${activeTz})`],
      submittedAttempts.map((a) => [
        a.studentName || a.studentId,
        a.studentNumber || '',
        a.attemptNumber,
        a.score ?? 0,
        a.maxScore ?? 0,
        a.percentage ?? 0,
        typeof a.passed === 'boolean' ? (a.passed ? 'Lulus' : 'Tidak Lulus') : 'Selesai',
        a.violations,
        formatWIB(a.submittedAt, activeTz),
      ])
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-nilai-${examId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadViolationsCsv = async () => {
    setBusy(true);
    try {
      const sorted = [...attempts].sort((a, b) => (b.violations || 0) - (a.violations || 0));
      const rows: (string | number)[][] = [];
      for (const att of sorted) {
        if (!att.id) continue;
        const evSnap = await getDocs(
          query(collection(db, 'exams', examId, 'attempts', att.id, 'events'), orderBy('at', 'asc'))
        );
        if (evSnap.empty) {
          rows.push([
            att.studentName || att.studentId,
            att.studentNumber || '',
            att.attemptNumber,
            att.violations || 0,
            att.flaggedForReview ? 'Ditandai' : 'Normal',
            '-',
            '-',
            '-',
          ]);
        } else {
          evSnap.docs.forEach((evDoc) => {
            const ev = evDoc.data() as AttemptEvent;
            rows.push([
              att.studentName || att.studentId,
              att.studentNumber || '',
              att.attemptNumber,
              att.violations || 0,
              att.flaggedForReview ? 'Ditandai' : 'Normal',
              ev.type,
              ev.durationAwayMs ? formatDurationMs(ev.durationAwayMs) : '',
              formatWIB(ev.at, exam?.settings?.timezone || profile?.timezone),
            ]);
          });
        }
      }
      const activeTz = normalizeTimezone(exam?.settings?.timezone || profile?.timezone);
      const csv = buildCsv(
        ['Nama Siswa', 'NIS', 'Percobaan', 'Total Pelanggaran', 'Status Tinjauan', 'Jenis Kejadian', 'Durasi Di Luar Layar', `Waktu (${activeTz})`],
        rows
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `log-pelanggaran-${examId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `exams/${examId}/attempts`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requiredRole="teacher" title={`Rekap & Analisis · ${exam?.title || ''}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/teacher/exams/${examId}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Editor Ujian
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {exam && !exam.resultsReleased && (
              <button
                type="button"
                disabled={busy}
                onClick={handleReleaseResults}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
              >
                <Unlock className="w-3.5 h-3.5" />
                Rilis Kunci &amp; Pembahasan
              </button>
            )}
            <button
              type="button"
              onClick={downloadScoresCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-slate-700 hover:bg-stone-50"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV Nilai
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={downloadViolationsCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-slate-700 hover:bg-stone-50"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV Pelanggaran
            </button>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{notice}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Rata-rata Nilai</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stats.avg}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Nilai Tertinggi</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{stats.max}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Nilai Terendah</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stats.min}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">
              {typeof exam?.settings.passingScore === 'number'
                ? `Persentase Lulus (KKM ${exam.settings.passingScore})`
                : 'Total Pengumpulan'}
            </p>
            <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
              {typeof exam?.settings.passingScore === 'number'
                ? `${stats.passRate}%`
                : submittedAttempts.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('scores')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              tab === 'scores'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-stone-200 text-slate-600'
            }`}
          >
            Rekap Nilai Siswa ({submittedAttempts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('items')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              tab === 'items'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-stone-200 text-slate-600'
            }`}
          >
            Analisis Butir Soal ({questions.length})
          </button>
        </div>

        {tab === 'scores' ? (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-5 py-3 font-semibold">NIS</th>
                    <th className="px-5 py-3 font-semibold">Benar</th>
                    <th className="px-5 py-3 font-semibold">Nilai</th>
                    <th className="px-5 py-3 font-semibold">Pelanggaran</th>
                    <th className="px-5 py-3 font-semibold">Dikirim</th>
                    <th className="px-5 py-3 font-semibold text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {submittedAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                        Belum ada siswa yang mengumpulkan ujian.
                      </td>
                    </tr>
                  ) : (
                    submittedAttempts.map((att) => (
                      <tr key={att.id} className="hover:bg-stone-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {att.studentName || att.studentId}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500 tabular-nums">
                          {att.studentNumber || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                          {att.correctCount ?? 0} / {questions.length}
                        </td>
                        <td className="px-5 py-3.5 font-bold tabular-nums">
                          <span
                            className={
                              typeof att.passed === 'boolean'
                                ? att.passed
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                                : 'text-slate-900'
                            }
                          >
                            {att.percentage ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                          {att.violations}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {formatWIB(att.submittedAt, exam?.settings?.timezone || profile?.timezone)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/teacher/exams/${examId}/results/${att.id}`}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Lihat Jawaban
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {itemAnalysis.map((item, idx) => (
              <div key={item.questionId} className="bg-white border border-stone-200 rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">
                      Soal {idx + 1} · Tingkat Benar:{' '}
                      <strong className="text-slate-900 tabular-nums">{item.correctRate}%</strong> (
                      {item.correctResponses}/{item.totalResponses} siswa)
                    </p>
                    <div className="text-sm font-semibold text-slate-900">
                      <MathText text={item.text} />
                    </div>
                  </div>
                  <select
                    disabled={busy}
                    value={item.voided || 'none'}
                    onChange={(e) =>
                      handleVoidQuestion(item.questionId, e.target.value as QuestionVoidStatus)
                    }
                    className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                  >
                    <option value="none">Normal (sesuai kunci)</option>
                    <option value="all_correct">Beri poin semua siswa</option>
                    <option value="excluded">Keluarkan dari penilaian</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {item.optionDistribution.map((opt) => (
                    <div key={opt.optionId} className="flex items-center gap-3 text-xs">
                      <span
                        className={`w-6 font-bold ${
                          opt.isCorrect ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <div className="flex-1 bg-stone-100 rounded-md h-7 relative overflow-hidden flex items-center px-3">
                        <div
                          className={`absolute inset-y-0 left-0 ${
                            opt.isCorrect ? 'bg-emerald-200/70' : 'bg-stone-200/80'
                          }`}
                          style={{ width: `${opt.percentage}%` }}
                        />
                        <span className="relative z-10 text-slate-800 truncate">
                          <MathText text={opt.text} />
                        </span>
                      </div>
                      <span className="w-20 text-right font-mono tabular-nums text-slate-600">
                        {opt.count} ({opt.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
