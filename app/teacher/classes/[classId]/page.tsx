'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { Copy, Check, RefreshCw, UserMinus, ArrowLeft, Edit3 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import { classSchema, generateJoinCode } from '@/lib/validation';
import { formatWIB } from '@/lib/time';
import type { ClassMember, ClassRoom } from '@/lib/types';

export default function TeacherClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useAuth();
  const [cls, setCls] = useState<ClassRoom | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!classId || !profile?.uid) return;
    const unsubCls = onSnapshot(
      doc(db, 'classes', classId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as Omit<ClassRoom, 'id'>) };
          if (data.teacherId !== profile.uid) {
            setCls(null);
          } else {
            setCls(data);
            setEditName(data.name);
            setEditDesc(data.description || '');
          }
        } else {
          setCls(null);
        }
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `classes/${classId}`)
    );

    const unsubMembers = onSnapshot(
      collection(db, 'classes', classId, 'members'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ClassMember);
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `classes/${classId}/members`)
    );

    return () => {
      unsubCls();
      unsubMembers();
    };
  }, [classId, profile?.uid]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cls) return;
    const parsed = classSchema.safeParse({ name: editName, description: editDesc });
    if (!parsed.success) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'classes', classId), {
        name: parsed.data.name,
        description: parsed.data.description || '',
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'classCodes', cls.joinCode), {
        className: parsed.data.name,
      });
      await batch.commit();
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${classId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResetJoinCode = async () => {
    if (!cls || !profile) return;
    setBusy(true);
    try {
      const newCode = generateJoinCode();
      const batch = writeBatch(db);
      batch.delete(doc(db, 'classCodes', cls.joinCode));
      batch.set(doc(db, 'classCodes', newCode), {
        classId,
        teacherId: profile.uid,
        className: cls.name,
        isArchived: cls.isArchived,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'classes', classId), {
        joinCode: newCode,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${classId}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (member: ClassMember) => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'classes', classId, 'members', member.studentUid));
      batch.delete(doc(db, 'users', member.studentUid, 'enrollments', classId));
      batch.update(doc(db, 'classes', classId), {
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${classId}/members/${member.studentUid}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell requiredRole="teacher" title={cls?.name || 'Detail Kelas'}>
      <div className="space-y-6">
        <Link
          href="/teacher/classes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Daftar Kelas
        </Link>

        {loading ? (
          <div className="p-8 text-sm text-slate-500">Memuat kelas...</div>
        ) : !cls ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-sm text-slate-600">
            Kelas tidak ditemukan.
          </div>
        ) : (
          <>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                {!editing ? (
                  <>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900">{cls.name}</h2>
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-stone-100"
                        title="Ubah nama/deskripsi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {cls.description || 'Belum ada deskripsi kelas.'}
                    </p>
                  </>
                ) : (
                  <form onSubmit={handleSaveEdit} className="space-y-3 max-w-md">
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      maxLength={500}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Deskripsi kelas"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="px-3 py-1.5 text-xs text-slate-600"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-500">Kode Gabung Kelas</p>
                  <p className="text-2xl font-mono font-bold text-slate-900 tracking-wider tabular-nums mt-0.5">
                    {cls.joinCode}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(cls.joinCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-100"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Disalin' : 'Salin'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleResetJoinCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-slate-700 hover:bg-stone-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset Kode
                  </button>
                </div>
              </div>
            </div>

            {/* Member List */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Siswa Terdaftar ({members.length})
                </h3>
              </div>

              {members.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Belum ada siswa yang bergabung. Bagikan kode <strong className="font-mono text-slate-900">{cls.joinCode}</strong> kepada siswa Anda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Nama Siswa</th>
                        <th className="px-6 py-3 font-semibold">NIS / Nomor Induk</th>
                        <th className="px-6 py-3 font-semibold">Bergabung</th>
                        <th className="px-6 py-3 font-semibold text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {members.map((m) => (
                        <tr key={m.studentUid} className="hover:bg-stone-50">
                          <td className="px-6 py-3.5 font-medium text-slate-900">{m.displayName}</td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                            {m.studentNumber || '—'}
                          </td>
                          <td className="px-6 py-3.5 text-xs text-slate-500">
                            {formatWIB(m.joinedAt, profile?.timezone)}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveMember(m)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Keluarkan
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
