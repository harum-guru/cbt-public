'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Clock,
  FileText,
  Send,
  TimerReset,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatCountdown, formatShortTimeWIB } from '@/lib/time';
import { regradeAllSubmittedAttempts } from '@/lib/exam-helpers';
import type { AnswerKey, ClassMember, Exam, ExamAttempt, ExamQuestion } from '@/lib/types';

export default function TeacherExamMonitorPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [enrolledMembers, setEnrolledMembers] = useState<ClassMember[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, AnswerKey>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'disconnected' | 'submitted' | 'not_started'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!examId) return;
    const unsubExam = onSnapshot(doc(db, 'exams', examId), async (snap) => {
      if (!snap.exists()) return;
      const data = { id: snap.id, ...(snap.data() as Omit<Exam, 'id'>) };
      setExam(data);

      // Load enrolled students from target classes
      const memberMap = new Map<string, ClassMember>();
      for (const cId of data.classIds || []) {
        try {
          const mSnap = await getDocs(collection(db, 'classes', cId, 'members'));
          mSnap.docs.forEach((d) => {
            if (!memberMap.has(d.id)) memberMap.set(d.id, d.data() as ClassMember);
          });
        } catch {
          // ignore
        }
      }
      setEnrolledMembers(Array.from(memberMap.values()));
    });

    const unsubQ = onSnapshot(collection(db, 'exams', examId, 'questions'), (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamQuestion, 'id'>) })));
    });

    const unsubK = onSnapshot(collection(db, 'exams', examId, 'answerKeys'), (snap) => {
      const m: Record<string, AnswerKey> = {};
      snap.docs.forEach((d) => {
        m[d.id] = d.data() as AnswerKey;
      });
      setAnswerKeys(m);
    });

    const unsubAtt = onSnapshot(
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
      unsubAtt();
    };
  }, [examId]);

  // Auto-grade submitted attempts that haven't been persisted with official score yet
  useEffect(() => {
    if (!exam || questions.length === 0 || Object.keys(answerKeys).length === 0) return;
    const ungraded = attempts.filter((a) => a.status === 'submitted' && !a.gradedAt);
    if (ungraded.length > 0) {
      regradeAllSubmittedAttempts(examId, exam, questions, answerKeys, ungraded).catch(() => {});
    }
  }, [examId, exam, questions, answerKeys, attempts]);

  const rows = useMemo(() => {
    const latestByStudent = new Map<string, ExamAttempt>();
    for (const att of attempts) {
      const prev = latestByStudent.get(att.studentId);
      if (!prev || att.attemptNumber > prev.attemptNumber) {
        latestByStudent.set(att.studentId, att);
      }
    }

    const allStudents = new Map<string, { name: string; nis?: string; attempt?: ExamAttempt }>();
    for (const m of enrolledMembers) {
      allStudents.set(m.studentUid, {
        name: m.displayName,
        nis: m.studentNumber,
        attempt: latestByStudent.get(m.studentUid),
      });
    }
    for (const att of latestByStudent.values()) {
      if (!allStudents.has(att.studentId)) {
        allStudents.set(att.studentId, {
          name: att.studentName || att.studentId,
          nis: att.studentNumber,
          attempt: att,
        });
      }
    }

    return Array.from(allStudents.entries()).map(([uid, info]) => {
      const att = info.attempt;
      let liveStatus: 'not_started' | 'online' | 'disconnected' | 'submitted' = 'not_started';
      if (att) {
        if (att.status === 'submitted') {
          liveStatus = 'submitted';
        } else {
          const lastBeat = att.lastHeartbeatAt?.toMillis?.() || 0;
          liveStatus = nowMs - lastBeat > 45_000 ? 'disconnected' : 'online';
        }
      }
      return {
        uid,
        name: info.name,
        nis: info.nis,
        attempt: att,
        liveStatus,
      };
    });
  }, [attempts, enrolledMembers, nowMs]);

  const counts = useMemo(() => {
    return {
      not_started: rows.filter((r) => r.liveStatus === 'not_started').length,
      online: rows.filter((r) => r.liveStatus === 'online').length,
      disconnected: rows.filter((r) => r.liveStatus === 'disconnected').length,
      submitted: rows.filter((r) => r.liveStatus === 'submitted').length,
    };
  }, [rows]);

  const filteredRows = rows.filter((r) => {
    if (statusFilter !== 'all' && r.liveStatus !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.nis || '').toLowerCase().includes(q);
  });

  const handleForceSubmit = async (att: ExamAttempt) => {
    if (!att.id) return;
    setBusyId(att.id);
    try {
      await updateDoc(doc(db, 'exams', examId, 'attempts', att.id), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'exams', examId, 'attempts', att.id, 'events'), {
        studentId: att.studentId,
        type: 'teacher_action',
        at: serverTimestamp(),
        meta: { action: 'force_submit' },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/attempts/${att.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleExtendOrReopen = async (att: ExamAttempt) => {
    if (!att.id) return;
    setBusyId(att.id);
    try {
      const currentDeadlineMs = att.deadline?.toMillis?.() || Date.now();
      const nextDeadline = Timestamp.fromMillis(Math.max(Date.now(), currentDeadlineMs) + 10 * 60_000);
      await updateDoc(doc(db, 'exams', examId, 'attempts', att.id), {
        status: 'in_progress',
        deadline: nextDeadline,
        presence: 'online',
      });
      await addDoc(collection(db, 'exams', examId, 'attempts', att.id, 'events'), {
        studentId: att.studentId,
        type: 'teacher_action',
        at: serverTimestamp(),
        meta: { action: 'extend_10_min' },
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}/attempts/${att.id}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell requiredRole="teacher" title={`Monitoring Live · ${exam?.title || ''}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/teacher/exams/${examId}/edit`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Editor Ujian
          </Link>
          <Link
            href={`/teacher/exams/${examId}/results`}
            className="px-3.5 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
          >
            Lihat Rekap &amp; Analisis Nilai
          </Link>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Belum Mulai</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{counts.not_started}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Sedang Mengerjakan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{counts.online}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Terputus (&gt;45 dtk)</p>
            <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{counts.disconnected}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Selesai</p>
            <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">{counts.submitted}</p>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Catatan: Deteksi pindah tab bersifat indikatif (dapat dipicu notifikasi perangkat atau
          gangguan jaringan) dan digunakan sebagai bahan tinjauan guru.
        </p>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="online">Sedang Mengerjakan</option>
            <option value="disconnected">Terputus</option>
            <option value="submitted">Selesai</option>
            <option value="not_started">Belum Mulai</option>
          </select>
        </div>

        {/* Live Student Table */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Siswa</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Progres</th>
                  <th className="px-5 py-3 font-semibold">Sisa Waktu</th>
                  <th className="px-5 py-3 font-semibold">Heartbeat</th>
                  <th className="px-5 py-3 font-semibold">Pelanggaran</th>
                  <th className="px-5 py-3 font-semibold text-right">Aksi Guru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Tidak ada siswa yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const att = row.attempt;
                    const totalQ = exam?.questionCount || att?.questionOrder.length || 0;
                    const remainingMs = att ? (att.deadline?.toMillis?.() || 0) - nowMs : 0;
                    const vCount = att?.violations || 0;

                    return (
                      <tr key={row.uid} className="hover:bg-stone-50">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums">
                            {row.nis || '—'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold">
                          {row.liveStatus === 'online' && (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700">
                              <Clock className="w-3.5 h-3.5" />
                              Mengerjakan
                            </span>
                          )}
                          {row.liveStatus === 'disconnected' && (
                            <span className="inline-flex items-center gap-1.5 text-amber-700">
                              <WifiOff className="w-3.5 h-3.5" />
                              Terputus
                            </span>
                          )}
                          {row.liveStatus === 'submitted' && (
                            <span className="inline-flex items-center gap-1.5 text-blue-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selesai ({att?.percentage ?? '—'})
                            </span>
                          )}
                          {row.liveStatus === 'not_started' && (
                            <span className="text-slate-500">Belum Mulai</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                          {att ? `${att.answeredCount}/${totalQ}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                          {att && att.status === 'in_progress'
                            ? formatCountdown(remainingMs)
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                          {att
                            ? formatShortTimeWIB(
                                att.lastHeartbeatAt,
                                exam?.settings?.timezone || profile?.timezone
                              )
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold tabular-nums">
                          {att ? (
                            <span
                              className={`inline-flex items-center gap-1 ${
                                vCount >= 3
                                  ? 'text-red-700'
                                  : vCount >= 1
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              }`}
                            >
                              {vCount >= 1 && <AlertTriangle className="w-3.5 h-3.5" />}
                              {vCount} {vCount === 0 ? '(Aman)' : vCount < 3 ? '(Waspada)' : '(Tinggi)'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {att && (
                            <div className="inline-flex items-center gap-2">
                              <Link
                                href={`/teacher/exams/${examId}/monitor/${att.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-100"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Log
                              </Link>
                              {att.status === 'in_progress' && (
                                <button
                                  type="button"
                                  disabled={busyId === att.id}
                                  onClick={() => handleForceSubmit(att)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Paksa Kirim
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyId === att.id}
                                onClick={() => handleExtendOrReopen(att)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 text-slate-700 text-xs font-semibold hover:bg-stone-200"
                                title="Tambahkan 10 menit / izinkan lanjut"
                              >
                                <TimerReset className="w-3.5 h-3.5" />
                                +10 mnt
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
