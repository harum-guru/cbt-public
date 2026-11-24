import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'student';
export type AccountStatus = 'active' | 'pending_approval' | 'suspended';
export type IndonesianTimezone = 'WIB' | 'WITA' | 'WIT';

export interface UserProfile {
  uid: string;
  role: UserRole;
  status: AccountStatus;
  displayName: string;
  email: string;
  photoURL?: string;
  studentNumber?: string;
  schoolName?: string;
  timezone?: IndonesianTimezone;
  approvedBy?: string;
  approvedAt?: Timestamp;
  suspendedReason?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
  addedBy?: string;
  createdAt: Timestamp;
}

export interface PlatformSettings {
  requireTeacherApproval: boolean;
  studentRegistrationOpen: boolean;
  maxUploadSizeMB: number;
  defaultTimezone: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface AuditLog {
  id?: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: 'user' | 'class' | 'exam' | 'settings';
  targetId: string;
  reason?: string;
  meta?: Record<string, unknown>;
  at: Timestamp;
}

export interface ClassRoom {
  id?: string;
  teacherId: string;
  teacherName?: string;
  schoolName?: string;
  name: string;
  description?: string;
  joinCode: string;
  isArchived: boolean;
  memberCount: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClassMember {
  studentUid: string;
  displayName: string;
  studentNumber?: string;
  joinCode: string;
  joinedAt: Timestamp;
}

export interface StudentEnrollment {
  classId: string;
  className: string;
  teacherId: string;
  teacherName?: string;
  schoolName?: string;
  joinedAt: Timestamp;
}

export type ExamStatus = 'draft' | 'published' | 'closed' | 'archived';
export type ResultsPolicy = 'answers_immediate' | 'score_immediate' | 'after_release';
export type ViolationLimitAction = 'flag_only' | 'auto_submit';
export type QuestionVoidStatus = 'none' | 'all_correct' | 'excluded';

export interface ExamSettings {
  opensAt: Timestamp;
  closesAt: Timestamp;
  timezone?: IndonesianTimezone;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  passingScore?: number;
  resultsPolicy: ResultsPolicy;
  allowBackNavigation: boolean;
  oneQuestionPerPage: boolean;
  proctoring: {
    detectTabSwitch: boolean;
    requireFullscreen: boolean;
    blockCopyPaste: boolean;
    violationLimit?: number;
    onLimitReached: ViolationLimitAction;
  };
}

export interface Exam {
  id?: string;
  teacherId: string;
  teacherName?: string;
  schoolName?: string;
  title: string;
  description?: string;
  subject: string;
  classIds: string[];
  status: ExamStatus;
  settings: ExamSettings;
  totalPoints: number;
  questionCount: number;
  attemptCount?: number;
  resultsReleased: boolean;
  sealedKeyToken?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassExamRef {
  examId: string;
  teacherId: string;
  title: string;
  subject: string;
  status: ExamStatus;
  opensAt: Timestamp;
  closesAt: Timestamp;
  timezone?: IndonesianTimezone;
  durationMinutes: number;
  questionCount?: number;
  updatedAt?: Timestamp;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageURL?: string;
}

export interface ExamQuestion {
  id: string;
  order: number;
  text: string;
  imageURL?: string;
  options: QuestionOption[];
  points: number;
  voided?: QuestionVoidStatus;
}

export interface AnswerKey {
  correctOptionId: string;
  explanation?: string;
}

export interface StudentAnswerEntry {
  optionId: string | null;
  flagged: boolean;
  updatedAt: number;
}

export interface ExamAttempt {
  id?: string;
  studentId: string;
  studentName?: string;
  studentNumber?: string;
  classId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted';
  startedAt: Timestamp;
  deadline: Timestamp;
  submittedAt?: Timestamp;
  questionOrder: string[];
  optionOrder: Record<string, string[]>;
  answers: Record<string, StudentAnswerEntry>;
  answeredCount: number;
  violations: number;
  presence: 'online' | 'disconnected';
  lastHeartbeatAt: Timestamp;
  flaggedForReview: boolean;
  score?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  correctCount?: number;
  resultReleased: boolean;
  gradedAt?: Timestamp;
  teacherNote?: string;
}

export type AttemptEventType =
  | 'tab_hidden'
  | 'tab_visible'
  | 'window_blur'
  | 'window_focus'
  | 'fullscreen_exit'
  | 'page_unload'
  | 'disconnected'
  | 'reconnected'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'teacher_action';

export interface AttemptEvent {
  id?: string;
  studentId: string;
  type: AttemptEventType;
  at: Timestamp;
  durationAwayMs?: number;
  meta?: Record<string, unknown>;
}

export interface QuestionBankItem {
  id?: string;
  teacherId: string;
  subject?: string;
  text: string;
  imageURL?: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
  points: number;
  tags?: string[];
  createdAt: Timestamp;
}

export interface NotificationItem {
  id?: string;
  userId: string;
  classId?: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: Timestamp;
}
