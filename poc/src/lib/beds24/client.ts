// ============================================================================
// Beds24 API Client
// ============================================================================

import { Beds24Property, Beds24Booking, Beds24Message } from '../types';

const BASE_URL = 'https://beds24.com/api/v2';

function getHeaders(): Record<string, string> {
  const apiKey = process.env.BEDS24_API_KEY;
  if (!apiKey) throw new Error('BEDS24_API_KEY not set');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'token': apiKey,
  };

  // Some endpoints need prop key
  const propKey = process.env.BEDS24_PROP_KEY;
  if (propKey) {
    headers['propKey'] = propKey;
  }

  return headers;
}

export async function getProperties(): Promise<Beds24Property[]> {
  const res = await fetch(`${BASE_URL}/properties`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Beds24 properties error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Beds24 v2 returns array of properties
  if (!Array.isArray(data)) return [];

  return data.map((p: Record<string, unknown>) => ({
    id: p.id as number,
    name: (p.name as string) || `Property ${p.id}`,
    address: p.address as string | undefined,
    city: p.city as string | undefined,
    country: p.country as string | undefined,
  }));
}

export async function getBookings(propertyId: number): Promise<Beds24Booking[]> {
  const res = await fetch(`${BASE_URL}/bookings?propertyId=${propertyId}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Beds24 bookings error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    propertyId: (b.propertyId as number) || propertyId,
    guestName: ((b.guestFirstName || '') + ' ' + (b.guestName || '')).trim() || 'Guest',
    guestEmail: b.guestEmail as string | undefined,
    checkIn: b.firstNight as string || '',
    checkOut: b.lastNight as string || '',
    status: b.status as string || 'confirmed',
    channel: b.referer as string | undefined,
    numAdults: b.numAdult as number | undefined,
    numChildren: b.numChild as number | undefined,
  }));
}

export async function getMessages(bookingId: number): Promise<Beds24Message[]> {
  const res = await fetch(`${BASE_URL}/bookings/${bookingId}/messages`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Beds24 messages error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((m: Record<string, unknown>, i: number) => ({
    id: (m.id as number) || i,
    bookingId,
    message: (m.message as string) || '',
    sender: (m.from as string)?.toLowerCase() === 'guest' ? 'guest' as const : 'host' as const,
    timestamp: (m.date as string) || new Date().toISOString(),
  }));
}

export async function getHistoricalMessages(propertyId: number): Promise<Beds24Message[]> {
  const bookings = await getBookings(propertyId);
  const allMessages: Beds24Message[] = [];

  // Fetch messages for each booking (limit to recent 50 bookings)
  const recentBookings = bookings.slice(0, 50);

  for (const booking of recentBookings) {
    try {
      const messages = await getMessages(booking.id);
      allMessages.push(...messages);
    } catch {
      // Skip bookings with no messages or errors
    }
  }

  return allMessages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
