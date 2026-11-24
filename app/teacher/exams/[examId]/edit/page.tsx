'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Plus,
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Radio,
  BarChart3,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { MathText } from '@/components/MathText';
import { ImageUrlInput } from '@/components/ImageUrlInput';
import { QuestionImage } from '@/components/QuestionImage';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { questionSchema, examSettingsFormSchema } from '@/lib/validation';
import {
  normalizeTimezone,
  parseDatetimeLocalWIB,
  TIMEZONE_OPTIONS,
  toDatetimeLocalWIB,
} from '@/lib/time';
import {
  duplicateExamToDraft,
  notifyClassStudents,
  regradeAllSubmittedAttempts,
  sealExamKeysFromServer,
  syncExamRefsForClasses,
} from '@/lib/exam-helpers';
import type {
  AnswerKey,
  ClassRoom,
  Exam,
  ExamAttempt,
  ExamQuestion,
  IndonesianTimezone,
  QuestionBankItem,
  QuestionOption,
  QuestionVoidStatus,
  ResultsPolicy,
  ViolationLimitAction,
} from '@/lib/types';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

function newOptions(): QuestionOption[] {
  return [
    { id: 'opt_a', text: '' },
    { id: 'opt_b', text: '' },
    { id: 'opt_c', text: '' },
    { id: 'opt_d', text: '' },
  ];
}

