'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, User as UserIcon, Shield, Sparkles } from 'lucide-react';
import { UserSession, authStorage } from '@/lib/auth';
import api from '@/lib/api';
import { useToast } from './ToastContext';
import CourierShiftToggle from '@/components/courier/CourierShiftToggle';

interface NavbarProps {
  user: UserSession | null;
  onMenuClick: () => void;
}

export default function Navbar({ user, onMenuClick }: NavbarProps) {
  const router = useRouter();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Ignore network/server errors during logout
    } finally {
      authStorage.clearSession();
      toast.info('Signed out successfully.');
      router.push('/login');
    }
  };

  const formatRoleName = (role?: string) => {
    if (!role) return 'Guest';
    return role.replace('ROLE_', '');
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ROLE_ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'ROLE_MERCHANT':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ROLE_COURIER':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
      {/* Left section: mobile hamburger & title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>SwiftDrop Parcel Delivery Platform</span>
        </div>
      </div>

      {/* Right section: user profile, shift toggle & logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            {/* Courier Shift Availability Switch (Demo Act 1A) */}
            {user.role === 'ROLE_COURIER' && (
              <>
                <CourierShiftToggle />
                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
              </>
            )}

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {user.fullName || user.email}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight truncate max-w-[150px]">
                  {user.email}
                </span>
              </div>
            </div>

            <span
              className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getRoleBadgeColor(
                user.role
              )}`}
            >
              <Shield className="w-2.5 h-2.5 mr-1" />
              {formatRoleName(user.role)}
            </span>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/login')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Log In
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
