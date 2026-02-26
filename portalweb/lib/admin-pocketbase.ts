import PocketBase from 'pocketbase';

// Admin PocketBase client singleton
let adminPb: PocketBase | null = null;

export async function getAdminPocketBase(): Promise<PocketBase> {
    if (adminPb) {
        return adminPb;
    }

    const url = process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8095';
    const email = process.env.POCKETBASE_ADMIN_EMAIL;
    const password = process.env.POCKETBASE_ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set in environment variables');
    }

    console.log(`[ADMIN PB] Attempting to authenticate as: ${email}`);

    const pb = new PocketBase(url);

    try {
        await pb.admins.authWithPassword(email, password);
        console.log('[ADMIN PB] Admin authenticated successfully');
        adminPb = pb;
        return pb;
    } catch (error) {
        console.error('[ADMIN PB] Failed to authenticate as admin:', error);
        throw error;
    }
}
