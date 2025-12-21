import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { doorKnocksQuerySchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    console.log('[DOOR-KNOCKS API] Request received');
    const { searchParams } = new URL(request.url);
    const query = doorKnocksQuerySchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      page: searchParams.get('page') || '1',
      perPage: searchParams.get('perPage') || '50',
    });
    
    console.log('[DOOR-KNOCKS API] Query parsed:', query);
    console.log('[DOOR-KNOCKS API] POCKETBASE_URL:', process.env.POCKETBASE_URL);
    console.log('[DOOR-KNOCKS API] NEXT_PUBLIC_POCKETBASE_URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL);
    
    const pb = getPocketBase();
    console.log('[DOOR-KNOCKS API] PocketBase client created, baseUrl:', pb.baseUrl);
    
    // Build filter
    let filter = '';
    const filters: string[] = [];
    
    if (query.from) {
      filters.push(`timestamp >= "${new Date(query.from * 1000).toISOString()}"`);
    }
    if (query.to) {
      filters.push(`timestamp <= "${new Date(query.to * 1000).toISOString()}"`);
    }
    
    if (filters.length > 0) {
      filter = filters.join(' && ');
    }
    
    console.log('[DOOR-KNOCKS API] Filter:', filter);
    console.log('[DOOR-KNOCKS API] Fetching from PocketBase...');
    
    const result = await pb.collection('door_knocks').getList(
      query.page || 1,
      query.perPage || 50,
      {
        sort: '-timestamp',
        filter: filter || undefined,
      }
    );
    
    console.log('[DOOR-KNOCKS API] Successfully fetched', result.items.length, 'items');
    
    return NextResponse.json({
      items: result.items,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    console.error('[DOOR-KNOCKS API] Error fetching door knocks:', error);
    console.error('[DOOR-KNOCKS API] Error name:', error?.name);
    console.error('[DOOR-KNOCKS API] Error message:', error?.message);
    console.error('[DOOR-KNOCKS API] Error status:', error?.status);
    console.error('[DOOR-KNOCKS API] Error isAbort:', error?.isAbort);
    console.error('[DOOR-KNOCKS API] Error response:', error?.response);
    console.error('[DOOR-KNOCKS API] Error originalError:', error?.originalError);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch door knocks',
        details: error?.message || 'Unknown error',
        status: error?.status || 500
      },
      { status: 500 }
    );
  }
}








