// ============================================================================
// Airbnb Listing Scraper
// ============================================================================

import * as cheerio from 'cheerio';
import { ScrapedData } from '../types';

export async function scrapeAirbnb(url: string): Promise<ScrapedData> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Airbnb listing: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Airbnb stores data in script tags and structured data
  let propertyName: string | undefined;
  let description: string | undefined;
  const amenities: string[] = [];
  const houseRules: string[] = [];
  let checkIn: string | undefined;
  let checkOut: string | undefined;
  let location: string | undefined;

  // Try to extract from JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      if (data['@type'] === 'LodgingBusiness' || data['@type'] === 'VacationRental') {
        propertyName = data.name;
        description = data.description;
        if (data.address) {
          location = [data.address.streetAddress, data.address.addressLocality, data.address.addressRegion]
            .filter(Boolean)
            .join(', ');
        }
      }
    } catch {
      // Ignore parse errors
    }
  });

  // Fallback: extract from meta tags
  if (!propertyName) {
    propertyName = $('meta[property="og:title"]').attr('content') || $('title').text();
  }
  if (!description) {
    description = $('meta[property="og:description"]').attr('content') || '';
  }

  // Try to extract amenities from page content
  $('[data-section-id="AMENITIES_DEFAULT"] li, [data-testid="amenity-row"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) amenities.push(text);
  });

  // Extract house rules
  $('[data-section-id="POLICIES_DEFAULT"] li, [data-section-id="HOUSE_RULES"] li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) houseRules.push(text);
  });

  // Try to extract check-in/check-out times from text
  const bodyText = $('body').text();
  const checkInMatch = bodyText.match(/check.?in[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  const checkOutMatch = bodyText.match(/check.?out[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (checkInMatch) checkIn = checkInMatch[1];
  if (checkOutMatch) checkOut = checkOutMatch[1];

  return {
    platform: 'airbnb',
    url,
    propertyName: propertyName?.trim(),
    description: description?.trim(),
    amenities: amenities.length > 0 ? amenities : undefined,
    houseRules: houseRules.length > 0 ? houseRules : undefined,
    checkIn,
    checkOut,
    location,
    scrapedAt: new Date().toISOString(),
  };
}
