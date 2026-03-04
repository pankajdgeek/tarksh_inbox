import { NextRequest, NextResponse } from 'next/server';
import { getResults, rateResult } from '@/lib/storage/results';

export async function GET() {
  try {
    const results = await getResults();
    return NextResponse.json(results);
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, rating, notes } = await req.json();

    if (!id || !rating) {
      return NextResponse.json({ error: 'id and rating are required' }, { status: 400 });
    }

    const result = await rateResult(id, rating, notes);
    if (!result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Rating error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rate result' },
      { status: 500 }
    );
  }
}
