import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const pb = getPocketBase();
    
    // Get the message to find its thread_id
    const message = await pb.collection('file_transfer_messages').getOne(messageId);
    const threadId = message.thread_id;
    
    // Delete the message
    await pb.collection('file_transfer_messages').delete(messageId);
    
    // Update thread's updated timestamp
    try {
      await pb.collection('file_transfer_threads').update(threadId, {
        updated: new Date().toISOString(),
      });
    } catch (e) {
      // Continue even if update fails
      console.warn('Failed to update thread timestamp after message deletion:', e);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}

