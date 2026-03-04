'use client';

import { useState, useEffect } from 'react';
import { KnowledgeBase, AmenitiesDetailed } from '@/lib/types';

// Helper: check if amenities is nested object vs flat array
function isAmenitiesDetailed(
  amenities: string[] | AmenitiesDetailed | null
): amenities is AmenitiesDetailed {
  return amenities !== null && !Array.isArray(amenities) && typeof amenities === 'object';
}

// Helper: flatten nested amenities to a display string
function flattenAmenities(amenities: string[] | AmenitiesDetailed | null): string {
  if (!amenities) return '';
  if (Array.isArray(amenities)) return amenities.join('\n');
  // Nested object — flatten all categories
  const lines: string[] = [];
  const categories: Array<[string, string]> = [
    ['in_room', 'In-Room'],
    ['kitchen', 'Kitchen'],
    ['bathroom', 'Bathroom'],
    ['laundry', 'Laundry'],
    ['on_call', 'On Call'],
    ['building', 'Building'],
    ['not_provided', 'Not Provided'],
  ];
  for (const [key, label] of categories) {
    const items = (amenities as Record<string, unknown>)[key];
    if (Array.isArray(items) && items.length > 0) {
      lines.push(`[${label}]`);
      lines.push(...items);
    }
  }
  if (amenities.linen_policy) {
    lines.push(`[Linen Policy] ${amenities.linen_policy}`);
  }
  return lines.join('\n');
}

// Helper: get landmarks as string regardless of format
function getLandmarks(directions: KnowledgeBase['directions']): string {
  if (!directions?.landmarks) return '';
  if (Array.isArray(directions.landmarks)) return directions.landmarks.join('\n');
  return directions.landmarks;
}

// Helper: get parking details (instructions or details field)
function getParkingDetails(parking: KnowledgeBase['parking']): string {
  if (!parking) return '';
  return parking.instructions || parking.details || '';
}

