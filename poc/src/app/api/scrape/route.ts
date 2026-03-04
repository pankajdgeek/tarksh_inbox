import { NextRequest, NextResponse } from 'next/server';
import { scrapeListingUrl } from '@/lib/scraper';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const data = await scrapeListingUrl(url);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scraping failed' },
      { status: 500 }
    );
  }
}
