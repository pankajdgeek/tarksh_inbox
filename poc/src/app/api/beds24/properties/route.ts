import { NextResponse } from 'next/server';
import { getProperties } from '@/lib/beds24/client';

export async function GET() {
  try {
    const properties = await getProperties();
    return NextResponse.json(properties);
  } catch (error) {
    console.error('Beds24 properties error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}