export default function TeacherExamEditPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKey>>({});
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [bankItems, setBankItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'questions' | 'settings' | 'publish'>('questions');
  const [editingQId, setEditingQId] = useState<string | null>(null);

  // Question editor form state
  const [qText, setQText] = useState('');
  const [qImageURL, setQImageURL] = useState('');
  const [qOptions, setQOptions] = useState<QuestionOption[]>(newOptions);
  const [qCorrectId, setQCorrectId] = useState('opt_a');
  const [qPoints, setQPoints] = useState(1);
  const [qExplanation, setQExplanation] = useState('');
  const [qError, setQError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Bank import & CSV import modals
  const [showBankModal, setShowBankModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Settings tab state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<IndonesianTimezone>('WIB');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passingScore, setPassingScore] = useState('');
  const [resultsPolicy, setResultsPolicy] = useState<ResultsPolicy>('answers_immediate');
  const [allowBackNavigation, setAllowBackNavigation] = useState(true);
  const [oneQuestionPerPage, setOneQuestionPerPage] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(true);
  const [requireFullscreen, setRequireFullscreen] = useState(false);
  const [blockCopyPaste, setBlockCopyPaste] = useState(true);
  const [violationLimit, setViolationLimit] = useState('3');
  const [onLimitReached, setOnLimitReached] = useState<ViolationLimitAction>('flag_only');

  useEffect(() => {
    if (!examId || !profile?.uid) return;

    const unsubExam = onSnapshot(
      doc(db, 'exams', examId),
      (snap) => {
        if (!snap.exists()) {
          setExam(null);
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as Omit<Exam, 'id'>) };
        if (data.teacherId !== profile.uid) {
          setExam(null);
          setLoading(false);
          return;
        }
        setExam(data);
        setTitle(data.title);
        setSubject(data.subject);
        setDescription(data.description || '');
        setSelectedClassIds(data.classIds || []);
        const tz = normalizeTimezone(data.settings.timezone || profile.timezone);
        setTimezone(tz);
        setOpensAt(toDatetimeLocalWIB(data.settings.opensAt, tz));
        setClosesAt(toDatetimeLocalWIB(data.settings.closesAt, tz));
        setDurationMinutes(data.settings.durationMinutes);
        setShuffleQuestions(data.settings.shuffleQuestions);
        setShuffleOptions(data.settings.shuffleOptions);
        setMaxAttempts(data.settings.maxAttempts);
        setPassingScore(
          typeof data.settings.passingScore === 'number' ? String(data.settings.passingScore) : ''
        );
        setResultsPolicy(data.settings.resultsPolicy);
        setAllowBackNavigation(data.settings.allowBackNavigation);
        setOneQuestionPerPage(data.settings.oneQuestionPerPage);
        setDetectTabSwitch(data.settings.proctoring?.detectTabSwitch ?? true);
        setRequireFullscreen(data.settings.proctoring?.requireFullscreen ?? false);
        setBlockCopyPaste(data.settings.proctoring?.blockCopyPaste ?? true);
        setViolationLimit(
          typeof data.settings.proctoring?.violationLimit === 'number'
            ? String(data.settings.proctoring.violationLimit)
            : ''
        );
        setOnLimitReached(data.settings.proctoring?.onLimitReached || 'flag_only');
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `exams/${examId}`)
    );

    const unsubQ = onSnapshot(
      collection(db, 'exams', examId, 'questions'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) }));
        list.sort((a, b) => a.order - b.order);
        setQuestions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `exams/${examId}/questions`)
    );

    const unsubK = onSnapshot(
      collection(db, 'exams', examId, 'answerKeys'),
      (snap) => {
        const map: Record<string, AnswerKey> = {};
        for (const d of snap.docs) {
          map[d.id] = d.data() as AnswerKey;
        }
        setAnswerKeys(map);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `exams/${examId}/answerKeys`)
    );

    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('teacherId', '==', profile.uid), where('isArchived', '==', false)),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) })));
      }
    );

    const unsubBank = onSnapshot(
      query(collection(db, 'questionBank'), where('teacherId', '==', profile.uid)),
      (snap) => {
        setBankItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuestionBankItem, 'id'>) })));
      }
    );

    return () => {
      unsubExam();
      unsubQ();
      unsubK();
      unsubClasses();
      unsubBank();
    };
  }, [examId, profile?.uid, profile?.timezone]);

  const isLocked = (exam?.attemptCount || 0) > 0;

  const resetQForm = () => {
    setEditingQId(null);
    setQText('');
    setQImageURL('');
    setQOptions(newOptions());
    setQCorrectId('opt_a');
    setQPoints(1);
    setQExplanation('');
    setQError('');
  };

  const loadQuestionIntoForm = (q: ExamQuestion) => {
    setEditingQId(q.id);
    setQText(q.text);
    setQImageURL(q.imageURL || '');
    setQOptions(q.options.map((o) => ({ ...o })));
    setQCorrectId(answerKeys[q.id]?.correctOptionId || q.options[0]?.id || 'opt_a');
    setQPoints(q.points);
    setQExplanation(answerKeys[q.id]?.explanation || '');
    setQError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recomputeExamTotals = async (nextQuestions: ExamQuestion[]) => {
    const totalPoints = nextQuestions.reduce(
      (sum, q) => sum + (q.voided === 'excluded' ? 0 : q.points),
      0
    );
    await updateDoc(doc(db, 'exams', examId), {
      questionCount: nextQuestions.length,
      totalPoints,
      updatedAt: serverTimestamp(),
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam || isLocked) return;
    setQError('');

    const parsed = questionSchema.safeParse({
      text: qText,
      imageURL: qImageURL,
      options: qOptions,
      correctOptionId: qCorrectId,
      points: qPoints,
      explanation: qExplanation,
    });
    if (!parsed.success) {
      setQError(parsed.error.issues[0]?.message || 'Periksa kembali isian soal.');
      return;
    }

    setBusy(true);
    try {
      const qDocId = editingQId || doc(collection(db, 'exams', examId, 'questions')).id;
      const existingQ = questions.find((q) => q.id === qDocId);
      const order = existingQ ? existingQ.order : questions.length;

      const questionPayload = {
        order,
        text: parsed.data.text,
        ...(parsed.data.imageURL ? { imageURL: parsed.data.imageURL } : {}),
        options: parsed.data.options.map((o) => ({
          id: o.id,
          text: o.text,
          ...(o.imageURL ? { imageURL: o.imageURL } : {}),
        })),
        points: parsed.data.points,
      };

      const keyPayload = {
        correctOptionId: parsed.data.correctOptionId,
        ...(parsed.data.explanation ? { explanation: parsed.data.explanation } : {}),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'exams', examId, 'questions', qDocId), questionPayload);
      batch.set(doc(db, 'exams', examId, 'answerKeys', qDocId), keyPayload);
      await batch.commit();

      const updatedList = existingQ
        ? questions.map((q) => (q.id === qDocId ? { id: qDocId, ...questionPayload } : q))
        : [...questions, { id: qDocId, ...questionPayload }];
      await recomputeExamTotals(updatedList);
      resetQForm();
      setStatusMsg('Soal berhasil disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `exams/${examId}/questions`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (isLocked) return;
    setBusy(true);
    try {
      const remaining = questions
        .filter((q) => q.id !== qId)
        .map((q, idx) => ({ ...q, order: idx }));

      const batch = writeBatch(db);
      batch.delete(doc(db, 'exams', examId, 'questions', qId));
      batch.delete(doc(db, 'exams', examId, 'answerKeys', qId));
      for (const q of remaining) {
        batch.update(doc(db, 'exams', examId, 'questions', q.id), { order: q.order });
      }
      await batch.commit();
      await recomputeExamTotals(remaining);
      if (editingQId === qId) resetQForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `exams/${examId}/questions/${qId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicateQuestion = async (q: ExamQuestion) => {
    if (isLocked) return;
    setBusy(true);
    try {
      const newRef = doc(collection(db, 'exams', examId, 'questions'));
      const key = answerKeys[q.id];
      const payload: Omit<ExamQuestion, 'id'> = {
        order: questions.length,
        text: `${q.text} (Salinan)`,
        ...(q.imageURL ? { imageURL: q.imageURL } : {}),
        options: q.options,
        points: q.points,
      };
      const batch = writeBatch(db);
      batch.set(newRef, payload);
      batch.set(doc(db, 'exams', examId, 'answerKeys', newRef.id), {
        correctOptionId: key?.correctOptionId || q.options[0].id,
        ...(key?.explanation ? { explanation: key.explanation } : {}),
      });
      await batch.commit();
      await recomputeExamTotals([...questions, { id: newRef.id, ...payload }]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `exams/${examId}/questions`);
    } finally {
      setBusy(false);
    }
  };

  const handleMoveQuestion = async (index: number, direction: -1 | 1) => {
    if (isLocked) return;
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const copy = [...questions];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);

    setBusy(true);
    try {
      const batch = writeBatch(db);
      copy.forEach((q, idx) => {
        batch.update(doc(db, 'exams', examId, 'questions', q.id), { order: idx });
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/questions`);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFromBank = async (item: QuestionBankItem) => {
    if (isLocked) return;
    setBusy(true);
    try {
      const newRef = doc(collection(db, 'exams', examId, 'questions'));
      const payload = {
        order: questions.length,
        text: item.text,
        ...(item.imageURL ? { imageURL: item.imageURL } : {}),
        options: item.options,
        points: item.points,
      };
      const batch = writeBatch(db);
      batch.set(newRef, payload);
      batch.set(doc(db, 'exams', examId, 'answerKeys', newRef.id), {
        correctOptionId: item.correctOptionId,
        ...(item.explanation ? { explanation: item.explanation } : {}),
      });
      await batch.commit();
      await recomputeExamTotals([...questions, { id: newRef.id, ...payload }]);
      setShowBankModal(false);
      setStatusMsg('Soal berhasil diimpor dari Bank Soal.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `exams/${examId}/questions`);
    } finally {
      setBusy(false);
    }
  };

  const handleImportCsv = async () => {
    if (isLocked || !csvText.trim()) return;
    setBusy(true);
    setQError('');
    try {
      const lines = csvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const batch = writeBatch(db);
      const added: ExamQuestion[] = [];
      let orderOffset = questions.length;

      for (const line of lines) {
        // Format: soal;opsiA;opsiB;opsiC;opsiD;opsiE(opsional);kunci(A-E);bobot;pembahasan
        const cols = line.split(';').map((c) => c.trim());
        if (cols.length < 7 || cols[0].toLowerCase() === 'soal') continue;
        const [textCol, a, b, c, d, eOpt, keyCol, ptsCol, expCol] = cols;
        const optsRaw = [
          { id: 'opt_a', text: a },
          { id: 'opt_b', text: b },
          { id: 'opt_c', text: c },
          { id: 'opt_d', text: d },
          ...(eOpt ? [{ id: 'opt_e', text: eOpt }] : []),
        ].filter((o) => o.text.length > 0);
        if (optsRaw.length < 2) continue;

        const keyIdx = OPTION_LABELS.indexOf((keyCol || 'A').toUpperCase());
        const correctId = optsRaw[keyIdx >= 0 && keyIdx < optsRaw.length ? keyIdx : 0].id;
        const pts = Math.max(0, Math.min(100, Number(ptsCol) || 1));

        const qRef = doc(collection(db, 'exams', examId, 'questions'));
        const qPayload: Omit<ExamQuestion, 'id'> = {
          order: orderOffset++,
          text: textCol,
          options: optsRaw,
          points: pts,
        };
        batch.set(qRef, qPayload);
        batch.set(doc(db, 'exams', examId, 'answerKeys', qRef.id), {
          correctOptionId: correctId,
          ...(expCol ? { explanation: expCol } : {}),
        });
        added.push({ id: qRef.id, ...qPayload });
      }

      if (added.length === 0) {
        setQError('Tidak ada baris CSV valid yang ditemukan. Gunakan pemisah titik koma (;).');
      } else {
        await batch.commit();
        await recomputeExamTotals([...questions, ...added]);
        setCsvText('');
        setShowCsvModal(false);
        setStatusMsg(`${added.length} soal berhasil diimpor dari CSV.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `exams/${examId}/questions`);
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
      await recomputeExamTotals(nextQuestions);
      const attemptsSnap = await getDocs(collection(db, 'exams', examId, 'attempts'));
      const attemptsList = attemptsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExamAttempt, 'id'>),
      }));
      const count = await regradeAllSubmittedAttempts(
        examId,
        exam,
        nextQuestions,
        answerKeys,
        attemptsList
      );
      setStatusMsg(
        `Status soal diperbarui dan ${count} pengerjaan siswa dihitung ulang otomatis.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/questions/${qId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam || !profile) return;
    setQError('');
    const parsed = examSettingsFormSchema.safeParse({
      title,
      subject,
      description,
      classIds: selectedClassIds,
      opensAt,
      closesAt,
      timezone,
      durationMinutes,
      shuffleQuestions,
      shuffleOptions,
      maxAttempts,
      passingScore: passingScore === '' ? '' : Number(passingScore),
      resultsPolicy,
      allowBackNavigation,
      oneQuestionPerPage,
      detectTabSwitch,
      requireFullscreen,
      blockCopyPaste,
      violationLimit: violationLimit === '' ? '' : Number(violationLimit),
      onLimitReached,
    });
    if (!parsed.success) {
      setQError(parsed.error.issues[0]?.message || 'Pengaturan tidak valid.');
      return;
    }

    const activeTz = normalizeTimezone(parsed.data.timezone);
    const openDate = parseDatetimeLocalWIB(parsed.data.opensAt, activeTz);
    const closeDate = parseDatetimeLocalWIB(parsed.data.closesAt, activeTz);
    if (closeDate <= openDate) {
      setQError('Waktu tutup harus lebih akhir dari waktu buka.');
      return;
    }

    setBusy(true);
    try {
      const settingsObj = {
        opensAt: Timestamp.fromDate(openDate),
        closesAt: Timestamp.fromDate(closeDate),
        timezone: activeTz,
        durationMinutes: parsed.data.durationMinutes,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions,
        maxAttempts: parsed.data.maxAttempts,
        ...(parsed.data.passingScore !== '' && parsed.data.passingScore !== undefined
          ? { passingScore: Number(parsed.data.passingScore) }
          : {}),
        resultsPolicy: parsed.data.resultsPolicy,
        allowBackNavigation: parsed.data.allowBackNavigation,
        oneQuestionPerPage: parsed.data.oneQuestionPerPage,
        proctoring: {
          detectTabSwitch: parsed.data.detectTabSwitch,
          requireFullscreen: parsed.data.requireFullscreen,
          blockCopyPaste: parsed.data.blockCopyPaste,
          ...(parsed.data.violationLimit !== '' && parsed.data.violationLimit !== undefined
            ? { violationLimit: Number(parsed.data.violationLimit) }
            : {}),
          onLimitReached: parsed.data.onLimitReached,
        },
      };

      const prevClassIds = exam.classIds || [];
      await updateDoc(doc(db, 'exams', examId), {
        title: parsed.data.title,
        subject: parsed.data.subject,
        description: parsed.data.description || '',
        classIds: parsed.data.classIds,
        settings: settingsObj,
        updatedAt: serverTimestamp(),
      });

      await syncExamRefsForClasses(
        examId,
        {
          teacherId: exam.teacherId,
          title: parsed.data.title,
          subject: parsed.data.subject,
          status: exam.status,
          settings: settingsObj,
          questionCount: questions.length,
          classIds: parsed.data.classIds,
        },
        prevClassIds
      );
      setStatusMsg('Pengaturan ujian disimpan.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!exam) return;
    if (questions.length === 0) {
      setQError('Ujian wajib memiliki minimal 1 soal pilihan ganda sebelum dipublikasikan.');
      return;
    }
    setBusy(true);
    setQError('');
    try {
      const sealedKeyToken = await sealExamKeysFromServer(examId, questions, answerKeys);
      await updateDoc(doc(db, 'exams', examId), {
        status: 'published',
        ...(sealedKeyToken ? { sealedKeyToken } : {}),
        updatedAt: serverTimestamp(),
      });
      await syncExamRefsForClasses(examId, { ...exam, status: 'published', questionCount: questions.length });
      await notifyClassStudents(
        exam.classIds,
        `Ujian Baru: ${exam.title}`,
        `${exam.subject} · ${questions.length} soal (${exam.settings.durationMinutes} menit)`,
        `/student/exams/${examId}`
      );
      setStatusMsg('Ujian dipublikasikan dan kunci jawaban telah disegel.');
    } catch (err) {
      setQError(err instanceof Error ? err.message : 'Gagal mempublikasikan ujian.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      requiredRole="teacher"
      title={exam?.title || 'Editor Ujian'}
      actions={
        exam && exam.status !== 'draft' ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${examId}/monitor`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              <Radio className="w-3.5 h-3.5" />
              Pantau Live
            </Link>
            <Link
              href={`/teacher/exams/${examId}/results`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-xs font-semibold"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Hasil
            </Link>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/teacher/exams"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Daftar Ujian
          </Link>

          {exam && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">
                Status:{' '}
                {exam.status === 'published'
                  ? 'Dipublikasikan'
                  : exam.status === 'closed'
                    ? 'Ditutup'
                    : 'Draft'}
              </span>
              <span>·</span>
              <span className="tabular-nums">{questions.length} soal</span>
              <span>·</span>
              <span className="tabular-nums">{exam.totalPoints} total poin</span>
            </div>
          )}
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              {statusMsg}
            </span>
            <button type="button" onClick={() => setStatusMsg('')} className="underline">
              Tutup
            </button>
          </div>
        )}

        {qError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{qError}</span>
          </div>
        )}

        {isLocked && exam && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Soal Terkunci ({exam.attemptCount} siswa sudah mengerjakan)</p>
                <p className="mt-0.5">
                  Soal tidak dapat diubah atau dihapus. Anda dapat menduplikat ujian atau menandai
                  soal bermasalah untuk hitung ulang otomatis.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!profile) return;
                const newId = await duplicateExamToDraft(exam, profile.uid, profile.displayName);
                router.push(`/teacher/exams/${newId}/edit`);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplikat Ujian
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
          {(
            [
              ['questions', `Soal Pilihan Ganda (${questions.length})`],
              ['settings', 'Pengaturan & Jadwal'],
              ['publish', 'Publikasikan Ujian'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-stone-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading || !exam ? (
          <div className="p-8 text-sm text-slate-500">Memuat editor ujian...</div>
        ) : activeTab === 'questions' ? (
          <div className="space-y-6">
            {!isLocked && (
              <form
                onSubmit={handleSaveQuestion}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900">
                    {editingQId ? 'Ubah Soal Pilihan Ganda' : 'Tambah Soal Pilihan Ganda'}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBankModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Ambil dari Bank Soal
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCsvModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Impor CSV
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Teks Soal (mendukung **tebal**, *miring*, dan rumus LaTeX `$...$` / `$$...$$`)
                    </label>
                    <textarea
                      rows={3}
                      required
                      maxLength={5000}
                      value={qText}
                      onChange={(e) => setQText(e.target.value)}
                      placeholder="Tuliskan pertanyaan pilihan ganda..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bobot Poin
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={qPoints}
                      onChange={(e) => setQPoints(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
                    />
                  </div>
                </div>

                {qText.trim() && (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Pratinjau Soal</p>
                    <div className="text-sm text-slate-900">
                      <MathText text={qText} />
                    </div>
                  </div>
                )}

                <ImageUrlInput
                  label="URL Gambar / ID File Google Drive Soal (Opsional)"
                  value={qImageURL}
                  onChange={setQImageURL}
                />

                {/* Options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Opsi Jawaban (2–5 pilihan, tandai tepat 1 jawaban benar)
                    </label>
                    <div className="flex gap-3">
                      {qOptions.length < 5 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQOptions((prev) => [
                              ...prev,
                              { id: `opt_${OPTION_LABELS[prev.length].toLowerCase()}`, text: '' },
                            ])
                          }
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          + Tambah Opsi
                        </button>
                      )}
                      {qOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = qOptions.slice(0, -1);
                            setQOptions(next);
                            if (!next.some((o) => o.id === qCorrectId)) {
                              setQCorrectId(next[0].id);
                            }
                          }}
                          className="text-xs text-slate-500 hover:text-slate-900"
                        >
                          Kurangi Opsi
                        </button>
                      )}
                    </div>
                  </div>

                  {qOptions.map((opt, idx) => (
                    <div key={opt.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="correctOption"
                          checked={qCorrectId === opt.id}
                          onChange={() => setQCorrectId(opt.id)}
                          aria-label={`Tandai opsi ${OPTION_LABELS[idx]} benar`}
                        />
                        <span className="w-6 text-xs font-bold text-slate-700">
                          {OPTION_LABELS[idx]}
                        </span>
                        <input
                          type="text"
                          required
                          maxLength={1500}
                          value={opt.text}
                          onChange={(e) =>
                            setQOptions((prev) =>
                              prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o))
                            )
                          }
                          placeholder={`Teks pilihan ${OPTION_LABELS[idx]}`}
                          className="flex-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
                        />
                      </div>
                      <div className="pl-9">
                        <ImageUrlInput
                          compact
                          value={opt.imageURL || ''}
                          onChange={(val) =>
                            setQOptions((prev) =>
                              prev.map((o) => (o.id === opt.id ? { ...o, imageURL: val } : o))
                            )
                          }
                          placeholder={`URL gambar atau ID Google Drive opsi ${OPTION_LABELS[idx]} (opsional)`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pembahasan Kunci (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={3000}
                    value={qExplanation}
                    onChange={(e) => setQExplanation(e.target.value)}
                    placeholder="Penjelasan langkah penyelesaian..."
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {editingQId ? 'Perbarui Soal' : 'Simpan Soal'}
                  </button>
                  {editingQId && (
                    <button
                      type="button"
                      onClick={resetQForm}
                      className="px-4 py-2 text-sm text-slate-600"
                    >
                      Batal Ubah
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Question List */}
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const key = answerKeys[q.id];
                return (
                  <div key={q.id} className="bg-white border border-stone-200 rounded-2xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                          <span className="font-bold text-slate-900 tabular-nums">
                            Soal {idx + 1}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">{q.points} poin</span>
                          {q.voided && q.voided !== 'none' && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-amber-700">
                                {q.voided === 'all_correct'
                                  ? 'Semua Siswa Benar'
                                  : 'Dikeluarkan dari Penilaian'}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          <MathText text={q.text} />
                        </div>
                        {q.imageURL && (
                          <div className="mt-2">
                            <QuestionImage
                              src={q.imageURL}
                              alt={`Gambar soal ${idx + 1}`}
                              driveHint
                              className="max-h-48 rounded-lg border border-stone-200 object-contain"
                            />
                          </div>
                        )}
                        <div className="mt-3 grid sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = key?.correctOptionId === opt.id;
                            return (
                              <div
                                key={opt.id}
                                className={`px-3 py-2 rounded-lg border text-xs space-y-1.5 ${
                                  isCorrect
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold'
                                    : 'border-stone-200 bg-stone-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{OPTION_LABELS[oIdx]}.</span>
                                  <span className="flex-1">
                                    <MathText text={opt.text} />
                                  </span>
                                </div>
                                {opt.imageURL && (
                                  <QuestionImage
                                    src={opt.imageURL}
                                    alt={`Gambar opsi ${OPTION_LABELS[oIdx]}`}
                                    className="max-h-24 rounded border border-stone-200 object-contain bg-white"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {key?.explanation && (
                          <p className="mt-2.5 text-xs text-slate-600">
                            Pembahasan: <MathText text={key.explanation} />
                          </p>
                        )}
                      </div>

                      {!isLocked ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0 || busy}
                            onClick={() => handleMoveQuestion(idx, -1)}
                            className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="Naikkan urutan"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === questions.length - 1 || busy}
                            onClick={() => handleMoveQuestion(idx, 1)}
                            className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="Turunkan urutan"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => loadQuestionIntoForm(q)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateQuestion(q)}
                            className="p-2 text-slate-500 hover:text-slate-900"
                            title="Duplikat"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-2 text-slate-400 hover:text-red-700"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="shrink-0">
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            Penanganan Soal (GRD-4)
                          </label>
                          <select
                            disabled={busy}
                            value={q.voided || 'none'}
                            onChange={(e) =>
                              handleVoidQuestion(q.id, e.target.value as QuestionVoidStatus)
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                          >
                            <option value="none">Normal (sesuai kunci)</option>
                            <option value="all_correct">Beri poin ke semua siswa</option>
                            <option value="excluded">Keluarkan dari penilaian</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 max-w-3xl"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul Ujian</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Durasi (Menit)</label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Kelas Target</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {classes.map((cls) => {
                  const selected = selectedClassIds.includes(cls.id!);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() =>
                        setSelectedClassIds((prev) =>
                          prev.includes(cls.id!)
                            ? prev.filter((c) => c !== cls.id!)
                            : prev.length < 5
                              ? [...prev, cls.id!]
                              : prev
                        )
                      }
                      className={`p-3 rounded-xl border text-left text-sm ${
                        selected ? 'border-blue-700 bg-blue-50/70 font-semibold' : 'border-stone-200'
                      }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Zona Waktu Jadwal Ujian
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value as IndonesianTimezone)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm bg-white"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Waktu Buka ({timezone})
                </label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Waktu Tutup ({timezone})
                </label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Maks. Percobaan</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">KKM (Opsional)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kebijakan Tampilan Hasil
                </label>
                <select
                  value={resultsPolicy}
                  onChange={(e) => setResultsPolicy(e.target.value as ResultsPolicy)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm bg-white"
                >
                  <option value="answers_immediate">Skor, kunci, dan pembahasan langsung tampil</option>
                  <option value="score_immediate">Hanya skor langsung; kunci setelah dirilis guru</option>
                  <option value="after_release">Semua tampil setelah dirilis guru</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                <span>Acak urutan soal</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                />
                <span>Acak urutan opsi</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={oneQuestionPerPage}
                  onChange={(e) => setOneQuestionPerPage(e.target.checked)}
                />
                <span>Satu soal per halaman</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowBackNavigation}
                  onChange={(e) => setAllowBackNavigation(e.target.checked)}
                />
                <span>Boleh kembali ke soal sebelumnya</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={detectTabSwitch}
                  onChange={(e) => setDetectTabSwitch(e.target.checked)}
                />
                <span>Deteksi pindah tab</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireFullscreen}
                  onChange={(e) => setRequireFullscreen(e.target.checked)}
                />
                <span>Wajib layar penuh</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={blockCopyPaste}
                  onChange={(e) => setBlockCopyPaste(e.target.checked)}
                />
                <span>Blokir salin-tempel</span>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Batas Pelanggaran
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={violationLimit}
                  onChange={(e) => setViolationLimit(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tindakan Batas
                </label>
                <select
                  value={onLimitReached}
                  onChange={(e) => setOnLimitReached(e.target.value as ViolationLimitAction)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm bg-white"
                >
                  <option value="flag_only">Catat dan tandai saja</option>
                  <option value="auto_submit">Kirim otomatis</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
            >
              Simpan Pengaturan
            </button>
          </form>
        ) : (
          /* Publish Tab */
          <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 max-w-2xl space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Publikasi &amp; Segel Kunci Jawaban</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Saat ujian dipublikasikan, sistem menyegel kunci jawaban secara kriptografis di server
              sehingga penilaian otomatis dapat berjalan tanpa membocorkan kunci jawaban ke sisi
              siswa.
            </p>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-sm">
              <p>
                Jumlah Soal: <strong className="tabular-nums">{questions.length} soal</strong>
              </p>
              <p>
                Total Poin: <strong className="tabular-nums">{exam.totalPoints} poin</strong>
              </p>
              <p>
                Kelas Target: <strong>{exam.classIds.length} kelas</strong>
              </p>
              <p>
                Status Saat Ini:{' '}
                <strong className="capitalize">{exam.status}</strong>
              </p>
            </div>

            <button
              type="button"
              disabled={busy || questions.length === 0}
              onClick={handlePublish}
              className="px-6 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              {busy
                ? 'Memproses...'
                : exam.status === 'published'
                  ? 'Perbarui Segel Kunci & Sinkronkan'
                  : 'Publikasikan Ujian Sekarang'}
            </button>
          </div>
        )}

        {/* Bank Soal Import Modal */}
        {showBankModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Pilih Soal dari Bank Soal</h3>
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Tutup
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-3">
                {bankItems.length === 0 ? (
                  <p className="text-sm text-slate-500">Bank soal pribadi masih kosong.</p>
                ) : (
                  bankItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-stone-200 flex items-start justify-between gap-4"
                    >
                      <div className="text-sm text-slate-900">
                        <p className="text-xs text-slate-500 mb-1">
                          {item.subject || 'Umum'} · {item.points} poin
                        </p>
                        <MathText text={item.text} />
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleImportFromBank(item)}
                        className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold shrink-0"
                      >
                        Tambahkan
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Impor Soal dari CSV</h3>
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="text-xs text-slate-500"
                >
                  Tutup
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tempelkan baris CSV dengan pemisah titik koma (<code>;</code>) per baris dengan
                urutan kolom: <br />
                <code>soal;opsiA;opsiB;opsiC;opsiD;opsiE;kunci(A-E);bobot;pembahasan</code>
              </p>
              <textarea
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Berapa hasil 2 + 2?;2;3;4;5;;C;1;2 + 2 = 4"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-xs font-mono"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 text-xs text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleImportCsv}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold"
                >
                  Impor Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
