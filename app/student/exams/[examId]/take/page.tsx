'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  Maximize2,
  Send,
  WifiOff,
} from 'lucide-react';
import { MathText } from '@/components/MathText';
import { QuestionImage } from '@/components/QuestionImage';
import { useAuth } from '@/components/AuthProvider';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatCountdown } from '@/lib/time';
import type {
  AttemptEventType,
  Exam,
  ExamAttempt,
  ExamQuestion,
  StudentAnswerEntry,
} from '@/lib/types';

const LABELS = ['A', 'B', 'C', 'D', 'E'];

export default function StudentExamTakePage() {
  const { examId } = useParams<{ examId: string }>();
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, ExamQuestion>>({});
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerEntry>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const awayStartRef = useRef<number | null>(null);
  const lastViolationAtRef = useRef<number>(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  const localQueueKey = attempt?.id ? `ujianku_queue_${examId}_${attempt.id}` : null;

  // Load exam, questions, and active attempt
  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser || !profile) {
      router.replace('/login');
      return;
    }

    let unsubAttempt: (() => void) | undefined;

    (async () => {
      try {
        const examSnap = await getDoc(doc(db, 'exams', examId));
        if (!examSnap.exists()) {
          router.replace('/student');
          return;
        }
        const examData = { id: examSnap.id, ...(examSnap.data() as Omit<Exam, 'id'>) };
        setExam(examData);

        const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
        const qMap: Record<string, ExamQuestion> = {};
        qSnap.docs.forEach((d) => {
          qMap[d.id] = { id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) };
        });
        setQuestionsMap(qMap);

        const attSnap = await getDocs(
          query(
            collection(db, 'exams', examId, 'attempts'),
            where('studentId', '==', profile.uid),
            where('status', '==', 'in_progress')
          )
        );
        if (attSnap.empty) {
          router.replace(`/student/exams/${examId}/result`);
          return;
        }

        const firstDoc = attSnap.docs[0];
        const queueKey = `ujianku_queue_${examId}_${firstDoc.id}`;
        unsubAttempt = onSnapshot(
          doc(db, 'exams', examId, 'attempts', firstDoc.id),
          (snap) => {
            if (!snap.exists()) return;
            const data = { id: snap.id, ...(snap.data() as Omit<ExamAttempt, 'id'>) };
            setAttempt(data);
            setAnswers((prev) => {
              if (Object.keys(prev).length === 0) {
                let queuedParsed: Record<string, StudentAnswerEntry> = {};
                if (typeof window !== 'undefined') {
                  const queued = window.localStorage.getItem(queueKey);
                  if (queued) {
                    try {
                      queuedParsed = JSON.parse(queued) as Record<string, StudentAnswerEntry>;
                    } catch {
                      // ignore
                    }
                  }
                }
                return { ...(data.answers || {}), ...queuedParsed };
              }
              return prev;
            });
            if (data.status === 'submitted' && !submittingRef.current) {
              router.replace(`/student/exams/${examId}/result`);
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, `exams/${examId}/attempts/${firstDoc.id}`)
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `exams/${examId}`);
      }
    })();

    return () => {
      if (unsubAttempt) unsubAttempt();
    };
  }, [authLoading, firebaseUser, profile, examId, router]);

  const attemptId = attempt?.id;
  const attemptStatus = attempt?.status;
  const attemptViolations = attempt?.violations || 0;
  const attemptFlagged = attempt?.flaggedForReview || false;
  const profileUid = profile?.uid;

  const flushAnswers = useCallback(
    async (nextAnswers: Record<string, StudentAnswerEntry>) => {
      if (!attemptId || attemptStatus !== 'in_progress') return;
      setSaveState('saving');
      const answeredCount = Object.values(nextAnswers).filter((e) => e.optionId !== null).length;
      try {
        await updateDoc(doc(db, 'exams', examId, 'attempts', attemptId), {
          answers: nextAnswers,
          answeredCount,
          lastHeartbeatAt: serverTimestamp(),
          presence: 'online',
        });
        if (localQueueKey && typeof window !== 'undefined') {
          window.localStorage.removeItem(localQueueKey);
        }
        setSaveState('saved');
      } catch {
        if (localQueueKey && typeof window !== 'undefined') {
          window.localStorage.setItem(localQueueKey, JSON.stringify(nextAnswers));
        }
        setSaveState('offline');
      }
    },
    [attemptId, attemptStatus, examId, localQueueKey]
  );

  // Retry flush when browser comes back online
  useEffect(() => {
    const onOnline = () => {
      if (localQueueKey && typeof window !== 'undefined') {
        const queued = window.localStorage.getItem(localQueueKey);
        if (queued) {
          try {
            flushAnswers(JSON.parse(queued));
          } catch {
            // ignore
          }
        }
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [localQueueKey, flushAnswers]);

  const handleSubmitExam = useCallback(
    async (reason?: string) => {
      if (submittingRef.current || !attemptId || !exam) return;
      submittingRef.current = true;
      setSubmitting(true);

      const answeredCount = Object.values(answers).filter((e) => e.optionId !== null).length;
      try {
        await updateDoc(doc(db, 'exams', examId, 'attempts', attemptId), {
          answers,
          answeredCount,
          status: 'submitted',
          submittedAt: serverTimestamp(),
          lastHeartbeatAt: serverTimestamp(),
          presence: 'online',
        });

        if (localQueueKey && typeof window !== 'undefined') {
          window.localStorage.removeItem(localQueueKey);
        }

        // Request server-side immediate scoring when sealedKeyToken exists and policy allows
        if (exam.sealedKeyToken && exam.settings.resultsPolicy !== 'after_release' && auth.currentUser) {
          try {
            const idToken = await auth.currentUser.getIdToken();
            const gradeRes = await fetch('/api/exams/grade', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                examId,
                sealedKeyToken: exam.sealedKeyToken,
                answers,
                passingScore: exam.settings.passingScore,
                includeKeyBreakdown:
                  exam.resultsReleased || exam.settings.resultsPolicy === 'answers_immediate',
              }),
            });
            if (gradeRes.ok) {
              const gradeData = await gradeRes.json();
              if (!gradeData.pendingTeacherSync && typeof window !== 'undefined') {
                window.sessionStorage.setItem(
                  `ujianku_grade_${examId}_${attemptId}`,
                  JSON.stringify({ ...gradeData, reason })
                );
              }
            }
          } catch {
            // Fallback to teacher sync
          }
        }

        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        router.replace(`/student/exams/${examId}/result`);
      } catch (err) {
        submittingRef.current = false;
        setSubmitting(false);
        handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/attempts/${attemptId}`);
      }
    },
    [attemptId, exam, examId, answers, localQueueKey, router]
  );

  // Countdown tick + auto-submit on deadline
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const t = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      const deadlineMs = attempt.deadline?.toMillis?.() || 0;
      if (deadlineMs > 0 && now >= deadlineMs && !submittingRef.current) {
        handleSubmitExam('Waktu pengerjaan telah habis.');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [attempt, handleSubmitExam]);

  // Heartbeat every 15 seconds
  useEffect(() => {
    if (!attempt?.id || attempt.status !== 'in_progress') return;
    const interval = setInterval(() => {
      updateDoc(doc(db, 'exams', examId, 'attempts', attempt.id!), {
        lastHeartbeatAt: serverTimestamp(),
        presence: 'online',
      }).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [attempt?.id, attempt?.status, examId]);

  const recordEvent = useCallback(
    async (type: AttemptEventType, countsAsViolation: boolean, durationAwayMs?: number) => {
      if (!attemptId || attemptStatus !== 'in_progress' || !profileUid || submittingRef.current) {
        return;
      }
      try {
        await addDoc(collection(db, 'exams', examId, 'attempts', attemptId, 'events'), {
          studentId: profileUid,
          type,
          at: serverTimestamp(),
          ...(durationAwayMs ? { durationAwayMs } : {}),
        });

        if (countsAsViolation) {
          const now = Date.now();
          // Business Rule 10: coalesce consecutive violation events within 1 second
          if (now - lastViolationAtRef.current < 1000) return;
          lastViolationAtRef.current = now;

          const nextViolations = attemptViolations + 1;
          const limit = exam?.settings.proctoring?.violationLimit;
          const exceeded = typeof limit === 'number' && nextViolations >= limit;

          await updateDoc(doc(db, 'exams', examId, 'attempts', attemptId), {
            violations: nextViolations,
            flaggedForReview: exceeded || attemptFlagged,
            lastHeartbeatAt: serverTimestamp(),
            presence: 'online',
          });

          setWarningMsg(
            `Perhatian: Aktivitas meninggalkan layar/fokus tercatat (${nextViolations} kali).`
          );

          if (exceeded && exam?.settings.proctoring?.onLimitReached === 'auto_submit') {
            handleSubmitExam('Batas pelanggaran terlampaui.');
          }
        }
      } catch {
        // Ignore transient network errors while logging
      }
    },
    [attemptId, attemptStatus, attemptViolations, attemptFlagged, exam, examId, profileUid, handleSubmitExam]
  );

  // Tab switch, blur, fullscreen & copy-paste proctoring listeners
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || !exam) return;
    const proc = exam.settings.proctoring;

    const handleVisibility = () => {
      if (!proc?.detectTabSwitch) return;
      if (document.hidden) {
        awayStartRef.current = Date.now();
        recordEvent('tab_hidden', true);
      } else {
        const dur = awayStartRef.current ? Date.now() - awayStartRef.current : undefined;
        awayStartRef.current = null;
        recordEvent('tab_visible', false, dur);
      }
    };

    const handleBlur = () => {
      if (!proc?.detectTabSwitch || document.hidden) return;
      awayStartRef.current = Date.now();
      recordEvent('window_blur', true);
    };

    const handleFocus = () => {
      if (!proc?.detectTabSwitch) return;
      if (awayStartRef.current) {
        const dur = Date.now() - awayStartRef.current;
        awayStartRef.current = null;
        recordEvent('window_focus', false, dur);
      }
    };

    const handleFullscreen = () => {
      const full = Boolean(document.fullscreenElement);
      setIsFullscreen(full);
      if (proc?.requireFullscreen && !full) {
        recordEvent('fullscreen_exit', true);
      }
    };

    const handlePageHide = () => {
      recordEvent('page_unload', false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [attempt, exam, recordEvent]);

  const orderedQuestions = useMemo(() => {
    if (!attempt) return [];
    return attempt.questionOrder
      .map((id) => questionsMap[id])
      .filter((q): q is ExamQuestion => Boolean(q));
  }, [attempt, questionsMap]);

  const updateAnswer = useCallback(
    (qId: string, optionId: string | null, flagged?: boolean) => {
      setAnswers((prev) => {
        const existingEntry = prev[qId] || { optionId: null, flagged: false, updatedAt: Date.now() };
        const next: Record<string, StudentAnswerEntry> = {
          ...prev,
          [qId]: {
            optionId: optionId !== undefined ? optionId : existingEntry.optionId,
            flagged: flagged !== undefined ? flagged : existingEntry.flagged,
            updatedAt: Date.now(),
          },
        };
        if (localQueueKey && typeof window !== 'undefined') {
          window.localStorage.setItem(localQueueKey, JSON.stringify(next));
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          flushAnswers(next);
        }, 450);
        return next;
      });
    },
    [flushAnswers, localQueueKey]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!exam?.settings.oneQuestionPerPage) return;
    const currentQ = orderedQuestions[activeIdx];
    const onKeyDown = (e: KeyboardEvent) => {
      if (showConfirmModal || !currentQ) return;
      if (e.key === 'ArrowRight' && activeIdx < orderedQuestions.length - 1) {
        setActiveIdx((i) => i + 1);
      } else if (
        e.key === 'ArrowLeft' &&
        exam.settings.allowBackNavigation &&
        activeIdx > 0
      ) {
        setActiveIdx((i) => i - 1);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const optOrder = attempt?.optionOrder?.[currentQ.id] || currentQ.options.map((o) => o.id);
        if (optOrder[idx]) {
          updateAnswer(currentQ.id, optOrder[idx]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    exam,
    orderedQuestions,
    activeIdx,
    attempt?.optionOrder,
    showConfirmModal,
    updateAnswer,
  ]);

  if (!exam || !attempt || orderedQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center text-sm text-slate-500">
        Menyiapkan lembar ujian...
      </div>
    );
  }

  const remainingMs = (attempt.deadline?.toMillis?.() || 0) - nowMs;
  const answeredCount = Object.values(answers).filter((e) => e.optionId !== null).length;
  const unansweredCount = orderedQuestions.length - answeredCount;
  const currentQ = orderedQuestions[activeIdx];
  const blockCopy = Boolean(exam.settings.proctoring?.blockCopyPaste);

  const renderQuestionCard = (q: ExamQuestion, displayNumber: number) => {
    const optIds = attempt.optionOrder?.[q.id] || q.options.map((o) => o.id);
    const orderedOpts = optIds
      .map((id) => q.options.find((o) => o.id === id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    const currentEntry = answers[q.id];

    return (
      <div
        key={q.id}
        onContextMenu={(e) => {
          if (blockCopy) e.preventDefault();
        }}
        onCopy={(e) => {
          if (blockCopy) {
            e.preventDefault();
            recordEvent('copy_attempt', false);
          }
        }}
        onPaste={(e) => {
          if (blockCopy) {
            e.preventDefault();
            recordEvent('paste_attempt', false);
          }
        }}
        className={`bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 ${
          blockCopy ? 'select-none' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-xs font-bold text-slate-500 tabular-nums">
            Soal {displayNumber} dari {orderedQuestions.length} · {q.points} poin
          </span>
          <button
            type="button"
            onClick={() =>
              updateAnswer(q.id, currentEntry?.optionId ?? null, !currentEntry?.flagged)
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              currentEntry?.flagged
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-stone-200 text-slate-600 hover:bg-stone-50'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            {currentEntry?.flagged ? 'Ditandai Ragu' : 'Tandai Ragu'}
          </button>
        </div>

        <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed mb-5">
          <MathText text={q.text} />
        </div>

        {q.imageURL && (
          <div className="mb-5">
            <QuestionImage
              src={q.imageURL}
              alt={`Ilustrasi soal ${displayNumber}`}
              className="max-h-72 rounded-xl border border-stone-200 object-contain"
            />
          </div>
        )}

        <div className="space-y-3">
          {orderedOpts.map((opt, idx) => {
            const selected = currentEntry?.optionId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => updateAnswer(q.id, opt.id, currentEntry?.flagged)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                  selected
                    ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                    : 'border-stone-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                    selected ? 'bg-blue-700 text-white' : 'bg-stone-100 text-slate-700'
                  }`}
                >
                  {LABELS[idx]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base">
                    <MathText text={opt.text} />
                  </div>
                  {opt.imageURL && (
                    <QuestionImage
                      src={opt.imageURL}
                      alt={`Gambar pilihan ${LABELS[idx]}`}
                      className="mt-2 max-h-40 rounded-lg border border-stone-200 object-contain bg-white"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Sticky Exam Top Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-300 truncate">{exam.subject}</p>
          <p className="text-sm font-bold truncate">{exam.title}</p>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300">
            {saveState === 'offline' ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                Offline (antrean lokal)
              </>
            ) : saveState === 'saving' ? (
              'Menyimpan...'
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Tersimpan
              </>
            )}
          </span>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold tabular-nums ${
              remainingMs < 300_000 ? 'bg-red-700 text-white' : 'bg-slate-800 text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            {formatCountdown(remainingMs)}
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Send className="w-3.5 h-3.5" />
            Kirim
          </button>
        </div>
      </header>

      {/* Warning & Fullscreen Banners */}
      {warningMsg && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{warningMsg}</span>
          </div>
          <button type="button" onClick={() => setWarningMsg(null)} className="underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      {exam.settings.proctoring?.requireFullscreen && !isFullscreen && (
        <div className="bg-red-50 border-b border-red-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 text-xs text-red-900">
          <span>Ujian ini mewajibkan mode layar penuh.</span>
          <button
            type="button"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 text-white font-semibold"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Masuk Layar Penuh
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 grid lg:grid-cols-[1fr_260px] gap-6 items-start">
        <div className="space-y-6">
          {exam.settings.oneQuestionPerPage ? (
            <>
              {currentQ && renderQuestionCard(currentQ, activeIdx + 1)}
              <div className="flex items-center justify-between gap-4">
                {exam.settings.allowBackNavigation ? (
                  <button
                    type="button"
                    disabled={activeIdx === 0}
                    onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-slate-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Navigasi satu arah aktif</span>
                )}

                {activeIdx < orderedQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIdx((i) => Math.min(orderedQuestions.length - 1, i + 1))
                    }
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                  >
                    Soal Berikutnya
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
                  >
                    Selesai &amp; Kirim Ujian
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {orderedQuestions.map((q, idx) => renderQuestionCard(q, idx + 1))}
            </div>
          )}
        </div>

        {/* Question Navigation Sidebar */}
        <aside className="bg-white border border-stone-200 rounded-2xl p-5 lg:sticky lg:top-24 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-900">Navigasi Nomor Soal</p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Terjawab {answeredCount} dari {orderedQuestions.length}
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {orderedQuestions.map((q, idx) => {
              const entry = answers[q.id];
              const isAnswered = Boolean(entry?.optionId);
              const isFlagged = Boolean(entry?.flagged);
              const isCurrent = exam.settings.oneQuestionPerPage && idx === activeIdx;
              const disabledJump =
                exam.settings.oneQuestionPerPage &&
                !exam.settings.allowBackNavigation &&
                idx < activeIdx;

              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={disabledJump}
                  onClick={() => {
                    if (exam.settings.oneQuestionPerPage) setActiveIdx(idx);
                  }}
                  className={`h-9 rounded-lg text-xs font-bold tabular-nums border transition-colors ${
                    isCurrent ? 'ring-2 ring-blue-700 border-blue-700' : 'border-stone-200'
                  } ${
                    isFlagged
                      ? 'bg-amber-100 text-amber-900'
                      : isAnswered
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-stone-50 text-slate-700'
                  } disabled:opacity-40`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-500 pt-2 border-t border-stone-100">
            <p>Biru: Sudah dijawab · Kuning: Ragu-ragu</p>
            <p className="tabular-nums">Pelanggaran tercatat: {attempt.violations}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="w-full py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
          >
            Kirim Jawaban
          </button>
        </aside>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Konfirmasi Kirim Ujian</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Setelah dikirim, jawaban Anda tidak dapat diubah kembali.
            </p>
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-sm space-y-1">
              <p>
                Soal terjawab: <strong className="tabular-nums">{answeredCount}</strong>
              </p>
              <p>
                Belum dijawab:{' '}
                <strong
                  className={`tabular-nums ${
                    unansweredCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {unansweredCount}
                </strong>
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-stone-200 text-sm font-semibold text-slate-700"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitExam()}
                className="px-5 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {submitting ? 'Mengirim...' : 'Ya, Kirim Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
