'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending_approval' | 'suspended'>('all');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserProfile);
        list.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.schoolName || '').toLowerCase().includes(q)
    );
  });

  return (
    <AppShell requiredRole="admin" title="Daftar Pengguna">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email pengguna..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-sm"
          >
            <option value="all">Semua Peran</option>
            <option value="teacher">Guru</option>
            <option value="student">Siswa</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="pending_approval">Menunggu Persetujuan</option>
            <option value="suspended">Ditangguhkan</option>
          </select>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nama</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Peran</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filtered.map((u) => (
                  <tr key={u.uid} className="hover:bg-stone-50">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">{u.displayName}</p>
                      {u.schoolName && (
                        <p className="text-xs text-slate-500 mt-0.5">{u.schoolName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{u.email}</td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700 capitalize">
                      {u.role === 'teacher' ? 'Guru' : u.role === 'student' ? 'Siswa' : 'Admin'}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold">
                      <span
                        className={
                          u.status === 'active'
                            ? 'text-emerald-700'
                            : u.status === 'pending_approval'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }
                      >
                        {u.status === 'active'
                          ? 'Aktif'
                          : u.status === 'pending_approval'
                            ? 'Menunggu'
                            : 'Ditangguhkan'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/users/${u.uid}`}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
