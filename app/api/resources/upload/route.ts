import { guardMutation } from '@/lib/security/request';
import { readBody } from '@/lib/security/request';
import { consumeAttempt } from '@/lib/security/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
  'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'zip',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
]);

export async function POST(request: NextRequest) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await consumeAttempt('uploads', userId, 10, 60 * 60_000)) return NextResponse.json({error: 'Upload limit reached. Try later.'}, {status: 429});
    const bytes = await readBody(request, 26 * 1024 * 1024);
    const formData = await new Response(new Uint8Array(bytes), {headers: {'Content-Type': request.headers.get('content-type') || ''}}).formData();
    const file = formData.get('file') as File | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum limit of 25MB' },
        { status: 400 },
      );
    }

    const originalName = file.name || 'document';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type .${ext} is not allowed. Please upload academic documents (PDF, Office files, images, text).` },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({error: 'Unsupported content type.'}, {status: 400});
    const prefix = Buffer.from(await file.slice(0, 512).arrayBuffer());
    const isZip = prefix.subarray(0, 2).equals(Buffer.from('PK'));
    const isOle = prefix.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
    const signatures: Record<string, boolean> = {
      pdf: prefix.subarray(0, 5).toString() === '%PDF-',
      png: prefix.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      jpg: prefix.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
      jpeg: prefix.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
      webp: prefix.subarray(0, 4).toString() === 'RIFF' && prefix.subarray(8, 12).toString() === 'WEBP',
      doc: isOle, ppt: isOle, xls: isOle,
      docx: isZip, pptx: isZip, xlsx: isZip, zip: isZip,
      txt: file.type === 'text/plain', md: ['text/plain', 'text/markdown'].includes(file.type),
    };
    if (!signatures[ext]) return NextResponse.json({error: 'File contents do not match its extension.'}, {status: 400});

    // Sanitize file name
    const sanitizedBase = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const uniqueFileName = `${Date.now()}_${sanitizedBase}`;

    // If Vercel Blob token is configured, use Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`resources/${uniqueFileName}`, file, {
        access: 'public',
        contentType: 'application/octet-stream',
        addRandomSuffix: true,
      });

      return NextResponse.json({
        url: blob.url,
        fileName: originalName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
    }

    return NextResponse.json({error: 'File storage is not configured.'}, {status: 503});
  } catch (error: any) {
    console.error('[UploadAPI] Error:', error);
    return NextResponse.json(
      { error: 'File upload failed' },
      { status: 500 },
    );
  }
}
