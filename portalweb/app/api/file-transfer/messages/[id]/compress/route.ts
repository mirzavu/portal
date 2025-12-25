
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
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
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

        // Download original file
        const fileUrl = pb.files.getUrl(record, fileName);
        await downloadFile(fileUrl, originalTempPath);

        let outputTempPath = '';
        let newFileName = '';
        let newMimeType = '';

        if (action === 'compress_image_jpeg') {
            newFileName = fileName.replace(/\.[^/.]+$/, "") + '.jpg';
            outputTempPath = path.join(tempDir, `proc_${Date.now()}_${newFileName}`);
            tempFiles.push(outputTempPath);
            newMimeType = 'image/jpeg';

            await sharp(originalTempPath)
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
            const instance = sharp(originalTempPath);
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
                    .size('?x720') // Downcale to 720p if larger? Or just maintain aspect ratio. User said "without quality loss if possible, slight loss fine". 
                    // Let's just set CRF and Preset.
                    .addOptions(['-crf 28', '-preset fast'])
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const newStats = fs.statSync(outputTempPath);
        const newSize = newStats.size;

        // Update PB
        const formData = new FormData();

        // remove valid old file
        formData.append('file-', fileName);

        // add new file
        const fileBuffer = fs.readFileSync(outputTempPath);
        const fileBlob = new Blob([fileBuffer], { type: newMimeType });
        formData.append('file', fileBlob, newFileName);

        // Update metadata arrays
        if (fileIndex !== -1) {
            fileNames[fileIndex] = newFileName;
            fileSizes[fileIndex] = newSize;
            fileTypes[fileIndex] = newMimeType;
        }

        // Reconstruct metadata fields
        // file_name
        formData.append('file_name', JSON.stringify(fileNames));

        // file_size (total)
        const totalSize = fileSizes.reduce((a, b) => a + b, 0);
        formData.append('file_size', totalSize.toString());

        // file_type (complex object array)
        const newFileTypeMeta = fileTypes.map((t, i) => ({
            type: t,
            size: fileSizes[i]
        }));
        formData.append('file_type', JSON.stringify(newFileTypeMeta));

        // Update modified timestamp
        formData.append('updated', new Date().toISOString());

        const updatedRecord = await pb.collection('file_transfer_messages').update(messageId, formData);

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
