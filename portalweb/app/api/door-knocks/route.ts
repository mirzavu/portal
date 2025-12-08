import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import { doorKnocksQuerySchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = doorKnocksQuerySchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      page: searchParams.get('page') || '1',
      perPage: searchParams.get('perPage') || '50',
    });
    
    const pb = getPocketBase();
    
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
    
    const result = await pb.collection('door_knocks').getList(
      query.page || 1,
      query.perPage || 50,
      {
        sort: '-timestamp',
        filter: filter || undefined,
      }
    );
    
    return NextResponse.json({
      items: result.items,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    console.error('Error fetching door knocks:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch door knocks' },
      { status: 500 }
    );
  }
}






