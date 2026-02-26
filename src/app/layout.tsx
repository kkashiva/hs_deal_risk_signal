import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Deal Risk Engine — AI Early Warning",
  description: "AI-powered deal risk detection for HubSpot. Detect risk signals before deals are lost.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <nav className="nav">
            <a href="/" className="nav-brand">
              <span className="nav-brand-icon">🛡️</span>
              <div>
                <h1>Sales Deal Risk Engine</h1>
                <span>AI Early Warning System</span>
              </div>
            </a>
            <div className="nav-actions">
              <a href="/" className="btn btn-sm">📊 Dashboard</a>
              <a href="/scan-history" className="btn btn-sm">📋 Scan History</a>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
