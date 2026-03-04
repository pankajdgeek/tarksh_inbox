import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalMessages } from '@/lib/beds24/client';

export async function GET(req: NextRequest) {
  try {
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const messages = await getHistoricalMessages(parseInt(propertyId));
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Beds24 history error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch historical messages' },
      { status: 500 }
    );
  }
}
