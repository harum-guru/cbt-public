'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  ShieldCheck,
  Settings,
  ClipboardList,
  LogOut,
  Bell,
  UserCheck,
  Database,
  Menu,
  X,
  UserCircle2,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from './AuthProvider';
import type { NotificationItem, UserRole } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Ringkasan', href: '/admin', icon: LayoutDashboard },
    { label: 'Persetujuan Guru', href: '/admin/teachers/pending', icon: UserCheck },
    { label: 'Pengguna', href: '/admin/users', icon: Users },
    { label: 'Kelas', href: '/admin/classes', icon: BookOpen },
    { label: 'Ujian', href: '/admin/exams', icon: FileText },
    { label: 'Kelola Admin', href: '/admin/admins', icon: ShieldCheck },
    { label: 'Audit Log', href: '/admin/audit-logs', icon: ClipboardList },
    { label: 'Pengaturan', href: '/admin/settings', icon: Settings },
  ],
  teacher: [
    { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
    { label: 'Kelas Saya', href: '/teacher/classes', icon: BookOpen },
    { label: 'Daftar Ujian', href: '/teacher/exams', icon: FileText },
    { label: 'Bank Soal', href: '/teacher/question-bank', icon: Database },
    { label: 'Profil', href: '/profile', icon: UserCircle2 },
  ],
  student: [
    { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
    { label: 'Kelas & Gabung', href: '/student/classes', icon: BookOpen },
    { label: 'Profil', href: '/profile', icon: UserCircle2 },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrator',
  teacher: 'Guru',
  student: 'Siswa',
};

export function AppShell({
  children,
  requiredRole,
  title,
  actions,
}: {
  children: React.ReactNode;
  requiredRole?: UserRole | 'any';
  title?: string;
  actions?: React.ReactNode;
}) {
  const { firebaseUser, profile, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace('/login');
      return;
    }
    if (!profile) {
      router.replace('/register');
      return;
    }
    if (profile.status === 'pending_approval') {
      router.replace('/pending-approval');
      return;
    }
    if (profile.status === 'suspended') {
      router.replace('/suspended');
      return;
    }
    if (requiredRole && requiredRole !== 'any') {
      if (requiredRole === 'admin' && !isAdmin) {
        router.replace(profile.role === 'teacher' ? '/teacher' : '/student');
      } else if (requiredRole !== 'admin' && profile.role !== requiredRole) {
        router.replace(isAdmin ? '/admin' : profile.role === 'teacher' ? '/teacher' : '/student');
      }
    }
  }, [loading, firebaseUser, profile, requiredRole, isAdmin, router]);

  useEffect(() => {
    if (!firebaseUser?.uid || !firebaseUser.emailVerified || !profile || profile.status !== 'active') {
      return;
    }
    const q = query(
      collection(db, 'notifications', firebaseUser.uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }))
        );
      },
      () => {
        // Ignore if empty/unavailable
      }
    );
    return () => unsub();
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, profile]);

  if (loading || !firebaseUser || !profile || profile.status !== 'active') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Memuat ruang kerja UjianKu...</div>
      </div>
    );
  }

  const effectiveRole: UserRole = isAdmin ? 'admin' : profile.role;
  const navItems = NAV_BY_ROLE[effectiveRole];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (item: NotificationItem) => {
    if (!item.id || item.read) return;
    try {
      await updateDoc(doc(db, 'notifications', firebaseUser.uid, 'items', item.id), {
        read: true,
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-stone-200">
        <div className="h-16 px-6 flex items-center justify-between border-b border-stone-200">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
            UjianKu
          </Link>
        </div>
        <div className="px-6 py-4 border-b border-stone-200">
          <p className="text-xs font-medium text-slate-500">{ROLE_LABEL[effectiveRole]}</p>
          <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{profile.displayName}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== `/${effectiveRole}` &&
                item.href !== '/profile' &&
                pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-stone-200">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-stone-100 hover:text-red-700 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[80vw] bg-white h-full flex flex-col border-r border-stone-200 z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200">
              <span className="text-lg font-bold text-slate-900">UjianKu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 text-slate-600 hover:text-slate-900"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 border-b border-stone-200">
              <p className="text-xs font-medium text-slate-500">{ROLE_LABEL[effectiveRole]}</p>
              <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">{profile.displayName}</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-stone-200">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push('/login');
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-stone-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {title || 'Ruang Kerja'}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {actions}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-stone-100 hover:text-slate-900 transition-colors"
                aria-label="Notifikasi"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifikasi</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Belum ada notifikasi baru.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            markRead(item);
                            if (item.href) {
                              setNotifOpen(false);
                              router.push(item.href);
                            }
                          }}
                          className={`p-3.5 cursor-pointer hover:bg-stone-50 transition-colors ${
                            !item.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
