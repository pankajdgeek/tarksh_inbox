# Guest Message Analysis — Property 252487
**Property:** Zest.Living, Golf Course Road, Sector 55, Gurugram
**Room Types:** 1BHK Apartment (Room ID: 537986) | 1RK Studio
**Analysis Date:** 2026-03-04
**Dataset:** 100 messages across 12 bookings

---

## Dataset Summary

| Metric | Value |
|---|---|
| Total messages | 100 |
| Bookings with messages | 12 |
| Guest messages | 55 |
| Host messages | 44 |
| System messages | 1 |
| Channels identified | Airbnb (at least 3 bookings) |

Booking IDs in dataset: 83142429, 82633475, 83083536, 83130961, 82816447, 82931140, 82818184, 81963553, 82784864, 82842353, 82821500, 82275885

---

## 1. Guest Question Categories

### A. Check-In Process / Location / Access
**Frequency: 5 messages across 2 bookings — most common inquiry topic**

- "Can you send me location and details, there is self check in or someone help there?" (booking 83130961)
- "How can I move into the apartment?" (booking 83130961)
- "I sent the documents" — confirming form submission (booking 83130961)
- Guest from booking 83142429 changed dates and needed re-confirmation

Guests consistently need reassurance that someone will be there to help them check in, and want the address/maps link proactively.

### B. Parking
**Frequency: 2 messages — 1 booking**

- "Also can you confirm me whether parking is available for 4 wheeler" (booking 83142429)
- Host confirmed: street parking available with a night guard

### C. WiFi / Internet Speed
**Frequency: 6 guest messages — 1 booking (82275885) but detailed troubleshooting thread**

- Guest on 4th floor (room 402) initially getting only 5–10 Mbps
- Was connected to wrong router (building-wide router vs apartment-specific router)
- WiFi SSID confusion: lowercase `zest.living` vs correct `Zest.Living` (capital Z)
- After connecting to correct apartment router, speed improved to 70 Mbps
- Host had to ask Airtel and guide guest through correct SSID

### D. Late Checkout Request
**Frequency: 2 messages across 2 bookings**

- "Hi Priyanka, Our flight is bit delayed, will it be ok if we checkout by 12pm tomorrow?" (booking 82842353 — standard checkout 10 AM)
- "I'll be leaving by 10:30 hope that works" (booking 82821500)
- In one case guest left key at table with no caretaker present (booking 82821500)

### E. Cooking Supplies / Kitchen Items
**Frequency: ~10 messages — 1 booking (82818184)**

- Guest requested cooking oil (mustard/til/olive)
- Guest requested black pepper powder
- Guest questioned quality/origin of oil provided (no expiry date visible)
- Host sent olive oil as replacement after guest complained about mustard oil quality
- Extensive back-and-forth over 10+ messages about this single request

### F. Housekeeping Frequency / Schedule
**Frequency: 4 messages — 1 booking (82818184)**

- Guest requested housekeeping twice a day; host accommodated initially then clarified policy
- Host message: "we request you to get the house keeping done once in a day time as we provide housekeeping once only"
- Host noted: housekeeping available 9 AM–4 PM

### G. Luggage Assistance
**Frequency: 2 messages — 1 booking (82818184)**

- "Please ask someone to help in getting luggage picked" — guest arriving and needing help
- Host arranged caretaker (Kabil) to assist

### H. Late Checkout Dispute / Policy Enforcement
**Frequency: 3 messages — 1 booking (82818184)**

- Guest stayed past agreed checkout time ("Taking shower", "Allow me 10 mins")
- Host sent formal policy enforcement message about late checkout charges

### I. Booking Date Change
**Frequency: 2 messages — 1 booking (83142429)**

- "I want to following dayes 15 to 20 March.... If that's ok I will change the dates" (booking 83142429)
- Host confirmed the change was fine

### J. Complaint / Negative Feedback (Post-Stay)
**Frequency: 3 messages — 1 booking (81963553, guest: Jerry Mishra)**

- Guest claimed host left "pee stains on toilet seat"
- Guest alleged staff tried to enter the room without permission ("your staff did try to open")
- Guest complained the host wrote "false things about someone's character" in the review
- Guest called the property "unsafe and unprofessional"
- No host response visible in the dataset for this booking

### K. Refund Dispute / Airbnb Escalation
**Frequency: 3 host messages — 1 booking (82818184)**

- Guest (Rahul) raised a refund request through Airbnb support during stay
- Host responded defending all services provided:
  - Housekeeping twice a day on request
  - Extra linen changes beyond policy (chargeable but not charged)
  - Oil and pepper delivered within 15 minutes
  - Soiled bedsheet — not charged
