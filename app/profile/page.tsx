'use client';

import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { profileSchema } from '@/lib/validation';
import { normalizeTimezone, TIMEZONE_OPTIONS } from '@/lib/time';
import type { IndonesianTimezone } from '@/lib/types';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftStudentNumber, setDraftStudentNumber] = useState<string | null>(null);
  const [draftSchoolName, setDraftSchoolName] = useState<string | null>(null);
  const [draftTimezone, setDraftTimezone] = useState<IndonesianTimezone | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const displayName = draftName ?? (profile?.displayName || '');
  const studentNumber = draftStudentNumber ?? (profile?.studentNumber || '');
  const schoolName = draftSchoolName ?? (profile?.schoolName || '');
  const timezone: IndonesianTimezone = draftTimezone ?? normalizeTimezone(profile?.timezone);
  const setDisplayName = (val: string) => setDraftName(val);
  const setStudentNumber = (val: string) => setDraftStudentNumber(val);
  const setSchoolName = (val: string) => setDraftSchoolName(val);
  const setTimezone = (val: IndonesianTimezone) => setDraftTimezone(val);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');
    setSaved(false);

    const parsed = profileSchema.safeParse({
      displayName,
      studentNumber,
      schoolName,
      timezone: profile.role === 'teacher' ? timezone : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Input tidak valid.');
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        displayName: parsed.data.displayName,
        updatedAt: serverTimestamp(),
      };
      if (profile.role === 'student') {
        updates.studentNumber = parsed.data.studentNumber || '';
      }
      if (profile.role === 'teacher') {
        updates.schoolName = parsed.data.schoolName || '';
        updates.timezone = parsed.data.timezone || 'WIB';
      }
      await updateDoc(doc(db, 'users', profile.uid), updates);
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell requiredRole="any" title="Profil Saya">
      <div className="max-w-xl bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">Informasi Akun</h2>
        <p className="text-sm text-slate-600 mt-1">
          Perbarui nama tampilan
          {profile?.role === 'student'
            ? ' dan NIS/nomor induk'
            : profile?.role === 'teacher'
              ? ', asal sekolah/instansi, dan zona waktu'
              : ''}
          .
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Profil berhasil diperbarui.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
            <input
              type="text"
              disabled
              value={profile?.email || ''}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-stone-100 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Peran</label>
            <input
              type="text"
              disabled
              value={
                profile?.role === 'admin'
                  ? 'Administrator'
                  : profile?.role === 'teacher'
                    ? 'Guru'
                    : 'Siswa'
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-stone-100 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          {profile?.role === 'student' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                NIS / Nomor Induk (Opsional)
              </label>
              <input
                type="text"
                maxLength={40}
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="Nomor Induk Siswa"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>
          )}

          {profile?.role === 'teacher' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Asal Sekolah / Instansi
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Contoh: SMA Negeri 1 Bandung"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Zona Waktu Mengajar
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value as IndonesianTimezone)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Digunakan sebagai zona waktu bawaan saat membuat dan memantau jadwal ujian Anda.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
