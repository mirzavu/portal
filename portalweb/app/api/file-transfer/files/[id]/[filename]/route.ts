import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string, filename: string }> }
) {
  try {
    const { id: messageId, filename: encodedFilename } = await params;
    const filename = decodeURIComponent(encodedFilename);
    const { searchParams } = new URL(request.url);
    const forceDownload = searchParams.get('download') === 'true';

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
    let fileType: string;
    let foundIndex = -1;

    const fileNames = typeof message.file_name === 'string'
      ? JSON.parse(message.file_name)
      : Array.isArray(message.file_name)
        ? message.file_name
        : [message.file_name || 'download'];

    // Find index by filename
    if (Array.isArray(fileNames)) {
      foundIndex = fileNames.findIndex((name: string) => name === filename);
    } else if (fileNames === filename) {
      foundIndex = 0;
    }

    if (foundIndex === -1 && Array.isArray(message.file)) {
      // Fallback: try checking if filename matches the message.file (id) directly, or just fail
      // Since user requested "link ending with aa.jpg", we rely on file_name matching
      return NextResponse.json(
        { error: 'File not found in message' },
        { status: 404 }
      );
    } else if (foundIndex === -1 && !Array.isArray(message.file)) {
      // Single file case check
      const singleName = typeof message.file_name === 'string' ? message.file_name : (message.file_name || 'download');
      if (singleName !== filename) {
        return NextResponse.json(
          { error: 'File not found in message' },
          { status: 404 }
        );
      }
      foundIndex = 0;
    }

    if (Array.isArray(message.file)) {
      fileRef = message.file[foundIndex];

      // Handle new format where file_type contains both type and size
      let fileTypes: string[];
      if (typeof message.file_type === 'string') {
        try {
          const parsed = JSON.parse(message.file_type);
          if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && 'type' in parsed[0]) {
            fileTypes = parsed.map((m: any) => m.type);
          } else {
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

      fileType = fileTypes[foundIndex] || 'application/octet-stream';
    } else {
      // Single file
      fileRef = message.file;
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
    const escapedFileName = filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    // Also provide RFC 5987 encoded version for better browser support
    const encodedFileName = encodeURIComponent(filename);

    const dispositionType = forceDownload ? 'attachment' : 'inline';

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileType,
        'Content-Disposition': `${dispositionType}; filename="${escapedFileName}"; filename*=UTF-8''${encodedFileName}`,
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


