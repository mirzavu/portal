import PocketBase from 'pocketbase';

// PocketBase client singleton
let pb: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!pb) {
    const url = process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8095';
    pb = new PocketBase(url);
  }
  return pb;
}

// For client-side usage (creates a new instance each time to avoid SSR issues)
export function getPocketBaseClient(): PocketBase {
  if (typeof window === 'undefined') {
    throw new Error('getPocketBaseClient can only be used on the client side');
  }
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8095';
  return new PocketBase(url);
}








