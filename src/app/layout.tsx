import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';
import Image from 'next/image';
import { Analytics } from "@vercel/analytics/next";
import { LogoutButton } from './logout-button';
import { getCurrentUser } from '@/lib/auth-helpers';

export const metadata: Metadata = {
  title: "Sales Deal Risk Engine — AI Early Warning",
  description: "AI-powered deal risk detection for HubSpot. Detect risk signals before deals are lost.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Track user activity + login on every page load (throttled in getCurrentUser)
  await getCurrentUser().catch(() => {});
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <nav className="nav">
            <Link href="/" className="nav-brand">
              <Image src="/riverside.svg" alt="Riverside.fm" width={149} height={24} style={{ height: '24px', width: 'auto', marginRight: '8px' }} priority />
              <div>
                <h1>Sales Deal Risk Engine</h1>
                <span>AI Early Warning System</span>
              </div>
            </Link>
            <div className="nav-actions">
              <Link href="/" className="btn btn-sm">📊 Dashboard</Link>
              <Link href="/lost-deals" className="btn btn-sm">📉 Lost Deals</Link>
              <Link href="/scan-history" className="btn btn-sm">📋 Scan History</Link>
              <LogoutButton />
            </div>
          </nav>
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
