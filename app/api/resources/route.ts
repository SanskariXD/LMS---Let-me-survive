import { guardMutation } from '@/lib/security/request';
import { readJson } from '@/lib/security/request';
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/portal/session';
import { getResources, createResource, getUserById } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    const userId = session?.userId;

    const resourcesList = await getResources(userId);
    return NextResponse.json({ resources: resourcesList });
  } catch (error: any) {
    console.error('[ResourcesAPI] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rejected = guardMutation(request);
  if (rejected) return rejected;
  try {
    const session = await validateSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(userId);
    const uploaderName = user?.student_name || session?.name || 'Anonymous Student';

    const body = await readJson(request);
    if (!body?.title || !body?.course || !body?.fileUrl) {
      return NextResponse.json(
        { error: 'Title, course, and file URL are required' },
        { status: 400 },
      );
    }

    const resource = await createResource(userId, uploaderName, {
      title: body.title,
      description: body.description,
      course: body.course,
      professor: body.professor,
      slot: body.slot,
      semester: body.semester || 'Current',
      resourceType: body.resourceType || body.type || 'Class Notes',
      isOpenBook: !!(body.isOpenBook ?? body.is_open_book),
      fileUrl: body.fileUrl,
      fileName: body.fileName || 'document',
      fileSize: body.fileSize || 0,
      fileMimeType: body.fileMimeType,
      tags: body.tags,
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error: any) {
    console.error('[ResourcesAPI] POST error:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}
