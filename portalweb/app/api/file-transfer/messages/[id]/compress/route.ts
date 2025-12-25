
import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

// Helper to download file
async function downloadFile(url: string, destPath: string) {
    console.log('[DEBUG] downloadFile fetching:', url);
    const res = await fetch(url);
    console.log('[DEBUG] downloadFile status:', res.status, res.statusText);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText} (Status: ${res.status})`);
    if (!res.body) throw new Error('No body in response');

    // @ts-ignore
    await pipeline(res.body, fs.createWriteStream(destPath));
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: messageId } = await params;
    const tempFiles: string[] = [];

    try {
        const { action, fileName } = await request.json();

        if (!messageId || !action || !fileName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const pb = getPocketBase();
        const record = await pb.collection('file_transfer_messages').getOne(messageId);

        // Parse metadata
        let fileNames: string[] = [];
        let fileSizes: number[] = [];
        let fileTypes: string[] = [];

        // Safe parse helpers
        const parseJSON = (val: any) => {
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return val; }
            }
            return val;
        };

        const rawNames = parseJSON(record.file_name);
        fileNames = Array.isArray(rawNames) ? rawNames : [rawNames];

        const rawTypes = parseJSON(record.file_type);
        if (Array.isArray(rawTypes) && typeof rawTypes[0] === 'object') {
            fileTypes = rawTypes.map((t: any) => t.type);
            fileSizes = rawTypes.map((t: any) => t.size);
        } else if (Array.isArray(rawTypes)) {
            fileTypes = rawTypes;
            // Sizes might be in file_size field if old format, but we'll try to reconstruct from record or just update what we change
        }

        // Fallback for sizes if not in file_type
        if (fileSizes.length === 0) {
            // If we can't get individual sizes easily, we might struggle. 
            // But we only need to update the size of the *modified* file.
            // Let's assume we maintain the array structure.
            // For simple fallback, let's fill with 0s if missing, creating a new array.
            fileSizes = new Array(fileNames.length).fill(0);
        }

        const fileIndex = fileNames.indexOf(fileName);
        if (fileIndex === -1) {
            return NextResponse.json({ error: 'File not found in message' }, { status: 404 });
        }

        // Prepare temp paths
        const tempDir = os.tmpdir();
        const originalExt = path.extname(fileName);
        const originalTempPath = path.join(tempDir, `orig_${Date.now()}_${fileName}`);
        tempFiles.push(originalTempPath);

        // Get the correct file reference from PocketBase (the actual stored filename)
        const fileRef = Array.isArray(record.file) ? record.file[fileIndex] : record.file;

        // Download original file
        const fileUrl = pb.files.getURL(record, fileRef);
        await downloadFile(fileUrl, originalTempPath);

        let outputTempPath = '';
        let newFileName = '';
        let newMimeType = '';

        if (action === 'compress_image_jpeg') {
            newFileName = fileName.replace(/\.[^/.]+$/, "") + '.jpg';
            outputTempPath = path.join(tempDir, `proc_${Date.now()}_${newFileName}`);
            tempFiles.push(outputTempPath);
            newMimeType = 'image/jpeg';

            // .rotate() with no args uses EXIF orientation to auto-rotate
            await sharp(originalTempPath)
                .rotate()
                .jpeg({ quality: 80, mozjpeg: true })
                .toFile(outputTempPath);

        } else if (action === 'compress_image_original') {
            newFileName = fileName; // Keep name (or maybe prefix? User said "rename to compressed file"?)
            // User said "delete the original file and rename to compressed file".
            // If we keep the format, we can keep the name, or modify it. 
            // If we keep the name, PB might version it (name_xyz.png). 
            // To ensure it's treated as a replacement, let's append "_compressed" if extension is same, or just rely on PB handling.
            // Actually user said: "rename to compressed file". Let's maybe append "_compressed"? 
            // Or if format changes, name changes.
            // If format is same, maybe "filename_compressed.ext".
            const namePart = fileName.replace(/\.[^/.]+$/, "");
            newFileName = `${namePart}_compressed${originalExt}`;

            outputTempPath = path.join(tempDir, `proc_${Date.now()}_${newFileName}`);
            tempFiles.push(outputTempPath);
            // Detect mime? Sharp preserves.
            newMimeType = fileTypes[fileIndex] || 'image/png'; // Fallback

            // Sharp processing based on extension
            // .rotate() with no args uses EXIF orientation to auto-rotate
            const instance = sharp(originalTempPath).rotate();

            if (originalExt.toLowerCase() === '.png') {
                await instance.png({ quality: 80, compressionLevel: 9 }).toFile(outputTempPath);
            } else if (['.jpg', '.jpeg'].includes(originalExt.toLowerCase())) {
                await instance.jpeg({ quality: 80, mozjpeg: true }).toFile(outputTempPath);
            } else if (originalExt.toLowerCase() === '.webp') {
                await instance.webp({ quality: 80 }).toFile(outputTempPath);
            } else {
                // Fallback just copy/optimize generic
                await instance.toFile(outputTempPath);
            }

        } else if (action === 'compress_video') {
            newFileName = fileName.replace(/\.[^/.]+$/, "") + '.mp4';
            outputTempPath = path.join(tempDir, `proc_${Date.now()}_${newFileName}`);
            tempFiles.push(outputTempPath);
            newMimeType = 'video/mp4';

            await new Promise((resolve, reject) => {
                ffmpeg(originalTempPath)
                    .output(outputTempPath)
                    .videoCodec('libx264')
                    // CRF 23 is default for x264, good balance. Lower is better quality.
                    // Preset medium is default, good balance of speed/compression.
                    .addOptions(['-crf 23', '-preset medium'])
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const newStats = fs.statSync(outputTempPath);
        const newSize = newStats.size;

        // Update PB using "Replace on Disk" strategy for stability
        // This avoids complications with PocketBase file field replacement in FormData
        const storageDir = path.join(process.cwd(), 'pb_data', 'storage', record.collectionId, messageId);
        const storagePath = path.join(storageDir, fileRef);

        console.log('[DEBUG] Replacing file on disk:', storagePath);

        // Ensure storage directory exists (it should, but just in case)
        if (!fs.existsSync(storageDir)) {
            console.warn('[DEBUG] Storage directory not found, creating:', storageDir);
            fs.mkdirSync(storageDir, { recursive: true });
        }

        // Overwrite the original stored file with compressed content
        fs.copyFileSync(outputTempPath, storagePath);

        // Delete any existing thumbnails for this file to force regeneration
        const thumbDir = path.join(storageDir, `thumbs_${fileRef}`);
        if (fs.existsSync(thumbDir)) {
            try {
                fs.rmSync(thumbDir, { recursive: true, force: true });
            } catch (e) {
                console.warn('[DEBUG] Failed to delete thumbnails:', e);
            }
        }

        // Update metadata arrays
        if (fileIndex !== -1) {
            fileNames[fileIndex] = newFileName;
            fileSizes[fileIndex] = newSize;
            fileTypes[fileIndex] = newMimeType;
        }

        // Update PB record via JSON (PATCH) - this updates metadata only
        const updateData: any = {
            file_name: JSON.stringify(fileNames),
            file_type: JSON.stringify(fileTypes.map((type, i) => ({ type, size: fileSizes[i] }))),
            file_size: fileSizes.reduce((a, b) => a + b, 0),
            updated: new Date().toISOString()
        };

        const updatedRecord = await pb.collection('file_transfer_messages').update(messageId, updateData);

        return NextResponse.json(updatedRecord);

    } catch (error: any) {
        console.error('Compression error:', error);
        return NextResponse.json({ error: error.message || 'Compression failed' }, { status: 500 });
    } finally {
        // Cleanup
        for (const f of tempFiles) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { console.error('Cleanup error:', e); }
        }
    }
}
