import { NextResponse } from 'next/server';
import { listKBs } from '@/lib/storage/kb';

export async function GET() {
  try {
    const kbs = await listKBs();
    return NextResponse.json(kbs);
  } catch (error) {
    console.error('KB list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list KBs' },
      { status: 500 }
    );
  }
}
