'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { writeAuditLog } from '@/lib/admin-helpers';
import type { PlatformSettings } from '@/lib/types';

export default function AdminSettingsPage() {
  const { profile } = useAuth();
  const [requireTeacherApproval, setRequireTeacherApproval] = useState(true);
  const [studentRegistrationOpen, setStudentRegistrationOpen] = useState(true);
  const [maxUploadSizeMB, setMaxUploadSizeMB] = useState(2);
  const [defaultTimezone, setDefaultTimezone] = useState('Asia/Jakarta');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'platformSettings', 'main'), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as PlatformSettings;
        setRequireTeacherApproval(d.requireTeacherApproval);
        setStudentRegistrationOpen(d.studentRegistrationOpen);
        setMaxUploadSizeMB(d.maxUploadSizeMB);
        setDefaultTimezone(d.defaultTimezone);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, 'platformSettings', 'main'), {
        requireTeacherApproval,
        studentRegistrationOpen,
        maxUploadSizeMB: Number(maxUploadSizeMB),
        defaultTimezone,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
      });
      await writeAuditLog({
        actorId: profile.uid,
        actorEmail: profile.email,
        action: 'update_settings',
        targetType: 'settings',
        targetId: 'main',
        meta: { requireTeacherApproval, studentRegistrationOpen, maxUploadSizeMB },
      });
      setSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'platformSettings/main');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell requiredRole="admin" title="Pengaturan Platform">
      <form
        onSubmit={handleSave}
        className="max-w-xl bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Pengaturan platform disimpan.</span>
          </div>
        )}

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={requireTeacherApproval}
            onChange={(e) => setRequireTeacherApproval(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Wajibkan Persetujuan Admin untuk Guru Baru
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Jika aktif, pendaftar peran Guru berstatus menunggu persetujuan sebelum dapat membuat
              kelas dan ujian.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={studentRegistrationOpen}
            onChange={(e) => setStudentRegistrationOpen(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Buka Registrasi Siswa Baru</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Nonaktifkan jika pendaftaran akun siswa mandiri sementara ditutup.
            </p>
          </div>
        </label>

        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-slate-600 space-y-1.5">
          <p>
            Gambar soal menggunakan sistem URL eksternal atau Link/ID file Google Drive tanpa unggah
            berkas langsung ke server.
          </p>
          <p>
            Pengaturan zona waktu (WIB, WITA, WIT) dikelola masing-masing guru pada profil dan
            pengaturan jadwal ujiannya.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </form>
    </AppShell>
  );
}
