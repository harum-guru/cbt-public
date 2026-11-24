'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { formatDurationMs, formatShortTimeWIB } from '@/lib/time';
import type { AttemptEvent, Exam, ExamAttempt } from '@/lib/types';

const EVENT_LABELS: Record<AttemptEvent['type'], string> = {
  tab_hidden: 'Meninggalkan tab ujian',
  tab_visible: 'Kembali ke tab ujian',
  window_blur: 'Jendela kehilangan fokus',
  window_focus: 'Jendela kembali fokus',
  fullscreen_exit: 'Keluar dari mode layar penuh',
  page_unload: 'Halaman ditutup atau dimuat ulang',
  disconnected: 'Koneksi terputus',
  reconnected: 'Koneksi tersambung kembali',
  copy_attempt: 'Mencoba menyalin soal',
  paste_attempt: 'Mencoba menempel teks',
  teacher_action: 'Tindakan guru',
};

export default function TeacherAttemptLogPage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
  const { profile } = useAuth();
  const [examTimezone, setExamTimezone] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [events, setEvents] = useState<AttemptEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId || !attemptId) return;
    getDoc(doc(db, 'exams', examId))
      .then((s) => {
        if (s.exists()) {
          const d = s.data() as Exam;
          setExamTimezone(d.settings?.timezone);
        }
      })
      .catch(() => {});
    const unsubAtt = onSnapshot(doc(db, 'exams', examId, 'attempts', attemptId), (snap) => {
      if (snap.exists()) {
        setAttempt({ id: snap.id, ...(snap.data() as Omit<ExamAttempt, 'id'>) });
      }
    });

    const q = query(
      collection(db, 'exams', examId, 'attempts', attemptId, 'events'),
      orderBy('at', 'asc')
    );
    const unsubEvents = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttemptEvent, 'id'>) })));
        setLoading(false);
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          `exams/${examId}/attempts/${attemptId}/events`
        )
    );

    return () => {
      unsubAtt();
      unsubEvents();
    };
  }, [examId, attemptId]);

  return (
    <AppShell requiredRole="teacher" title="Log Aktivitas Siswa">
      <div className="max-w-3xl space-y-6">
        <Link
          href={`/teacher/exams/${examId}/monitor`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Monitoring Live
        </Link>

        {attempt && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {attempt.studentName || attempt.studentId}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Percobaan ke-{attempt.attemptNumber} · Terjawab {attempt.answeredCount} soal · Total
                pelanggaran: <strong className="tabular-nums">{attempt.violations}</strong>
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-stone-100 text-slate-800">
              {attempt.status === 'submitted' ? 'Sudah Dikirim' : 'Sedang Berlangsung'}
            </span>
          </div>
        )}

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="text-sm font-bold text-slate-900">
              Linimasa Kejadian ({events.length})
            </h3>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Memuat log aktivitas...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Tidak ada kejadian pelanggaran atau perpindahan tab yang tercatat.
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {events.map((ev) => (
                <div key={ev.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {EVENT_LABELS[ev.type] || ev.type}
                    </p>
                    {ev.durationAwayMs ? (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Durasi meninggalkan layar: {formatDurationMs(ev.durationAwayMs)}
                      </p>
                    ) : null}
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                    {formatShortTimeWIB(ev.at, examTimezone || profile?.timezone)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
