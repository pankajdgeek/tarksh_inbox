import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/ai/pipeline';
import { getKB } from '@/lib/storage/kb';
import { saveResult } from '@/lib/storage/results';
import { TestResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      propertyId,
      guestName,
      conversationContext,
      conversationHistory,
      channel,
      checkInDate,
      checkOutDate,
      expectedIntent,
      overrideIntent,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Load KB — use propertyId or default sample
    const kbId = propertyId || 'sample-property';
    const kb = await getKB(kbId);
    if (!kb) {
      return NextResponse.json(
        { error: `No KB found for property "${kbId}". Create one in the KB editor first.` },
        { status: 404 }
      );
    }

    const result = await runPipeline({
      message,
      kb,
      guestName,
      conversationContext,
      conversationHistory,
      channel,
      checkInDate,
      checkOutDate,
      overrideIntent,
    });

    // Save as test result
    const testResult: TestResult = {
      id: result.id,
      pipelineResult: result,
      expectedIntent,
      intentMatch: expectedIntent ? result.classification.intent === expectedIntent : undefined,
      createdAt: new Date().toISOString(),
    };

    await saveResult(testResult);

    return NextResponse.json(testResult);
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 }
    );
  }
}
