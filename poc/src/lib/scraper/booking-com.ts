// ============================================================================
// Booking.com Listing Scraper
// ============================================================================

import * as cheerio from 'cheerio';
import { ScrapedData } from '../types';

export async function scrapeBookingCom(url: string): Promise<ScrapedData> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Booking.com listing: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let propertyName: string | undefined;
  let description: string | undefined;
  const amenities: string[] = [];
  const houseRules: string[] = [];
  let checkIn: string | undefined;
  let checkOut: string | undefined;
  let location: string | undefined;

  // Property name
  propertyName = $('h2.pp-header__title, #hp_hotel_name, .d2fee87262').first().text().trim();
  if (!propertyName) {
    propertyName = $('meta[property="og:title"]').attr('content') || $('title').text();
  }

  // Description
  description = $('#property_description_content, .hotel-description, [data-testid="property-description"]')
    .first()
    .text()
    .trim();
  if (!description) {
    description = $('meta[property="og:description"]').attr('content') || '';
  }

  // Amenities/Facilities
  $('.facilitiesChecklistSection li, .hp-features-list li, [data-testid="property-most-popular-facilities-wrapper"] li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) amenities.push(text);
  });

  // House rules
  $('.house-rules li, [data-testid="house-rules-content"] li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) houseRules.push(text);
  });

  // Check-in/Check-out
  const bodyText = $('body').text();
  const checkInMatch = bodyText.match(/check.?in[:\s]*(?:from\s*)?(\d{1,2}:\d{2})/i);
  const checkOutMatch = bodyText.match(/check.?out[:\s]*(?:until\s*)?(\d{1,2}:\d{2})/i);
  if (checkInMatch) checkIn = checkInMatch[1];
  if (checkOutMatch) checkOut = checkOutMatch[1];

  // Location
  location = $('[data-testid="address"], .hp_address_subtitle, .jq_tooltip').first().text().trim();

  return {
    platform: 'booking_com',
    url,
    propertyName: propertyName?.trim(),
    description: description?.trim(),
    amenities: amenities.length > 0 ? amenities : undefined,
    houseRules: houseRules.length > 0 ? houseRules : undefined,
    checkIn,
    checkOut,
    location: location || undefined,
    scrapedAt: new Date().toISOString(),
  };
}
