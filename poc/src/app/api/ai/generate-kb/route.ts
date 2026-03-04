import { NextRequest, NextResponse } from 'next/server';
import { generateKB } from '@/lib/ai/kb-generator';
import { KBGenerationInput } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: KBGenerationInput = await req.json();

    const { kb, tokenUsage } = await generateKB(body);

    return NextResponse.json({ kb, tokenUsage });
  } catch (error) {
    console.error('KB generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'KB generation failed' },
      { status: 500 }
    );
  }
}
