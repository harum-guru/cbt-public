'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { examSettingsFormSchema } from '@/lib/validation';
import {
  normalizeTimezone,
  parseDatetimeLocalWIB,
  TIMEZONE_OPTIONS,
  toDatetimeLocalWIB,
} from '@/lib/time';
import { syncExamRefsForClasses } from '@/lib/exam-helpers';
import type {
  ClassRoom,
  IndonesianTimezone,
  ResultsPolicy,
  ViolationLimitAction,
} from '@/lib/types';

export default function NewExamPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [timezoneDraft, setTimezoneDraft] = useState<IndonesianTimezone | null>(null);
  const timezone: IndonesianTimezone = timezoneDraft ?? normalizeTimezone(profile?.timezone);
  const [defaultRange] = useState(() => {
    const now = new Date();
    return { open: now, close: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
  });
  const [opensAtDraft, setOpensAtDraft] = useState<string | null>(null);
  const [closesAtDraft, setClosesAtDraft] = useState<string | null>(null);
  const opensAt = opensAtDraft ?? toDatetimeLocalWIB(defaultRange.open, timezone);
  const closesAt = closesAtDraft ?? toDatetimeLocalWIB(defaultRange.close, timezone);
  const setOpensAt = (v: string) => setOpensAtDraft(v);
  const setClosesAt = (v: string) => setClosesAtDraft(v);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passingScore, setPassingScore] = useState<string>('75');
  const [resultsPolicy, setResultsPolicy] = useState<ResultsPolicy>('answers_immediate');
  const [allowBackNavigation, setAllowBackNavigation] = useState(true);
  const [oneQuestionPerPage, setOneQuestionPerPage] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(true);
  const [requireFullscreen, setRequireFullscreen] = useState(false);
  const [blockCopyPaste, setBlockCopyPaste] = useState(true);
  const [violationLimit, setViolationLimit] = useState<string>('3');
  const [onLimitReached, setOnLimitReached] = useState<ViolationLimitAction>('flag_only');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'classes'),
      where('teacherId', '==', profile.uid),
      where('isArchived', '==', false)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
    );
    return () => unsub();
  }, [profile?.uid]);

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');

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
      setError(parsed.error.issues[0]?.message || 'Periksa kembali isian formulir.');
      return;
    }

    const activeTz = normalizeTimezone(parsed.data.timezone);
    const openDate = parseDatetimeLocalWIB(parsed.data.opensAt, activeTz);
    const closeDate = parseDatetimeLocalWIB(parsed.data.closesAt, activeTz);
    if (closeDate <= openDate) {
      setError('Waktu tutup ujian harus lebih akhir dari waktu buka.');
      return;
    }

    setSubmitting(true);
    try {
      const examRef = doc(collection(db, 'exams'));
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

      await setDoc(examRef, {
        teacherId: profile.uid,
        teacherName: profile.displayName,
        ...(profile.schoolName ? { schoolName: profile.schoolName } : {}),
        title: parsed.data.title,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        subject: parsed.data.subject,
        classIds: parsed.data.classIds,
        status: 'draft',
        settings: settingsObj,
        totalPoints: 0,
        questionCount: 0,
        attemptCount: 0,
        resultsReleased: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await syncExamRefsForClasses(examRef.id, {
        teacherId: profile.uid,
        title: parsed.data.title,
        subject: parsed.data.subject,
        status: 'draft',
        settings: settingsObj,
        questionCount: 0,
        classIds: parsed.data.classIds,
      });

      router.push(`/teacher/exams/${examRef.id}/edit`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'exams');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell requiredRole="teacher" title="Buat Ujian Baru">
      <div className="max-w-3xl space-y-6">
        <Link
          href="/teacher/exams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Daftar Ujian
        </Link>

        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Informasi &amp; Aturan Ujian</h2>
            <p className="text-xs text-slate-600 mt-1">
              Setelah disimpan sebagai draft, Anda akan langsung diarahkan ke editor soal pilihan ganda.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Judul Ujian</label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Penilaian Tengah Semester Matematika Wajib"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mata Pelajaran</label>
              <input
                type="text"
                required
                maxLength={100}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Matematika Wajib"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Durasi (Menit)</label>
              <input
                type="number"
                min={1}
                max={480}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Instruksi Pengerjaan (Opsional)
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan petunjuk pengerjaan untuk siswa..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm"
              />
            </div>
          </div>

          {/* Target Classes */}
          <div className="pt-4 border-t border-stone-200">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Kelas Target (Pilih 1–5 kelas)
            </label>
            {classes.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Anda belum memiliki kelas aktif.{' '}
                <Link href="/teacher/classes" className="font-semibold underline">
                  Buat kelas terlebih dahulu
                </Link>
                .
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {classes.map((cls) => {
                  const selected = selectedClassIds.includes(cls.id!);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClass(cls.id!)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-blue-700 bg-blue-50/70'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{cls.name}</p>
                      <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                        {cls.memberCount} siswa · Kode {cls.joinCode}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule & Grading */}
          <div className="pt-4 border-t border-stone-200 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Zona Waktu Jadwal Ujian
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezoneDraft(e.target.value as IndonesianTimezone)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm bg-white"
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
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Waktu Tutup ({timezone})
              </label>
              <input
                type="datetime-local"
                required
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Percobaan Maksimal per Siswa
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                KKM / Nilai Kelulusan (Opsional, 0–100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                placeholder="Kosongkan jika tanpa KKM"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kebijakan Tampilan Hasil
              </label>
              <select
                value={resultsPolicy}
                onChange={(e) => setResultsPolicy(e.target.value as ResultsPolicy)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm bg-white"
              >
                <option value="answers_immediate">
                  Skor, kunci jawaban, dan pembahasan langsung setelah kirim
                </option>
                <option value="score_immediate">
                  Hanya skor langsung; kunci dan pembahasan setelah guru merilis
                </option>
                <option value="after_release">
                  Semua (skor dan pembahasan) tampil setelah guru merilis
                </option>
              </select>
            </div>
          </div>

          {/* Randomization & Proctoring */}
          <div className="pt-4 border-t border-stone-200 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Navigasi &amp; Pengawasan Ujian</p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                <span>Acak urutan soal</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                />
                <span>Acak urutan opsi jawaban</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={oneQuestionPerPage}
                  onChange={(e) => setOneQuestionPerPage(e.target.checked)}
                />
                <span>Tampilkan 1 soal per halaman</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={allowBackNavigation}
                  onChange={(e) => setAllowBackNavigation(e.target.checked)}
                />
                <span>Boleh kembali ke soal sebelumnya</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={detectTabSwitch}
                  onChange={(e) => setDetectTabSwitch(e.target.checked)}
                />
                <span>Deteksi pindah tab / jendela</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={requireFullscreen}
                  onChange={(e) => setRequireFullscreen(e.target.checked)}
                />
                <span>Wajib layar penuh (Fullscreen)</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={blockCopyPaste}
                  onChange={(e) => setBlockCopyPaste(e.target.checked)}
                />
                <span>Nonaktifkan klik kanan &amp; salin-tempel</span>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ambang Batas Pelanggaran (Opsional)
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
                  Tindakan Jika Batas Terlampaui
                </label>
                <select
                  value={onLimitReached}
                  onChange={(e) => setOnLimitReached(e.target.value as ViolationLimitAction)}
                  className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm bg-white"
                >
                  <option value="flag_only">Catat dan tandai untuk ditinjau guru</option>
                  <option value="auto_submit">Kirim ujian otomatis</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || classes.length === 0}
              className="px-6 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Membuat Draft...' : 'Lanjut ke Editor Soal'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
