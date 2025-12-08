'use client';

const PIN_STORAGE_KEY = 'auth_pin_verified';
const PIN_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function getPINCode(): string {
  return process.env.NEXT_PUBLIC_PIN_CODE || '1234';
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem(PIN_STORAGE_KEY);
  if (!stored) return false;
  
  try {
    const { timestamp } = JSON.parse(stored);
    const now = Date.now();
    // Check if session is still valid (24 hours)
    if (now - timestamp > PIN_SESSION_DURATION) {
      localStorage.removeItem(PIN_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setAuthenticated(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
}

export function clearAuthentication(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_STORAGE_KEY);
}

export function verifyPIN(pin: string): boolean {
  return pin === getPINCode();
}






