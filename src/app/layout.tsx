import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Meeting Room Booking',
  description: 'Self-hosted internal meeting room booking and realtime status system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-corporate-offwhite text-corporate-charcoal font-sans antialiased selection:bg-corporate-teal selection:text-white">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
