// ============================================================================
// Unified Scraper — detects platform from URL and dispatches
// ============================================================================

import { ScrapedData } from '../types';
import { scrapeAirbnb } from './airbnb';
import { scrapeBookingCom } from './booking-com';

export function detectPlatform(url: string): 'airbnb' | 'booking_com' | null {
  const lower = url.toLowerCase();
  if (lower.includes('airbnb.com') || lower.includes('airbnb.co')) return 'airbnb';
  if (lower.includes('booking.com')) return 'booking_com';
  return null;
}

export async function scrapeListingUrl(url: string): Promise<ScrapedData> {
  const platform = detectPlatform(url);

  if (!platform) {
    throw new Error(`Unsupported platform for URL: ${url}. Only Airbnb and Booking.com are supported.`);
  }

  if (platform === 'airbnb') {
    return scrapeAirbnb(url);
  }

  return scrapeBookingCom(url);
}
