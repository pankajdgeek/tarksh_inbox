import { NextRequest, NextResponse } from 'next/server';
import { getKB, saveKB } from '@/lib/storage/kb';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params;
    const kb = await getKB(propertyId);

    if (!kb) {
      return NextResponse.json({ error: 'KB not found' }, { status: 404 });
    }

    return NextResponse.json(kb);
  } catch (error) {
    console.error('KB get error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch KB' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const { propertyId } = await params;
    const kb = await req.json();

    await saveKB(propertyId, kb);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('KB save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save KB' },
      { status: 500 }
    );
  }
}