- Host asked guest to coordinate directly rather than via Airbnb support

### L. ID / Verification / Check-In Form
**Frequency: Mentioned in all booking confirmation messages (host-initiated)**

- "I sent the documents" (booking 83130961 — guest confirming form submission)
- Foreign guests required to upload visa copy in addition to ID

---

## 2. Host Response Templates

### Template 1: Booking Confirmation Message
Sent to every new booking. Personalized with guest name, dates, guest count, and unique confirmation code.

```
Hello [GUEST_NAME],

Thank you for choosing our place for your stay from [CHECK_IN_DATE], 02:00PM to [CHECK_OUT_DATE], 10:00 AM ! For [N] guest[s] !
Your booking is confirmed, and we can't wait to welcome you.

Please fill this form for hassle free checkinn ! Make sure you upload id's for [N] guest[s].
https://user.zest.living/verification
Use Confirmation Code : [CODE]

Host Contact:- 9773950713

A gentle reminder to fill the web check-in form before arrival for a smooth and quick check-in process. Please also carry your ID for verification with the property guard.

In case of foreign guests, please also upload a copy of your visa along with the form.

If you have any questions, feel free to let us know. We look forward to welcoming you soon!

Warmly,
Team Zest.Living
```

**Observed confirmation codes:** HM5KJF8SH4, HMRXSWZMNB, HMPMWWWF4E, HMJQRETDEA

### Template 2: Check-In Day Message
Sent on the day of arrival. Personalized with guest name and unique confirmation code.

```
Hey [GUEST_NAME],

Its check-in day! We're excited to welcome you soon. Here's all the info you need:

Address: A1/32, Huda, Sector 55, Gurugram

Google Maps Pin: https://maps.app.goo.gl/1b9h3mzC1KyPAdfn7

Address -> zest.living sector 55 (Hn - A1/32, Sushant lok 2)

Caretaker Phone Number: +91-9958881993 (For any assistance during stay & check-in\out\housekeeping)

Once you reach the location, please call the caretaker on the number provided above. He will assist you with the check-in process after verifying your IDs.
Kindly note that our housekeeping staff is available between 9:00 AM and 4:00 PM for any assistance.

Host Phone Number: +91-9773950713 (For any additional support needed)

Check-In Form: Please make sure you've filled out our check-in form before arriving. This helps us finalize everything for a smooth arrival. -> https://user.zest.living/verification
Use Confirmation Code : [CODE]
(Ignore if you have already filled)

Wifi details -> wifi name - zest.living
               Password - zen@394#

Safe travels, and see you soon!

Best,
Team Zest.Living
```

**Note:** This template was sent twice to booking 83130961 (Anastasiia), likely a duplicate send.

### Template 3: Post-Stay Review Request
Sent after every completed stay. Personalized with guest name only.

```
Hey [GUEST_NAME],

Thank you for choosing our home for your stay! We hope it felt welcoming and comfortable. If you enjoyed your time here, we'd truly appreciate a 5-star review — your feedback helps us keep making every stay even better.

We love hosting guests who share kind words, and often have exclusive perks waiting on their next visit 😊

Safe travels, and we hope to welcome you back again soon!

Warm regards,
Team Zest.Living
```

**Observed for guests:** Aakansha, Rahul (83083536), Ishan, Vishesh, Nishtha, Anu, Rahul (82818184), Prakhar

### Template 4: Late Checkout Warning
Sent when a guest overstays past their agreed checkout time.

```
Despite confirming your checkout time, you have stayed past the agreed checkout time. Because of this delay, we are unable to prepare the apartment on time for the next guest.
Kindly arrange to vacate the apartment immediately. Please note that as per policy, late checkout charges will be applicable.
We request your cooperation to avoid further inconvenience.
```

### Template 5: Dispute Response / Service Defense
Sent when guest raises a complaint or refund request. Not a strict template but a consistent pattern:

**Pattern structure:**
1. Itemize all services rendered during stay (housekeeping, linen, extras)
2. Acknowledge any policy flexibilities granted (e.g., extra linen changes not charged)
3. Counter the specific complaint
4. Request guest coordinate directly rather than via OTA platform support
5. Mention any guest-caused damages (soiled linen) that were not charged as a goodwill gesture

---

## 3. Specific Details Extracted from Host Messages

### Property Address
- **Full address:** A1/32, Huda, Sector 55, Gurugram
- **Alternate description:** Hn - A1/32, Sushant Lok 2
- **Search label used in maps:** "zest.living sector 55"

