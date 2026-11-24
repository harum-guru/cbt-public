'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flag, AlertTriangle, RotateCcw, Send } from 'lucide-react';
import { MathText } from './MathText';

interface DemoQuestion {
  id: string;
  subject: string;
  text: string;
  options: Array<{ id: string; label: string; text: string }>;
  correctId: string;
  explanation: string;
}

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: 'q1',
    subject: 'Matematika Wajib',
    text: 'Hitung nilai integral tentu dari $\\int_0^2 3x^2 \\, dx$.',
    options: [
      { id: 'a', label: 'A', text: '$4$' },
      { id: 'b', label: 'B', text: '$6$' },
      { id: 'c', label: 'C', text: '$8$' },
      { id: 'd', label: 'D', text: '$12$' },
    ],
    correctId: 'c',
    explanation: 'Antiturunan dari $3x^2$ adalah $x^3$. Evaluasi $[x^3]_0^2 = 2^3 - 0^3 = 8$.',
  },
  {
    id: 'q2',
    subject: 'Fisika',
    text: 'Benda bermassa $2\\text{ kg}$ bergerak dengan percepatan $3\\text{ m/s}^2$. Besar gaya total yang bekerja adalah:',
    options: [
      { id: 'a', label: 'A', text: '$1{,}5\\text{ N}$' },
      { id: 'b', label: 'B', text: '$5\\text{ N}$' },
      { id: 'c', label: 'C', text: '$6\\text{ N}$' },
      { id: 'd', label: 'D', text: '$9\\text{ N}$' },
    ],
    correctId: 'c',
    explanation: 'Berdasarkan Hukum II Newton, $F = m \\times a = 2\\text{ kg} \\times 3\\text{ m/s}^2 = 6\\text{ N}$.',
  },
  {
    id: 'q3',
    subject: 'Bahasa Indonesia',
    text: 'Penulisan kata baku yang tepat dalam kalimat resmi adalah:',
    options: [
      { id: 'a', label: 'A', text: 'analisa hasil laboratorium' },
      { id: 'b', label: 'B', text: 'analisis hasil laboratorium' },
      { id: 'c', label: 'C', text: 'apotik di depan sekolah' },
      { id: 'd', label: 'D', text: 'resiko kegagalan sistem' },
    ],
    correctId: 'b',
    explanation: 'Menurut KBBI, bentuk baku yang benar adalah "analisis", "apotek", dan "risiko".',
  },
];

export function LandingInteractiveDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [violations, setViolations] = useState(0);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600);

  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  const current = DEMO_QUESTIONS[activeIdx];
  const answeredCount = Object.keys(answers).length;
  const correctCount = DEMO_QUESTIONS.filter((q) => answers[q.id] === q.correctId).length;
  const score = Math.round((correctCount / DEMO_QUESTIONS.length) * 100);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const triggerSimulatedTabSwitch = () => {
    if (submitted) return;
    setViolations((v) => v + 1);
    setLastWarning('Anda berpindah tab; aktivitas ini dicatat dengan stempel waktu.');
  };

  const resetDemo = () => {
    setActiveIdx(0);
    setAnswers({});
    setFlagged({});
    setViolations(0);
    setLastWarning(null);
    setSubmitted(false);
    setSecondsLeft(600);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-300">Simulasi Lembar Ujian · XI IPA 2</p>
          <p className="text-sm font-semibold mt-0.5">Tryout Harian Terpadu (3 Soal)</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={triggerSimulatedTabSwitch}
            disabled={submitted}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            Simulasi Pindah Tab
          </button>
          <div className="font-mono text-sm font-semibold tabular-nums bg-slate-800 px-3 py-1.5 rounded-lg">
            {mins}:{secs}
          </div>
        </div>
      </div>

      {lastWarning && !submitted && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {lastWarning} (Total pelanggaran: <strong className="tabular-nums">{violations}</strong>)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastWarning(null)}
            className="text-amber-800 underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {!submitted ? (
        <div className="p-6 sm:p-8 grid lg:grid-cols-[1fr_240px] gap-8">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4 text-xs text-slate-500">
              <span>
                Soal {activeIdx + 1} dari {DEMO_QUESTIONS.length} · {current.subject}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => ({ ...prev, [current.id]: !prev[current.id] }))
                }
                className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                  flagged[current.id] ? 'text-amber-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {flagged[current.id] ? 'Ditandai ragu-ragu' : 'Tandai ragu-ragu'}
              </button>
            </div>

            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed mb-6">
              <MathText text={current.text} />
            </div>

            <div className="space-y-3">
              {current.options.map((opt) => {
                const selected = answers[current.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: opt.id }))}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors flex items-center gap-3 ${
                      selected
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                        : 'border-stone-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 ${
                        selected ? 'bg-blue-700 text-white' : 'bg-stone-100 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-sm sm:text-base">
                      <MathText text={opt.text} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-40"
              >
                Sebelumnya
              </button>

              {activeIdx < DEMO_QUESTIONS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveIdx((i) => Math.min(DEMO_QUESTIONS.length - 1, i + 1))}
                  className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Soal Berikutnya
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubmitted(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  <Send className="w-4 h-4" />
                  Kirim Jawaban
                </button>
              )}
            </div>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-stone-200 pt-6 lg:pt-0 lg:pl-6 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-900 mb-3">Navigasi Soal</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_QUESTIONS.map((q, idx) => {
                  const isAnswered = Boolean(answers[q.id]);
                  const isFlagged = Boolean(flagged[q.id]);
                  const isCurrent = idx === activeIdx;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className={`h-10 rounded-lg text-sm font-semibold tabular-nums border transition-colors ${
                        isCurrent
                          ? 'border-blue-700 ring-2 ring-blue-700/20'
                          : 'border-stone-200'
                      } ${
                        isFlagged
                          ? 'bg-amber-100 text-amber-900'
                          : isAnswered
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-stone-50 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <p>Terjawab: {answeredCount} dari {DEMO_QUESTIONS.length}</p>
                <p>Pelanggaran tercatat: {violations}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="w-full py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              Selesai &amp; Nilai Otomatis
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Penilaian Otomatis Selesai Seketika
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                Skor Akhir: {score} / 100
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Benar {correctCount} dari {DEMO_QUESTIONS.length} soal · Pelanggaran pindah tab: {violations}
              </p>
            </div>
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-stone-200 rounded-lg text-slate-700 hover:bg-stone-50"
            >
              <RotateCcw className="w-4 h-4" />
              Ulangi Simulasi
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {DEMO_QUESTIONS.map((q, idx) => {
              const userAns = answers[q.id];
              const isCorrect = userAns === q.correctId;
              const chosenOpt = q.options.find((o) => o.id === userAns);
              const correctOpt = q.options.find((o) => o.id === q.correctId);
              return (
                <div key={q.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    <span className="font-semibold text-slate-700">
                      Soal {idx + 1} · {q.subject}
                    </span>
                    <span className={isCorrect ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                      {isCorrect ? 'Benar' : userAns ? 'Keliru' : 'Tidak dijawab'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-900 mb-2">
                    <MathText text={q.text} />
                  </p>
                  <p className="text-xs text-slate-600">
                    Jawaban Anda: <strong>{chosenOpt ? <MathText text={chosenOpt.text} /> : '—'}</strong> · Kunci:{' '}
                    <strong className="text-emerald-700">
                      {correctOpt ? <MathText text={correctOpt.text} /> : '—'}
                    </strong>
                  </p>
                  <p className="text-xs text-slate-600 mt-1.5">
                    Pembahasan: <MathText text={q.explanation} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
