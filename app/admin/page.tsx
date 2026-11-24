'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowRight, UserCheck, Users, BookOpen, FileText } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import type { ClassRoom, Exam, UserProfile } from '@/lib/types';

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'users'),
      (snap) => setUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    const u2 = onSnapshot(
      collection(db, 'classes'),
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'classes')
    );
    const u3 = onSnapshot(
      collection(db, 'exams'),
      (snap) => setExams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exam, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'exams')
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const teachers = users.filter((u) => u.role === 'teacher');
  const pendingTeachers = teachers.filter((u) => u.status === 'pending_approval');
  const students = users.filter((u) => u.role === 'student');
  const publishedExams = exams.filter((e) => e.status === 'published');

  return (
    <AppShell requiredRole="admin" title="Dashboard Administrator">
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Guru</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{teachers.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Siswa</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{students.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Kelas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{classes.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Ujian Dipublikasikan</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {publishedExams.length}
            </p>
          </div>
        </div>

        {pendingTeachers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-amber-800" />
              <div>
                <p className="text-sm font-bold text-amber-950">
                  {pendingTeachers.length} Akun Guru Menunggu Persetujuan
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Tinjau pendaftaran guru baru sebelum mereka dapat membuat kelas dan ujian.
                </p>
              </div>
            </div>
            <Link
              href="/admin/teachers/pending"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950"
            >
              Tinjau Sekarang
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="bg-white border border-stone-200 rounded-xl p-5 hover:border-blue-700/50 transition-colors"
          >
            <Users className="w-5 h-5 text-blue-700 mb-3" />
            <p className="text-sm font-bold text-slate-900">Kelola Pengguna</p>
            <p className="text-xs text-slate-600 mt-1">
              Cari, ubah peran, atau tangguhkan akun guru dan siswa.
            </p>
          </Link>
          <Link
            href="/admin/classes"
            className="bg-white border border-stone-200 rounded-xl p-5 hover:border-blue-700/50 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-blue-700 mb-3" />
            <p className="text-sm font-bold text-slate-900">Pengawasan Kelas</p>
            <p className="text-xs text-slate-600 mt-1">
              Pantau seluruh kelas aktif dan alihkan kepemilikan jika diperlukan.
            </p>
          </Link>
          <Link
            href="/admin/exams"
            className="bg-white border border-stone-200 rounded-xl p-5 hover:border-blue-700/50 transition-colors"
          >
            <FileText className="w-5 h-5 text-blue-700 mb-3" />
            <p className="text-sm font-bold text-slate-900">Pengawasan Ujian</p>
            <p className="text-xs text-slate-600 mt-1">
              Pantau sesi ujian secara hanya-baca tanpa mengakses kunci jawaban.
            </p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
