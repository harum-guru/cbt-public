'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAPPED_ADMIN_EMAIL,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
} from '@/lib/firebase/client';
import { normalizeTimezone } from '@/lib/time';
import type { IndonesianTimezone, PlatformSettings, UserProfile, UserRole } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  platformSettings: PlatformSettings | null;
  loading: boolean;
  needsProfileSetup: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    role: 'teacher' | 'student';
    studentNumber?: string;
    schoolName?: string;
    timezone?: IndonesianTimezone;
  }) => Promise<User>;
  createUserProfile: (params: {
    role: 'teacher' | 'student';
    displayName: string;
    studentNumber?: string;
    schoolName?: string;
    timezone?: IndonesianTimezone;
  }) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'platformSettings', 'main'));
      if (snap.exists()) {
        setPlatformSettings(snap.data() as PlatformSettings);
      } else {
        setPlatformSettings({
          requireTeacherApproval: true,
          studentRegistrationOpen: true,
          maxUploadSizeMB: 2,
          defaultTimezone: 'Asia/Jakarta',
        });
      }
    } catch {
      setPlatformSettings({
        requireTeacherApproval: true,
        studentRegistrationOpen: true,
        maxUploadSizeMB: 2,
        defaultTimezone: 'Asia/Jakarta',
      });
    }
  }, []);

  const fetchOrBootstrapProfile = useCallback(
    async (user: User) => {
      try {
        await loadSettings();
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setNeedsProfileSetup(false);
          if (user.emailVerified && data.status === 'active') {
            updateDoc(userRef, {
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          return;
        }

        // Automatically bootstrap initial admin if email matches
        if (
          user.email &&
          user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
          user.emailVerified
        ) {
          const newAdminProfile: UserProfile = {
            uid: user.uid,
            role: 'admin',
            status: 'active',
            displayName: user.displayName || 'Administrator UjianKu',
            email: user.email,
            ...(user.photoURL ? { photoURL: user.photoURL } : {}),
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            lastLoginAt: serverTimestamp() as Timestamp,
          };
          await setDoc(userRef, newAdminProfile);
          await setDoc(doc(db, 'admins', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: newAdminProfile.displayName,
            createdAt: serverTimestamp(),
          });
          // Seed default platformSettings if not yet created
          const settingsRef = doc(db, 'platformSettings', 'main');
          const settingsSnap = await getDoc(settingsRef);
          if (!settingsSnap.exists()) {
            await setDoc(settingsRef, {
              requireTeacherApproval: true,
              studentRegistrationOpen: true,
              maxUploadSizeMB: 2,
              defaultTimezone: 'Asia/Jakarta',
              updatedAt: serverTimestamp(),
              updatedBy: user.uid,
            });
          }
          const created = await getDoc(userRef);
          setProfile(created.data() as UserProfile);
          setNeedsProfileSetup(false);
          return;
        }

        setProfile(null);
        setNeedsProfileSetup(true);
      } catch (err) {
        console.error('Error loading user profile:', err);
        setProfile(null);
      }
    },
    [loadSettings]
  );

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchOrBootstrapProfile(user);
      } else {
        setProfile(null);
        setNeedsProfileSetup(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [fetchOrBootstrapProfile]);

  const signInWithGoogle = async (): Promise<User> => {
    const res = await signInWithPopup(auth, googleProvider);
    await fetchOrBootstrapProfile(res.user);
    return res.user;
  };

  const signInWithEmail = async (email: string, password: string): Promise<User> => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    await fetchOrBootstrapProfile(res.user);
    return res.user;
  };

  const createUserProfile = async (params: {
    role: 'teacher' | 'student';
    displayName: string;
    studentNumber?: string;
    schoolName?: string;
    timezone?: IndonesianTimezone;
  }): Promise<UserProfile> => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('Silakan masuk terlebih dahulu.');
    }
    if (!user.emailVerified) {
      throw new Error('Verifikasi email Anda terlebih dahulu sebelum membuat profil.');
    }

    let requireTeacherApproval = true;
    let studentRegistrationOpen = true;
    try {
      const s = await getDoc(doc(db, 'platformSettings', 'main'));
      if (s.exists()) {
        const sd = s.data() as PlatformSettings;
        requireTeacherApproval = sd.requireTeacherApproval;
        studentRegistrationOpen = sd.studentRegistrationOpen;
      }
    } catch {
      // use defaults
    }

    if (params.role === 'student' && !studentRegistrationOpen) {
      throw new Error('Pendaftaran siswa baru sedang ditutup oleh administrator.');
    }

    const status =
      params.role === 'teacher' && requireTeacherApproval ? 'pending_approval' : 'active';

    const payload: Record<string, unknown> = {
      uid: user.uid,
      role: params.role as UserRole,
      status,
      displayName: params.displayName.trim(),
      email: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    if (user.photoURL) payload.photoURL = user.photoURL;
    if (params.role === 'student' && params.studentNumber?.trim()) {
      payload.studentNumber = params.studentNumber.trim();
    }
    if (params.role === 'teacher') {
      if (params.schoolName?.trim()) {
        payload.schoolName = params.schoolName.trim();
      }
      payload.timezone = normalizeTimezone(params.timezone);
    }

    try {
      await setDoc(doc(db, 'users', user.uid), payload);
      const snap = await getDoc(doc(db, 'users', user.uid));
      const created = snap.data() as UserProfile;
      setProfile(created);
      setNeedsProfileSetup(false);
      return created;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const registerWithEmail = async (params: {
    email: string;
    password: string;
    displayName: string;
    role: 'teacher' | 'student';
    studentNumber?: string;
    schoolName?: string;
    timezone?: IndonesianTimezone;
  }): Promise<User> => {
    const res = await createUserWithEmailAndPassword(auth, params.email, params.password);
    await updateProfile(res.user, { displayName: params.displayName.trim() });
    await sendEmailVerification(res.user);
    // Persist pending registration intent locally so once email is verified, profile completes smoothly
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `ujianku_reg_${res.user.uid}`,
        JSON.stringify({
          role: params.role,
          displayName: params.displayName.trim(),
          studentNumber: params.studentNumber?.trim() || '',
          schoolName: params.schoolName?.trim() || '',
          timezone: normalizeTimezone(params.timezone),
        })
      );
    }
    setFirebaseUser(res.user);
    setNeedsProfileSetup(true);
    return res.user;
  };

  const refreshProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    await user.reload();
    setFirebaseUser(auth.currentUser);
    if (auth.currentUser) {
      await fetchOrBootstrapProfile(auth.currentUser);
    }
  };

  const sendResetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Tidak ada sesi aktif.');
    await sendEmailVerification(auth.currentUser);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setNeedsProfileSetup(false);
  };

  const isAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    (profile?.role === 'admin' ||
      firebaseUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase());

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        platformSettings,
        loading,
        needsProfileSetup,
        isAdmin,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        createUserProfile,
        refreshProfile,
        sendResetPassword,
        resendVerificationEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return ctx;
}
