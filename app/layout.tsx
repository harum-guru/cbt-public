import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'UjianKu — Platform Ujian Pilihan Ganda Sekolah',
  description:
    'Aplikasi ujian online pilihan ganda dengan penilaian otomatis instan, pengawasan tab realtime, dan isolasi kunci jawaban untuk guru, siswa, dan admin sekolah.',
  openGraph: {
    title: 'UjianKu — Platform Ujian Pilihan Ganda Sekolah',
    description:
      'Susun ujian pilihan ganda, pantau pengerjaan siswa secara realtime, dan dapatkan nilai otomatis seketika.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UjianKu — Platform Ujian Pilihan Ganda Sekolah',
    description:
      'Aplikasi ujian online pilihan ganda dengan penilaian otomatis dan pengawasan realtime.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-stone-50 text-slate-900 antialiased selection:bg-blue-700 selection:text-white"
      >
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