### Google Maps
- **Pin:** https://maps.app.goo.gl/1b9h3mzC1KyPAdfn7

### Contact Numbers
- **Host / Owner:** +91-9773950713 (Priyanka — referenced by guests by name)
- **Caretaker:** +91-9958881993

### Caretaker Name
- **Kabil** — referenced by name in a message ("you can send it back with Kabil who just came to your appt")

### WiFi Details
- **SSID:** Zest.Living (capital Z — case-sensitive; lowercase `zest.living` is a different/building-wide router)
- **Password:** zen@394#
- **ISP:** Airtel
- **Note:** There are multiple routers in the building. Guests must connect to their apartment-specific router, not the building-wide one. The 5G band provides significantly better speeds (~70–80 Mbps vs 5 Mbps on wrong router).

### Housekeeping
- **Hours:** 9:00 AM to 4:00 PM
- **Standard frequency:** Once per day
- **Extra housekeeping:** Can be arranged on request (chargeable per policy, but host may waive)

### Check-In Form (Web Check-In)
- **URL:** https://user.zest.living/verification
- **Unique per booking:** Confirmation code (format: alphanumeric, ~10 chars, e.g., HMRXSWZMNB)
- **ID requirement:** All guests must upload ID; foreign guests must also upload visa

### Check-In / Check-Out Times
- **Check-in:** 2:00 PM
- **Check-out:** 10:00 AM

### Parking
- Street parking available
- Night guard present

### Cooking / Kitchen Supplies
- Host kitchen can provide: cooking oil (olive oil / mustard oil), black pepper powder
- Supplies delivered via housekeeping staff within ~10–15 minutes

### Linen Policy
- Standard: linen changes included (frequency limited per listing)
- Extra linen changes: chargeable, but host may waive in goodwill

---

## 4. Guest Pain Points

### P1: WiFi Confusion (Multiple SSIDs)
The building has multiple WiFi networks. The correct apartment router SSID `Zest.Living` (capital Z) vs the building-wide `zest.living` (lowercase) caused a 10-message troubleshooting thread. Guest was getting only 5–10 Mbps and struggling to work remotely. This is a systematic friction point for work-from-stay guests.

### P2: Check-In Process Uncertainty
Multiple guests asked how check-in works — whether it's self check-in or someone assists. Despite the check-in day message covering this, guests still ask. The information may not be landing clearly or may be arriving too late.

**Specific confusion:** "Can you send me location and details, there is self check in or someone help there?" — this question came *after* the check-in day template was sent, suggesting the template wasn't read or wasn't clear enough.

### P3: Key Drop-Off with No Caretaker Present
One guest (booking 82821500, Prakhar) arrived at checkout to find no one downstairs: "Hi there was no one downstairs so I've left the key at the table." This suggests caretaker availability at checkout is inconsistent.

### P4: Cooking Oil Quality Complaint
Guest (Rahul, booking 82818184) complained about the quality of mustard oil provided — no expiry date visible, "very local and third class" packaging. This escalated to a broader dispute. The issue was resolved by sending olive oil instead, but it consumed significant host time (10+ messages).

### P5: Late Checkout / Overstaying
Guest (booking 82818184) stayed past checkout time, requiring a formal warning message. Guest was in the shower and requested 10 minutes. This caused housekeeping scheduling issues for the next guest's arrival.

### P6: Serious Safety Allegation (Unresolved in Dataset)
Guest Jerry Mishra (booking 81963553) alleged:
- Staff tried to enter the room without permission
- Pee stains on the toilet seat (hygiene complaint)
- Host left a false/negative review about the guest's character

No host response is visible in the dataset for this booking, suggesting either the host did not respond or the response is outside this data window. This is a high-severity unresolved complaint involving safety and false review allegations.

### P7: Refund Escalation via Airbnb Support
Guest (Rahul, booking 82818184) raised a refund request through Airbnb during the stay despite the host claiming all services were rendered. The host had to write a detailed rebuttal (2 long messages). This suggests policy communication is unclear at booking time — guests don't know what's included, what's chargeable, and what they can request.

### P8: Check-In Message Sent Twice
Booking 83130961 (Anastasiia) received the check-in day message twice (messages 8 and 9 are identical). This is an automation/ops issue.

---

## 5. New FAQ Candidates for Knowledge Base

These Q&A pairs emerged from real conversations and would not be obvious from a standard property listing.

---

**Q: Is check-in self-service or does someone help?**
A: Someone from our team will be there to help you. Once you reach the property, please call the caretaker at +91-9958881993. He will verify your ID and assist with the check-in process. It is not fully self-service — you do need to call on arrival.

---

