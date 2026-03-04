import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tarksh AI POC',
  description: 'AI Pipeline Validation for Tarksh Inbox',
};

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/test', label: 'Test Messages', icon: '🧪' },
  { href: '/batch', label: 'Batch Test', icon: '📋' },
  { href: '/kb', label: 'Knowledge Base', icon: '📚' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-card border-r border-border flex flex-col shrink-0">
            <div className="p-4 border-b border-border">
              <h1 className="text-lg font-bold text-foreground">Tarksh AI POC</h1>
              <p className="text-xs text-muted mt-1">Pipeline Validation</p>
            </div>
            <nav className="flex-1 p-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent-light transition-colors"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-border text-xs text-muted">
              v0.1 POC
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
