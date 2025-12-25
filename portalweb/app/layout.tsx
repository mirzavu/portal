'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, Map as MapIcon, Database, Lock, Skull, Video, Paperclip, Menu, X } from 'lucide-react';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getViewMode = () => {
    if (pathname === '/bike') return 'bike_gps';
    if (pathname === '/door-knocks') return 'door_knocks';
    if (pathname === '/camera') return 'camera';
    if (pathname === '/file-transfer') return 'file_transfer';
    return 'dashboard';
  };

  const viewMode = getViewMode();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-obsidian text-gray-300 font-sans selection:bg-blood selection:text-white">
          {/* Top Navigation / Header */}
          <nav className="sticky top-0 z-50 bg-black/90 border-b border-gray-800 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link href="/" className="flex items-center gap-3">
                  <div className="p-2 bg-blood/10 rounded-md border border-blood/40">
                    <Shield className="w-6 h-6 text-blood" />
                  </div>
                  <div>
                    <h1 className="text-xl font-serif font-bold text-white tracking-wider uppercase">
                      Secure<span className="text-blood">Hub</span>
                    </h1>
                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      GODMODE ENABLED
                    </div>
                  </div>
                </Link>

                <div className="hidden md:flex space-x-1">
                  {[
                    { id: 'dashboard', icon: Database, label: 'Mainframe', path: '/' },
                    { id: 'door_knocks', icon: Lock, label: 'Door Knock', path: '/door-knocks' },
                    { id: 'bike_gps', icon: MapIcon, label: 'Asset Tracker', path: '/bike' },
                    { id: 'camera', icon: Video, label: 'Camera Stream', path: '/camera' },
                    { id: 'file_transfer', icon: Paperclip, label: 'File Transfer', path: '/file-transfer' },
                  ].map((item) => (
                    <Link
                      key={item.id}
                      href={item.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-none border transition-all duration-300 font-mono text-xs uppercase tracking-widest
                        ${viewMode === item.id
                          ? 'bg-blood/10 border-blood text-blood shadow-[0_0_15px_rgba(138,3,3,0.3)]'
                          : 'border-transparent hover:bg-gray-900 text-gray-400 hover:text-white'
                        }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-gray-500 font-mono">ENCRYPTED LINK</div>
                    <div className="text-xs text-gold font-mono">AES-256</div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-gold to-yellow-900 border border-gold/50 flex items-center justify-center shadow-lg">
                    <Skull className="w-4 h-4 text-black" />
                  </div>

                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    {isMobileMenuOpen ? (
                      <X className="w-6 h-6" />
                    ) : (
                      <Menu className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isMobileMenuOpen && (
              <div className="md:hidden border-t border-gray-800 bg-black/95 backdrop-blur-xl">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                  {[
                    { id: 'dashboard', icon: Database, label: 'Mainframe', path: '/' },
                    { id: 'door_knocks', icon: Lock, label: 'Door Knock', path: '/door-knocks' },
                    { id: 'bike_gps', icon: MapIcon, label: 'Asset Tracker', path: '/bike' },
                    { id: 'camera', icon: Video, label: 'Camera Stream', path: '/camera' },
                    { id: 'file_transfer', icon: Paperclip, label: 'File Transfer', path: '/file-transfer' },
                  ].map((item) => (
                    <Link
                      key={item.id}
                      href={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium font-mono border-l-2 transition-all duration-200
                        ${viewMode === item.id
                          ? 'bg-blood/10 border-blood text-blood'
                          : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
