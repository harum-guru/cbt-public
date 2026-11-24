import { z } from 'zod';
import { isValidImageInput, normalizeImageInput } from '@/lib/image-url';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Maksimal 120 karakter'),
  studentNumber: z.string().trim().max(40, 'Maksimal 40 karakter').optional().or(z.literal('')),
  schoolName: z.string().trim().max(150, 'Maksimal 150 karakter').optional().or(z.literal('')),
  timezone: z.enum(['WIB', 'WITA', 'WIT']).optional(),
});

export const classSchema = z.object({
  name: z.string().trim().min(1, 'Nama kelas wajib diisi').max(120, 'Maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Maksimal 500 karakter').optional().or(z.literal('')),
});

export const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(JOIN_CODE_PATTERN, 'Kode kelas harus 6 karakter huruf/angka'),
});

const imageUrlOrDriveField = z
  .string()
  .trim()
  .max(1000)
  .refine((val) => isValidImageInput(val), {
    message: 'Masukkan URL gambar yang valid (https://...) atau ID file Google Drive.',
  })
  .transform((val) => normalizeImageInput(val))
  .optional()
  .or(z.literal(''));

export const questionOptionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1, 'Teks opsi wajib diisi').max(1500, 'Maksimal 1500 karakter'),
  imageURL: imageUrlOrDriveField,
});

export const questionSchema = z.object({
  text: z.string().trim().min(1, 'Teks soal wajib diisi').max(5000, 'Maksimal 5000 karakter'),
  imageURL: imageUrlOrDriveField,
  options: z
    .array(questionOptionSchema)
    .min(2, 'Minimal 2 opsi jawaban')
    .max(5, 'Maksimal 5 opsi jawaban'),
  correctOptionId: z.string().min(1, 'Pilih tepat satu jawaban benar').max(64),
  points: z.coerce.number().min(0, 'Bobot minimal 0').max(100, 'Bobot maksimal 100'),
  explanation: z.string().trim().max(3000, 'Maksimal 3000 karakter').optional().or(z.literal('')),
});

export const examSettingsFormSchema = z.object({
  title: z.string().trim().min(1, 'Judul ujian wajib diisi').max(200, 'Maksimal 200 karakter'),
  subject: z.string().trim().min(1, 'Mata pelajaran wajib diisi').max(100, 'Maksimal 100 karakter'),
  description: z.string().trim().max(2000, 'Maksimal 2000 karakter').optional().or(z.literal('')),
  classIds: z
    .array(z.string().regex(ID_PATTERN))
    .min(1, 'Pilih minimal 1 kelas target')
    .max(5, 'Maksimal 5 kelas target per ujian'),
  opensAt: z.string().min(1, 'Waktu buka wajib diisi'),
  closesAt: z.string().min(1, 'Waktu tutup wajib diisi'),
  timezone: z.enum(['WIB', 'WITA', 'WIT']).optional().default('WIB'),
  durationMinutes: z.coerce.number().int().min(1, 'Minimal 1 menit').max(480, 'Maksimal 480 menit'),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  maxAttempts: z.coerce.number().int().min(1).max(20),
  passingScore: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional(),
  resultsPolicy: z.enum(['answers_immediate', 'score_immediate', 'after_release']),
  allowBackNavigation: z.boolean(),
  oneQuestionPerPage: z.boolean(),
  detectTabSwitch: z.boolean(),
  requireFullscreen: z.boolean(),
  blockCopyPaste: z.boolean(),
  violationLimit: z.union([z.coerce.number().int().min(1).max(50), z.literal('')]).optional(),
  onLimitReached: z.enum(['flag_only', 'auto_submit']),
});

export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
