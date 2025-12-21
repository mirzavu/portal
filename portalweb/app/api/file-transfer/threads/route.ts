import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '50');
    
    const pb = getPocketBase();
    
    // Get threads - will sort client-side by updated timestamp
    const result = await pb.collection('file_transfer_threads').getList(
      page,
      perPage
    );
    
    // Sort by updated date (descending) - newest first (client-side sorting)
    if (result.items) {
      result.items.sort((a, b) => {
        const aTime = new Date(a.updated || a.created).getTime();
        const bTime = new Date(b.updated || b.created).getTime();
        return bTime - aTime;
      });
    }
    
    return NextResponse.json({
      items: result.items,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    console.error('Error fetching threads:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch threads', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Thread name is required' },
        { status: 400 }
      );
    }
    
    const pb = getPocketBase();
    
    const thread = await pb.collection('file_transfer_threads').create({
      name: name.trim(),
    });
    
    return NextResponse.json(thread, { status: 201 });
  } catch (error: any) {
    console.error('Error creating thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}

