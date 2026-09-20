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
  try {
    const session = await validateSession();
    const userId = session?.userId || request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
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

    // Sanitize file name
    const sanitizedBase = originalName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100);
    const uniqueFileName = `${Date.now()}_${sanitizedBase}`;

    // If Vercel Blob token is configured, use Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`resources/${uniqueFileName}`, file, {
        access: 'public',
      });

      return NextResponse.json({
        url: blob.url,
        fileName: originalName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
    }

    // Fallback for local development or non-Vercel environments
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mime = file.type || 'application/octet-stream';
    const dataUrl = `data:${mime};base64,${base64Data}`;

    return NextResponse.json({
      url: dataUrl,
      fileName: originalName,
      fileSize: file.size,
      mimeType: mime,
    });
  } catch (error: any) {
    console.error('[UploadAPI] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'File upload failed' },
      { status: 500 },
    );
  }
}
