import { NextRequest, NextResponse } from 'next/server';
import { getMessages } from '@/lib/beds24/client';

export async function GET(req: NextRequest) {
  try {
    const bookingId = req.nextUrl.searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const messages = await getMessages(parseInt(bookingId));
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Beds24 messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
