import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const { searchParams } = new URL(request.url);
    const fileIndex = searchParams.get('index') ? parseInt(searchParams.get('index')!) : null;
    
    const pb = getPocketBase();
    
    // Get the message record
    const message = await pb.collection('file_transfer_messages').getOne(messageId);
    
    // Check if message has a file
    if (!message.file) {
      return NextResponse.json(
        { error: 'Message does not have a file' },
        { status: 400 }
      );
    }
    
    // Handle multiple files (array) or single file (backward compatibility)
    let fileRef: string;
    let fileName: string;
    let fileType: string;
    
    if (Array.isArray(message.file)) {
      // Multiple files
      if (fileIndex === null || fileIndex < 0 || fileIndex >= message.file.length) {
        return NextResponse.json(
          { error: 'Invalid file index' },
          { status: 400 }
        );
      }
      fileRef = message.file[fileIndex];
      
      // Parse metadata arrays (stored as JSON strings)
      const fileNames = typeof message.file_name === 'string' 
        ? JSON.parse(message.file_name) 
        : Array.isArray(message.file_name) 
          ? message.file_name 
          : [message.file_name || 'download'];
      
      // Handle new format where file_type contains both type and size
      let fileTypes: string[];
      if (typeof message.file_type === 'string') {
        try {
          const parsed = JSON.parse(message.file_type);
          if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && 'type' in parsed[0]) {
            // New format: array of objects with type and size
            fileTypes = parsed.map((m: any) => m.type);
          } else {
            // Old format: just types array
            fileTypes = parsed;
          }
        } catch (e) {
          fileTypes = [message.file_type || 'application/octet-stream'];
        }
      } else if (Array.isArray(message.file_type)) {
        fileTypes = message.file_type;
      } else {
        fileTypes = [message.file_type || 'application/octet-stream'];
      }
      
      fileName = fileNames[fileIndex] || 'download';
      fileType = fileTypes[fileIndex] || 'application/octet-stream';
    } else {
      // Single file (backward compatibility)
      fileRef = message.file;
      fileName = typeof message.file_name === 'string' ? message.file_name : (message.file_name || 'download');
      fileType = typeof message.file_type === 'string' ? message.file_type : (message.file_type || 'application/octet-stream');
    }
    
    // Get the file URL from PocketBase
    const fileUrl = pb.files.getUrl(message, fileRef, {
      download: true,
    });
    
    // Fetch the file
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch file from storage' },
        { status: 500 }
      );
    }
    
    // Get file data
    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Encode filename for Content-Disposition header (RFC 5987)
    // Escape quotes and backslashes in filename
    const escapedFileName = fileName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    // Also provide RFC 5987 encoded version for better browser support
    const encodedFileName = encodeURIComponent(fileName);
    
    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileType,
        'Content-Disposition': `attachment; filename="${escapedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': fileBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error downloading file:', error);
    
    if (error.status === 404) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

