'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { Plus, Copy, Check, Archive, ArchiveRestore, Users, ArrowRight } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { classSchema, generateJoinCode } from '@/lib/validation';
import type { ClassRoom } from '@/lib/types';

export default function TeacherClassesPage() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'classes'), where('teacherId', '==', profile.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setClasses(list);
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
    );
    return () => unsub();
  }, [profile?.uid]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError('');
    const parsed = classSchema.safeParse({ name, description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Data kelas tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const joinCode = generateJoinCode();
      const classRef = doc(collection(db, 'classes'));
      const batch = writeBatch(db);
      batch.set(classRef, {
        teacherId: profile.uid,
        teacherName: profile.displayName,
        ...(profile.schoolName ? { schoolName: profile.schoolName } : {}),
        name: parsed.data.name,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        joinCode,
        isArchived: false,
        memberCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'classCodes', joinCode), {
        classId: classRef.id,
        teacherId: profile.uid,
        teacherName: profile.displayName,
        ...(profile.schoolName ? { schoolName: profile.schoolName } : {}),
        className: parsed.data.name,
        isArchived: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setName('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classes');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (cls: ClassRoom) => {
    if (!cls.id) return;
    try {
      await updateDoc(doc(db, 'classes', cls.id), {
        isArchived: !cls.isArchived,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'classCodes', cls.joinCode), {
        isArchived: !cls.isArchived,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${cls.id}`);
    }
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filtered = classes.filter((c) => (showArchived ? c.isArchived : !c.isArchived));

  return (
    <AppShell
      requiredRole="teacher"
      title="Kelas Saya"
      actions={
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Buat Kelas
        </button>
      }
    >
      <div className="space-y-6">
        {showCreate && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900">Buat Kelas Baru</h2>
            <p className="text-xs text-slate-600 mt-1">
              Sistem akan membuat kode gabung unik 6 karakter secara otomatis.
            </p>
            {error && (
              <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}
            <form onSubmit={handleCreate} className="mt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Kelas
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: XI IPA 2"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deskripsi Singkat (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Matematika Wajib Semester Ganjil"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              !showArchived ? 'bg-slate-900 text-white' : 'bg-white border border-stone-200 text-slate-600'
            }`}
          >
            Kelas Aktif ({classes.filter((c) => !c.isArchived).length})
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              showArchived ? 'bg-slate-900 text-white' : 'bg-white border border-stone-200 text-slate-600'
            }`}
          >
            Diarsipkan ({classes.filter((c) => c.isArchived).length})
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat kelas...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">
              {showArchived ? 'Belum ada kelas diarsipkan' : 'Belum ada kelas aktif'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {showArchived
                ? 'Kelas yang diarsipkan akan tampil di sini.'
                : 'Klik tombol Buat Kelas di kanan atas untuk membuat kelas pertama Anda.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((cls) => (
              <div
                key={cls.id}
                className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{cls.name}</h3>
                      {cls.description && (
                        <p className="text-xs text-slate-600 mt-1">{cls.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleArchive(cls)}
                      title={cls.isArchived ? 'Aktifkan kelas' : 'Arsipkan kelas'}
                      className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-stone-100"
                    >
                      {cls.isArchived ? (
                        <ArchiveRestore className="w-4 h-4" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Users className="w-3.5 h-3.5" />
                      {cls.memberCount} siswa
                    </span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => copyCode(cls.id!, cls.joinCode)}
                      className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 bg-stone-100 px-2.5 py-1 rounded-md hover:bg-stone-200"
                    >
                      <span>{cls.joinCode}</span>
                      {copiedId === cls.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Kelola Siswa &amp; Kode
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