export default function KBPage() {
  const [tab, setTab] = useState<'editor' | 'generator'>('editor');
  const [propertyId, setPropertyId] = useState('sample-property');
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [kbList, setKbList] = useState<Array<{ propertyId: string; propertyName: string }>>([]);

  // Generator state
  const [airbnbUrl, setAirbnbUrl] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');

  useEffect(() => {
    fetch('/api/kb').then((r) => r.json()).then(setKbList).catch(() => {});
  }, []);

  async function loadKB() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/kb/${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        setKb(data);
        setJsonText(JSON.stringify(data, null, 2));
        // Auto-switch to JSON mode for detailed KBs (they have rooms/nested amenities)
        if (data.rooms || isAmenitiesDetailed(data.amenities)) {
          setJsonMode(false); // still use form — we handle it now
        }
      } else {
        setKb(null);
        setMessage('No KB found. Create one or use the Generator tab.');
      }
    } catch {
      setMessage('Failed to load KB');
    }
    setLoading(false);
  }

  async function saveKB() {
    if (!kb) return;
    setSaving(true);
    setMessage('');
    try {
      let dataToSave = kb;
      if (jsonMode) {
        dataToSave = JSON.parse(jsonText);
      }
      const res = await fetch(`/api/kb/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      if (res.ok) {
        setMessage('KB saved successfully!');
        setKb(dataToSave);
      } else {
        setMessage('Failed to save KB');
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
    setSaving(false);
  }

  async function generateKB() {
    setGenerating(true);
    setGenStatus('Scraping listing URLs...');
    try {
      const scrapedData = [];

      if (airbnbUrl) {
        setGenStatus('Scraping Airbnb listing...');
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: airbnbUrl }),
        });
        if (res.ok) scrapedData.push(await res.json());
      }

      if (bookingUrl) {
        setGenStatus('Scraping Booking.com listing...');
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: bookingUrl }),
        });
        if (res.ok) scrapedData.push(await res.json());
      }

      setGenStatus('Generating KB with Claude...');
      const genRes = await fetch('/api/ai/generate-kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scrapedData: scrapedData.length > 0 ? scrapedData : undefined,
        }),
      });

      if (!genRes.ok) throw new Error('KB generation failed');

      const { kb: generatedKB } = await genRes.json();
      setKb(generatedKB);
      setJsonText(JSON.stringify(generatedKB, null, 2));
      setTab('editor');
      setGenStatus('KB generated! Review and save below.');
    } catch (err) {
      setGenStatus(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    }
    setGenerating(false);
  }

  function updateField(path: string, value: unknown) {
    if (!kb) return;
    const updated = JSON.parse(JSON.stringify(kb));
    const parts = path.split('.');
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] === null || obj[parts[i]] === undefined) {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setKb(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  }

  const hasRooms = kb?.rooms && Object.keys(kb.rooms).length > 0;
  const hasDetailedAmenities = kb ? isAmenitiesDetailed(kb.amenities) : false;

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">Knowledge Base</h2>

      {/* Property Selector */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Property ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={loadKB}
                disabled={loading}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
        </div>
        {kbList.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {kbList.map((k) => (
              <button
                key={k.propertyId}
                onClick={() => { setPropertyId(k.propertyId); }}
                className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-accent-light"
              >
                {k.propertyName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('editor')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'editor' ? 'bg-accent text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          Editor
        </button>
        <button
          onClick={() => setTab('generator')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'generator' ? 'bg-accent text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          AI Generator
        </button>
      </div>

      {message && (
        <div className={`rounded-xl p-4 mb-6 text-sm ${message.includes('Error') || message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Generator Tab */}
      {tab === 'generator' && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Generate KB from OTA Listings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Airbnb Listing URL (optional)</label>
              <input
                type="text"
                value={airbnbUrl}
                onChange={(e) => setAirbnbUrl(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="https://www.airbnb.com/rooms/..."
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Booking.com Listing URL (optional)</label>
              <input
                type="text"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="https://www.booking.com/hotel/..."
              />
            </div>
            <button
              onClick={generateKB}
              disabled={generating || (!airbnbUrl && !bookingUrl)}
              className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate KB'}
            </button>
            {genStatus && <p className="text-sm text-muted">{genStatus}</p>}
          </div>
        </div>
      )}

      {/* Editor Tab */}
      {tab === 'editor' && kb && (
        <div className="space-y-4">
          {/* JSON Toggle */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setJsonMode(!jsonMode)}
              className="text-xs text-accent hover:underline"
            >
              {jsonMode ? 'Switch to Form' : 'Switch to JSON'}
            </button>
            <button
              onClick={saveKB}
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save KB'}
            </button>
          </div>

          {jsonMode ? (
            <div className="bg-card border border-border rounded-xl p-5">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-[600px] font-mono text-xs border border-border rounded-lg p-3 resize-none"
              />
            </div>
          ) : (
            <>
              {/* Property Info */}
              <Section title="Property Info">
                <Label text="Property Name" />
                <Input value={kb.property_name} onChange={(v) => updateField('property_name', v)} />
                {kb.property_id && (
                  <>
                    <Label text="Property ID" />
                    <Input value={kb.property_id} onChange={(v) => updateField('property_id', v)} />
                  </>
                )}
                {kb.host_name && (
                  <>
                    <Label text="Host Name" />
                    <Input value={kb.host_name} onChange={(v) => updateField('host_name', v)} />
                  </>
                )}
                {(kb.overall_rating || kb.total_reviews) && (
                  <div className="flex gap-4 mt-2">
                    {kb.overall_rating && (
                      <span className="text-sm text-muted">Rating: {kb.overall_rating}</span>
                    )}
                    {kb.total_reviews && (
                      <span className="text-sm text-muted">Reviews: {kb.total_reviews}</span>
                    )}
                    {kb.booking_com_rating && (
                      <span className="text-sm text-muted">Booking.com: {kb.booking_com_rating}/10</span>
                    )}
                  </div>
                )}
              </Section>

              {/* Rooms (for detailed KBs) */}
              {hasRooms && (
                <Section title="Room Types">
                  {Object.entries(kb.rooms!).map(([key, room]) => (
                    <div key={key} className="border border-border rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{room.name}</h4>
                        {room.airbnb_rating && (
                          <span className="text-xs text-muted">
                            Airbnb: {room.airbnb_rating} ({room.airbnb_reviews} reviews)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                        {room.type && <div>Type: {room.type}</div>}
                        {room.layout && <div>Layout: {room.layout}</div>}
                        {room.beds && <div>Beds: {room.beds}</div>}
                        {room.max_guests && <div>Max Guests: {room.max_guests}</div>}
                        {room.floor && <div>Floor: {room.floor}</div>}
                        {room.highlight && <div>Highlight: {room.highlight}</div>}
                        {room.special_feature && <div>Special: {room.special_feature}</div>}
                      </div>
                      {room.room_amenities && room.room_amenities.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs font-medium">Room Amenities:</span>
                          <ul className="text-xs text-muted mt-1 list-disc list-inside">
                            {room.room_amenities.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted mt-1">Edit room details in JSON mode for full control.</p>
                </Section>
              )}

              {/* Check-in */}
              <Section title="Check-in">
                <Label text="Time" />
                <Input value={kb.check_in?.time || ''} onChange={(v) => updateField('check_in.time', v)} placeholder="14:00" />
                <Label text="Instructions (one per line)" />
                <TextArea
                  value={kb.check_in?.instructions?.join('\n') || ''}
                  onChange={(v) => updateField('check_in.instructions', v.split('\n').filter(Boolean))}
                />
                <Label text="Early Check-in Policy" />
                <Input value={kb.check_in?.early_check_in || ''} onChange={(v) => updateField('check_in.early_check_in', v)} />
                <Label text="Key Location" />
                <Input value={kb.check_in?.key_location || ''} onChange={(v) => updateField('check_in.key_location', v)} />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={kb.check_in?.self_check_in || false}
                    onChange={(e) => updateField('check_in.self_check_in', e.target.checked)}
                  />
                  <span className="text-sm">Self Check-in Available</span>
                </div>
              </Section>

              {/* Check-out */}
              <Section title="Check-out">
                <Label text="Time" />
                <Input value={kb.check_out?.time || ''} onChange={(v) => updateField('check_out.time', v)} placeholder="11:00" />
                <Label text="Instructions (one per line)" />
                <TextArea
                  value={kb.check_out?.instructions?.join('\n') || ''}
                  onChange={(v) => updateField('check_out.instructions', v.split('\n').filter(Boolean))}
                />
                <Label text="Late Check-out Policy" />
                <Input value={kb.check_out?.late_check_out || ''} onChange={(v) => updateField('check_out.late_check_out', v)} />
              </Section>

              {/* WiFi */}
              <Section title="WiFi">
                <Label text="Network Name" />
                <Input value={kb.wifi?.network_name || ''} onChange={(v) => updateField('wifi.network_name', v)} />
                <Label text="Password" />
                <Input value={kb.wifi?.password || ''} onChange={(v) => updateField('wifi.password', v)} />
                {kb.wifi?.speed && (
                  <>
                    <Label text="Speed" />
                    <Input value={kb.wifi.speed} onChange={(v) => updateField('wifi.speed', v)} />
                  </>
                )}
              </Section>

              {/* Amenities */}
              <Section title={hasDetailedAmenities ? 'Amenities (categorized)' : 'Amenities (one per line)'}>
                {hasDetailedAmenities ? (
                  <div className="space-y-3">
                    {(['in_room', 'kitchen', 'bathroom', 'laundry', 'on_call', 'building', 'not_provided'] as const).map((cat) => {
                      const items = (kb.amenities as AmenitiesDetailed)?.[cat];
                      if (!items || items.length === 0) return null;
                      const labels: Record<string, string> = {
                        in_room: 'In-Room', kitchen: 'Kitchen', bathroom: 'Bathroom',
                        laundry: 'Laundry', on_call: 'On Call', building: 'Building',
                        not_provided: 'Not Provided',
                      };
                      return (
                        <div key={cat}>
                          <Label text={labels[cat]} />
                          <TextArea
                            value={items.join('\n')}
                            onChange={(v) => updateField(`amenities.${cat}`, v.split('\n').filter(Boolean))}
                          />
                        </div>
                      );
                    })}
                    {(kb.amenities as AmenitiesDetailed)?.linen_policy && (
                      <>
                        <Label text="Linen Policy" />
                        <Input
                          value={(kb.amenities as AmenitiesDetailed).linen_policy || ''}
                          onChange={(v) => updateField('amenities.linen_policy', v)}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <TextArea
                    value={flattenAmenities(kb.amenities)}
                    onChange={(v) => updateField('amenities', v.split('\n').filter(Boolean))}
                  />
                )}
              </Section>

              {/* House Rules */}
              <Section title="House Rules (one per line)">
                <TextArea
                  value={kb.house_rules?.join('\n') || ''}
                  onChange={(v) => updateField('house_rules', v.split('\n').filter(Boolean))}
                />
              </Section>

              {/* Directions */}
              <Section title="Directions">
                <Label text="Address" />
                <Input value={kb.directions?.address || ''} onChange={(v) => updateField('directions.address', v)} />
                <Label text="From Airport" />
                <Input value={kb.directions?.from_airport || ''} onChange={(v) => updateField('directions.from_airport', v)} />
                {kb.directions?.from_station !== undefined && (
                  <>
                    <Label text="From Station" />
                    <Input value={kb.directions?.from_station || ''} onChange={(v) => updateField('directions.from_station', v)} />
                  </>
                )}
                <Label text={Array.isArray(kb.directions?.landmarks) ? 'Landmarks (one per line)' : 'Landmarks'} />
                {Array.isArray(kb.directions?.landmarks) ? (
                  <TextArea
                    value={getLandmarks(kb.directions)}
                    onChange={(v) => updateField('directions.landmarks', v.split('\n').filter(Boolean))}
                  />
                ) : (
                  <Input value={getLandmarks(kb.directions)} onChange={(v) => updateField('directions.landmarks', v)} />
                )}
                {kb.directions?.nearest_metro && (
                  <>
                    <Label text="Nearest Metro (one per line)" />
                    <TextArea
                      value={kb.directions.nearest_metro.join('\n')}
                      onChange={(v) => updateField('directions.nearest_metro', v.split('\n').filter(Boolean))}
                    />
                  </>
                )}
                {kb.directions?.area_description && (
                  <>
                    <Label text="Area Description" />
                    <Input value={kb.directions.area_description} onChange={(v) => updateField('directions.area_description', v)} />
                  </>
                )}
              </Section>

              {/* Parking */}
              <Section title="Parking">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={kb.parking?.available || false}
                    onChange={(e) => updateField('parking.available', e.target.checked)}
                  />
                  <span className="text-sm">Parking Available</span>
                </div>
                <Label text="Type" />
                <Input value={kb.parking?.type || ''} onChange={(v) => updateField('parking.type', v)} />
                <Label text="Details" />
                <Input
                  value={getParkingDetails(kb.parking)}
                  onChange={(v) => updateField(kb.parking?.details !== undefined ? 'parking.details' : 'parking.instructions', v)}
                />
              </Section>

              {/* Emergency */}
              <Section title="Emergency Contact">
                <Label text="Contact Name" />
                <Input value={kb.emergency?.contact_name || ''} onChange={(v) => updateField('emergency.contact_name', v)} />
                <Label text="Phone" />
                <Input value={kb.emergency?.phone || ''} onChange={(v) => updateField('emergency.phone', v)} />
                <Label text="Nearest Hospital" />
                <Input value={kb.emergency?.nearest_hospital || ''} onChange={(v) => updateField('emergency.nearest_hospital', v)} />
                {kb.emergency?.security && (
                  <>
                    <Label text="Security" />
                    <Input value={kb.emergency.security} onChange={(v) => updateField('emergency.security', v)} />
                  </>
                )}
              </Section>

              {/* Custom FAQs */}
              {kb.custom_faqs && kb.custom_faqs.length > 0 && (
                <Section title={`Custom FAQs (${kb.custom_faqs.length})`}>
                  {kb.custom_faqs.map((faq, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 mb-2">
                      <Label text={`Q${i + 1}`} />
                      <Input
                        value={faq.question}
                        onChange={(v) => {
                          const faqs = [...(kb.custom_faqs || [])];
                          faqs[i] = { ...faqs[i], question: v };
                          updateField('custom_faqs', faqs);
                        }}
                      />
                      <Label text="Answer" />
                      <TextArea
                        value={faq.answer}
                        onChange={(v) => {
                          const faqs = [...(kb.custom_faqs || [])];
                          faqs[i] = { ...faqs[i], answer: v };
                          updateField('custom_faqs', faqs);
                        }}
                      />
                    </div>
                  ))}
                </Section>
              )}

              {/* Response Preferences */}
              <Section title="Response Preferences">
                <Label text="Tone" />
                <select
                  value={kb.response_preferences?.tone || 'friendly'}
                  onChange={(e) => updateField('response_preferences.tone', e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                </select>
                <Label text="Signature" />
                <Input
                  value={kb.response_preferences?.signature || ''}
                  onChange={(v) => updateField('response_preferences.signature', v)}
                  placeholder="- Team PropertyName"
                />
              </Section>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {tab === 'editor' && !kb && !loading && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
          <p>No KB loaded. Enter a property ID and click Load, or use the AI Generator.</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <label className="block text-xs text-muted mt-2">{text}</label>;
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm"
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm h-24 resize-none"
    />
  );
}