**Q: Where exactly is the property? I'm having trouble finding it.**
A: The address is A1/32, Huda, Sector 55, Gurugram (also referred to as Sushant Lok 2). Search for "zest.living sector 55" on Google Maps or use this pin: https://maps.app.goo.gl/1b9h3mzC1KyPAdfn7. If you can't locate it, call the caretaker directly at +91-9958881993.

---

**Q: Is parking available for a 4-wheeler?**
A: Yes, street parking is available outside the building. There is a night guard on duty.

---

**Q: The WiFi is very slow. What should I do?**
A: Make sure you're connected to the correct router. The SSID is `Zest.Living` — the Z must be uppercase. There is also a building-wide network with a similar name in all lowercase (`zest.living`) — do not connect to that one. If you're still getting poor speeds, let us know which floor and room you're in and we'll check remotely with Airtel. The correct apartment router should give you 70–80 Mbps.

---

**Q: Can I get housekeeping more than once a day?**
A: Standard housekeeping is provided once per day, available between 9:00 AM and 4:00 PM. Additional housekeeping visits can be arranged on request but may be chargeable as per our policy.

---

**Q: Can I cook in the apartment? Are cooking essentials provided?**
A: Yes, the apartment has a kitchen. Basic cooking essentials like cooking oil and spices can be requested from the host and will be delivered within 10–15 minutes. Please note that oil and spices are provided on request and are not stocked in the unit at all times.

---

**Q: Can I check out late?**
A: Standard check-out is at 10:00 AM. If you need a late checkout, please message us in advance and we will try to accommodate based on availability. Please note that late checkout beyond the agreed time may attract additional charges, and we may need the room for the next guest.

---

**Q: Where do I leave the key at checkout?**
A: Please hand the key to the caretaker who will be available at the property. If no one is present, please inform us via message before leaving. Do not leave the key unattended without notifying the team.

---

**Q: I'm an international/foreign guest. Do I need anything extra?**
A: Yes, in addition to your photo ID, you will need to upload a copy of your visa when filling out the web check-in form at https://user.zest.living/verification.

---

**Q: How do I fill the check-in form?**
A: Visit https://user.zest.living/verification and use your personal Confirmation Code (sent in your booking confirmation message). Make sure to upload ID documents for all guests. Foreign guests must also upload a visa copy. Complete this before arrival for a smooth check-in.

---

**Q: I need to change my booking dates. Is that possible?**
A: Please message us with your preferred new dates and we will confirm availability. You can also make the change directly on the booking platform.

---

**Q: What are the exact check-in and check-out times?**
A: Check-in is at 2:00 PM. Check-out is at 10:00 AM. Early check-in or late checkout may be possible subject to availability — please ask in advance.

---

**Q: What is included in housekeeping?**
A: Housekeeping (cleaning, tidying) is provided once per day between 9 AM and 4 PM. Linen and towel changes are included but limited to the number stated in the listing. Additional linen changes beyond the listed allowance are chargeable, though we may accommodate requests in good faith.

---

**Q: Who should I call if there is a problem during my stay?**
A: For day-to-day assistance (check-in, check-out, housekeeping): Caretaker at +91-9958881993. For anything beyond that: Host at +91-9773950713.

---

## 6. Observations for AI Automation

### Messages Safe to Auto-Reply
- Booking confirmation (already templated, just needs personalization)
- Check-in day message (already templated)
- Post-stay review request (already templated)
- WiFi password inquiries
- Address/maps link inquiries
- Late checkout requests (acknowledge + check availability flag)
- ID/form submission acknowledgment ("I sent the documents" → "Great, we've received your documents")

### Messages Requiring Human Review Before Responding
- Any complaint about staff behavior or safety (e.g., staff entering room)
- Refund requests or mentions of escalating to OTA support
- Review disputes (guest claiming host left false review)
- Requests for cooking supplies (simple to auto-reply but has a fulfillment action)
- Date change requests (requires availability check)

### Patterns That Indicate Escalation Risk
- Guest mentions "Airbnb support" or "will contact Airbnb" — flag for immediate host attention
- Guest messages that include safety words: "unsafe", "tried to open", "unprofessional"
- Guest complaints about expiry dates or hygiene ("pee stains", "no expiry date")
- Any message from a previous booking (post-checkout) that is negative in tone

### Data Quality Note
Most messages are missing `guestName`, `channel`, `timestamp`, `arrivalDate`, and `roomId` fields. Only 3 of 12 bookings have channel identified as "airbnb" and only 2 have guest names populated. This limits automated personalization and analytics. The Beds24 sync should be checked to ensure these fields are being populated correctly.
