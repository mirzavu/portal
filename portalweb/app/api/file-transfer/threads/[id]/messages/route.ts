import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params - Next.js 15+ requires this
    const { id: threadId } = await params;
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '100');
    
    const pb = getPocketBase();
    
    // Query messages - PocketBase will return empty if thread doesn't exist
    const result = await pb.collection('file_transfer_messages').getList(
      page,
      perPage,
      {
        filter: `thread_id = "${threadId}"`,
        expand: 'thread_id',
      }
    );
    
    // Sort by timestamp (client-side) - newest first
    if (result.items) {
      result.items.sort((a, b) => {
        const aTime = new Date(a.timestamp || a.created).getTime();
        const bTime = new Date(b.timestamp || b.created).getTime();
        return aTime - bTime; // ascending order (oldest first)
      });
      
      // Parse JSON metadata for multiple files
      result.items.forEach((item: any) => {
        if (item.file_name && typeof item.file_name === 'string') {
          try {
            item.file_name = JSON.parse(item.file_name);
          } catch (e) {
            // If parsing fails, keep as string (backward compatibility)
          }
        }
        if (item.file_type && typeof item.file_type === 'string') {
          try {
            const parsed = JSON.parse(item.file_type);
            // Check if it's the new format (array of objects with type and size)
            if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && 'type' in parsed[0]) {
              // New format: extract types and sizes
              item.file_type = parsed.map((m: any) => m.type);
              item.file_size = parsed.map((m: any) => m.size);
            } else {
              // Old format: just types array
              item.file_type = parsed;
            }
          } catch (e) {
            // If parsing fails, keep as string (backward compatibility)
          }
        }
        // Handle old format where file_size might be a string (shouldn't happen, but for safety)
        if (item.file_size && typeof item.file_size === 'string') {
          try {
            item.file_size = JSON.parse(item.file_size);
          } catch (e) {
            // If parsing fails, keep as string (backward compatibility)
          }
        }
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
    console.error('Error fetching messages:', error);
    console.error('Error details:', error.message, error.status, error.response);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params - Next.js 15+ requires this
    const { id: threadId } = await params;
    
    console.log('[DEBUG] Thread ID from params:', threadId);
    console.log('[DEBUG] Thread ID type:', typeof threadId);
    
    const pb = getPocketBase();
    
    // Verify thread exists first
    try {
      const thread = await pb.collection('file_transfer_threads').getOne(threadId);
      console.log('[DEBUG] Thread found:', thread.id, thread.name);
    } catch (threadError: any) {
      console.error('[DEBUG] Thread lookup failed:', threadError.status, threadError.message);
      return NextResponse.json(
        { error: 'Thread not found', details: threadError.message },
        { status: 404 }
      );
    }
    
    // Get FormData from request
    const formData = await request.formData();
    const message = formData.get('message') as string | null;
    const files = formData.getAll('files') as File[];
    
    console.log('[DEBUG] Received message:', message);
    console.log('[DEBUG] Received files:', files.length, files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    // At least one of message or files must be provided
    if (!message && files.length === 0) {
      return NextResponse.json(
        { error: 'Either message or files must be provided' },
        { status: 400 }
      );
    }
    
    // Create FormData for PocketBase - must match exactly what PocketBase expects
    // Use Node.js compatible FormData (global FormData in Node 18+)
    const pbFormData = new FormData();
    pbFormData.append('thread_id', threadId);
    console.log('[DEBUG] Appended thread_id to FormData:', threadId);
    
    const timestamp = new Date().toISOString();
    pbFormData.append('timestamp', timestamp);
    console.log('[DEBUG] Appended timestamp:', timestamp);
    
    if (message && message.trim()) {
      const msgText = message.trim();
      pbFormData.append('message', msgText);
      console.log('[DEBUG] Appended message:', msgText);
    }
    
    // Debug: Log what we're sending (without file content)
    const formDataKeys = Array.from(pbFormData.keys());
    console.log('[DEBUG] FormData fields before files:', formDataKeys);
    console.log('[DEBUG] FormData thread_id value check:', pbFormData.get('thread_id'));
    
    // Handle multiple file uploads - pass file streams directly to PocketBase
    const fileNames: string[] = [];
    const fileSizes: number[] = [];
    const fileTypes: string[] = [];
    
    if (files.length > 0) {
      // According to PocketBase docs: append files directly with same field name
      // https://pocketbase.io/docs/files-handling/
      for (const file of files) {
        if (file.size > 0) {
          console.log('[DEBUG] Processing file:', file.name, file.size, 'bytes');
          
          // Append file directly to FormData (PocketBase handles File/Blob instances)
          // Use only 2 parameters as per PocketBase documentation
          pbFormData.append('file', file);
          console.log('[DEBUG] Appended file to FormData:', file.name);
          
          // Store metadata in arrays
          fileNames.push(file.name);
          fileSizes.push(file.size);
          fileTypes.push(file.type || 'application/octet-stream');
        }
      }
      
      // Store metadata as JSON strings (PocketBase text fields)
      // Note: file_size is a number field, so we store individual sizes in file_type as JSON
      // and store total size in file_size for backward compatibility
      if (fileNames.length > 0) {
        pbFormData.append('file_name', JSON.stringify(fileNames));
        // Store total size in file_size (number field)
        const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);
        pbFormData.append('file_size', totalSize.toString());
        // Store individual sizes and types together in file_type as JSON
        const fileMetadata = fileTypes.map((type, idx) => ({
          type,
          size: fileSizes[idx]
        }));
        pbFormData.append('file_type', JSON.stringify(fileMetadata));
        console.log('[DEBUG] Appended file metadata arrays');
      }
    }
    
    // Final check of FormData contents
    const finalFormDataKeys = Array.from(pbFormData.keys());
    console.log('[DEBUG] Final FormData fields:', finalFormDataKeys);
    console.log('[DEBUG] Final thread_id value:', pbFormData.get('thread_id'));
    
    // Create the message using FormData
    console.log('[DEBUG] Attempting to create message in PocketBase...');
    console.log('[DEBUG] Files count:', files.length);
    console.log('[DEBUG] File names:', fileNames);
    console.log('[DEBUG] File sizes:', fileSizes);
    
    let createdMessage;
    try {
      createdMessage = await pb.collection('file_transfer_messages').create(pbFormData);
      console.log('[DEBUG] Message created successfully:', createdMessage.id);
    } catch (createError: any) {
      console.error('[DEBUG] PocketBase create error:', createError);
      console.error('[DEBUG] Error status:', createError.status);
      console.error('[DEBUG] Error message:', createError.message);
      console.error('[DEBUG] Error data:', createError.data);
      console.error('[DEBUG] Error response:', createError.response);
      if (createError.data) {
        console.error('[DEBUG] Error data details:', JSON.stringify(createError.data, null, 2));
      }
      throw createError;
    }
    
    // Update thread's updated timestamp by updating the thread (skip if update fails)
    try {
      console.log('[DEBUG] Updating thread timestamp:', threadId);
      await pb.collection('file_transfer_threads').update(threadId, {
        updated: new Date().toISOString(),
      });
      console.log('[DEBUG] Thread timestamp updated successfully');
    } catch (updateError: any) {
      // Log but don't fail - thread update is optional
      console.warn('[DEBUG] Failed to update thread timestamp:', updateError.message);
    }
    
    return NextResponse.json(createdMessage, { status: 201 });
  } catch (error: any) {
    console.error('Error creating message:', error);
    console.error('Error details:', error.message, error.status);
    console.error('Error response:', JSON.stringify(error.response, null, 2));
    console.error('Error data:', error.response?.data);
    console.error('Error stack:', error.stack);
    
    // Extract more detailed error information
    let errorMessage = error.message || 'Failed to create message';
    let errorDetails: any = { message: errorMessage };
    
    if (error.data) {
      errorDetails.data = error.data;
      if (typeof error.data === 'object') {
        errorMessage = error.data.message || error.data.error || errorMessage;
      }
    }
    
    if (error.response?.data) {
      errorDetails.response = error.response.data;
      if (typeof error.response.data === 'object') {
        errorMessage = error.response.data.message || error.response.data.error || errorMessage;
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create message', 
        details: errorMessage,
        fullError: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

