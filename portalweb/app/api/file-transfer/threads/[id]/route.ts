import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const pb = getPocketBase();
    
    const thread = await pb.collection('file_transfer_threads').getOne(threadId);
    
    // Get message count for this thread
    const messages = await pb.collection('file_transfer_messages').getList(1, 1, {
      filter: `thread_id = "${threadId}"`,
    });
    
    return NextResponse.json({
      ...thread,
      messageCount: messages.totalItems,
    });
  } catch (error: any) {
    console.error('Error fetching thread:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await params;
    const pb = getPocketBase();
    
    // Delete all messages in this thread first
    try {
      const messages = await pb.collection('file_transfer_messages').getFullList({
        filter: `thread_id = "${threadId}"`,
      });
      
      for (const message of messages) {
        await pb.collection('file_transfer_messages').delete(message.id);
      }
    } catch (e) {
      // Continue even if no messages exist
    }
    
    // Delete the thread
    await pb.collection('file_transfer_threads').delete(threadId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting thread:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    );
  }
}

