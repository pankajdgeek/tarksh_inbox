# Tarksh Inbox - 2FA Handling Strategy

**Date**: 2026-03-03
**Context**: OTA dashboards (Airbnb, Goibibo, Agoda, Expedia) may require two-factor authentication during login. Since our architecture uses Playwright only for outbound message sending, 2FA is specifically an outbound concern. Inbound (IMAP IDLE) is completely unaffected.

---

## Scope

With the three-tier architecture, 2FA only matters for **outbound scraping sessions**. Each channel adapter declares whether it needs 2FA via the `tfaConfig` field on the `ChannelAdapter` interface (see `architecture.md`). Channels without `tfaConfig` skip 2FA handling entirely.

| Channel | Outbound Method | `tfaConfig`? | Why |
|---------|----------------|-------------|-----|
| Airbnb | Playwright (on-demand) | **Yes** | Login required for dashboard |
| Booking.com | Email relay | **No** | No login needed — email relay |
| Goibibo | Playwright (on-demand) | **Yes** | Login required for dashboard |
| Agoda | Playwright (on-demand) | **Yes** | Login required for YCS portal |
| Expedia | Playwright (on-demand) | **Yes** | Login required for Partner Central |
| WhatsApp | Baileys / Business API | **No** | Uses QR pairing, not login |

**Inbound is never affected** — IMAP IDLE does not require OTA login. Even if all outbound sessions expire, guests' messages still arrive in the inbox.

---

## 2FA Methods by OTA

| OTA | 2FA Methods | Enforced When |
|-----|------------|---------------|
| **Airbnb** | SMS OTP, Email OTP, Authenticator (TOTP) | New login, session expiry, suspicious activity |
| **Goibibo** | SMS OTP | Every login (Indian OTPs) |
| **Agoda** | Email OTP | New login, session expiry |
| **Expedia** | Email OTP, SMS OTP | New login, session expiry |

---

## Strategy Overview

Three complementary strategies, used together:

```
┌────────────────────────────────────────────────────────────────────┐
│                    2FA HANDLING STACK                               │
│                                                                    │
│  Strategy 1: Maximize Session Persistence                         │
│  ─────────────────────────────────────────                        │
│  Goal: Minimize how often 2FA is needed (target: 4-6x/year)      │
│  • Encrypted cookie persistence in Redis                          │
│  • Proactive session refresh (visit dashboard before expiry)      │
│  • Consistent device fingerprint ("remember this device")         │
│                                                                    │
│  Strategy 2: Interactive 2FA Relay (Primary)                      │
│  ────────────────────────────────────────────                     │
│  Goal: When 2FA hits, relay the challenge to admin in real-time   │
│  • Detect 2FA page via Playwright                                 │
│  • Push notification to admin (WebSocket + browser push)          │
│  • Admin enters code in Tarksh UI → forwarded to Playwright      │
│  • 10-minute timeout window                                       │
│                                                                    │
│  Strategy 3: Cookie Import (Manual Fallback)                      │
│  ────────────────────────────────────────────                     │
│  Goal: If interactive relay fails, admin can import session       │
│  • Chrome extension exports session cookies from OTA              │
│  • One-click transfer to Tarksh backend                           │
│  • Bypass login entirely — use existing authenticated session     │
│                                                                    │
│  Strategy 4: TOTP Auto-Generation (Phase 2+ Optional)            │
│  ────────────────────────────────────────────────────             │
│  Goal: Fully automated 2FA for TOTP-based OTAs                   │
│  • Property owner shares TOTP secret (opt-in)                    │
│  • System generates codes automatically                           │
│  • Zero admin intervention needed                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## Strategy 1: Maximize Session Persistence

The best 2FA strategy is **not needing it often**. Minimize session expiry frequency.

### Session Lifecycle

```
Day 0:   Initial login (2FA required) → session cookies saved to Redis (encrypted)
Day 1-7:  Session valid. Outbound sends use cached cookies. No login needed.
Day 7:    Proactive refresh — browser visits OTA dashboard to extend session.
Day 14:   Proactive refresh.
...
Day 80:   Session nearing expiry → alert admin: "Session expires soon"
Day 85:   Session expired → 2FA relay triggered automatically
```

With proactive refresh, a session that normally expires in 30 days can last 60-90 days. That means **2FA only 4-6 times per year** per OTA connection.

### Implementation Details

**Cookie persistence**:
- After successful login, extract all cookies from Playwright browser context
- Encrypt with AES-256-GCM and store in Redis (keyed by channel_connection_id)
- Before any outbound send, load cookies into a fresh browser context
- After outbound send, update cookies in Redis (session may have been refreshed)

**Device consistency**:
- Use a consistent user agent, viewport size, timezone, and language per property
- Store these as part of the channel connection config
- When OTAs see "same device" across sessions, they're less likely to trigger 2FA
- Enable "remember this device" checkbox during login

**Proactive session refresh**:
- BullMQ scheduled job: once per week per channel connection
- Acquire browser from pool → load session cookies → navigate to dashboard
- If dashboard loads successfully → session is still valid → update cookies
- If login page appears → session expired → trigger 2FA relay
- Schedule refresh at low-traffic times (e.g., 3 AM property timezone)

```typescript
// Scheduled job: proactive session refresh
const sessionRefreshJob = {
  name: 'session-refresh',
  repeat: { pattern: '0 3 */7 * *' }, // Every 7 days at 3 AM
  handler: async (job) => {
    const connection = await getChannelConnection(job.data.connectionId);
    const cookies = await loadSessionFromRedis(connection.id);

    const browser = await browserPool.acquire();
    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(getOTADashboardUrl(connection.channel_type));

    const isLoggedIn = await checkIfLoggedIn(page, connection.channel_type);

    if (isLoggedIn) {
      // Session still valid — save refreshed cookies
      const newCookies = await context.cookies();
      await saveSessionToRedis(connection.id, newCookies);
      await updateConnectionStatus(connection.id, 'connected');
    } else {
      // Session expired — will need 2FA on next outbound send
      await updateConnectionStatus(connection.id, 'session_expired');
      await notifyAdmin(connection, 'Session expired. 2FA will be needed on next reply.');
    }

    await browserPool.release(browser);
  },
};
```

---

## Strategy 2: Interactive 2FA Relay

When Playwright encounters a 2FA challenge during login or outbound send, relay the challenge to the admin in real-time.

### Flow

```
Playwright hits 2FA page during login/outbound
        │
        ▼
Detect 2FA challenge:
- Screenshot the page
- Identify 2FA type (SMS, email, TOTP)
- Extract masked target ("+91-XXXX7890" or "p***@gmail.com")
        │
        ▼
Create TFAChallenge record in database
Status: 'pending'
Expires: 10 minutes from now
        │
        ▼
Push notification to admin:
- WebSocket event to Tarksh dashboard
- Browser push notification (if permitted)
- Email alert (if admin not online)
        │
        ▼
Admin sees in Tarksh UI:
┌─────────────────────────────────────────────────┐
│  ⚠️ Airbnb requires verification                │
│                                                  │
│  A verification code was sent to your phone      │
│  ending in **7890** via SMS.                     │
│                                                  │
│  ┌──────────────────────────────┐               │
│  │  Enter code: [______]        │  [Verify]     │
│  └──────────────────────────────┘               │
│                                                  │
│  ⏱ This request expires in 9:42                 │
│  Didn't receive it? [Resend code]               │
└─────────────────────────────────────────────────┘
        │
        ▼
Admin enters code → API sends code to backend
        │
        ▼
Backend forwards code to waiting Playwright instance:
- Type code into 2FA input field
- Click submit/verify button
- Wait for dashboard to load (success) or error page (failure)
        │
        ▼
┌─────────────┐    ┌──────────────┐
│  Success     │    │  Failure     │
│  - Save      │    │  - Alert     │
│    cookies   │    │    admin     │
│  - Continue  │    │  - Log error │
│    outbound  │    │  - Retry or  │
│    send      │    │    manual    │
└─────────────┘    └──────────────┘
```

### Implementation

```typescript
interface TFAChallenge {
  id: string;
  channelConnectionId: string;
  channel: 'airbnb' | 'goibibo' | 'agoda' | 'expedia';
  tfaType: 'sms' | 'email' | 'totp' | 'unknown';
  maskedTarget: string | null;      // "+91-XXXX7890" or "p***@gmail.com"
  status: 'pending' | 'code_submitted' | 'verified' | 'expired' | 'failed';
  screenshotPath: string | null;
  expiresAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
}

async function handle2FAChallenge(
  page: Page,
  connection: ChannelConnection
): Promise<{ success: boolean; reason?: string }> {
  // 1. Detect 2FA type
  const tfaType = await detect2FAType(page);
  const maskedTarget = await extractMaskedTarget(page);
  const screenshot = await page.screenshot({ type: 'png' });

  // 2. Create challenge record
  const challenge = await db.insert(tfaChallenges).values({
    channelConnectionId: connection.id,
    channel: connection.channelType,
    tfaType,
    maskedTarget,
    screenshotPath: await saveScreenshot(screenshot),
    status: 'pending',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  }).returning();

  // 3. Notify admin via WebSocket event (for real-time UI update)
  eventBus.emit('tfa:challenge', {
    challengeId: challenge[0].id,
    channel: connection.channelType,
    propertyId: connection.propertyId,
    tfaType,
    maskedTarget,
    expiresAt: challenge[0].expiresAt,
  });

  // 4. Also send via notification registry (push, email, Slack — all registered providers)
  const channelAdapter = channelRegistry.get(connection.channelType);
  await notificationRegistry.sendAll({
    title: `${channelAdapter?.name ?? connection.channelType} requires verification`,
    body: `A ${tfaType} code was sent to ${maskedTarget}. Enter it in Tarksh to continue.`,
    urgency: 'high',
    category: 'tfa',
  }, await getPropertyAdmin(connection.propertyId));

  // 5. Wait for admin to submit code (blocks until code received or timeout)
  const code = await waitForTFACode(challenge[0].id, {
    timeout: 10 * 60 * 1000, // 10 minutes
  });

  if (!code) {
    await db.update(tfaChallenges)
      .set({ status: 'expired' })
      .where(eq(tfaChallenges.id, challenge[0].id));
    return { success: false, reason: 'tfa_timeout' };
  }

  // 6. Enter code into page (selectors come from channel adapter's tfaConfig)
  await db.update(tfaChallenges)
    .set({ status: 'code_submitted' })
    .where(eq(tfaChallenges.id, challenge[0].id));

  const adapter = channelRegistry.get(connection.channelType);
  const selectors = adapter?.tfaConfig?.selectors;
  if (!selectors) throw new Error(`No TFA selectors for channel: ${connection.channelType}`);

  const tfaInput = await page.waitForSelector(selectors.input);
  await tfaInput.fill(code);
  await page.click(selectors.submit);

  // 7. Check result
  const isSuccess = await page.waitForURL(getDashboardURLPattern(connection.channelType), {
    timeout: 15000,
  }).then(() => true).catch(() => false);

  if (isSuccess) {
    // Save new session cookies
    const cookies = await page.context().cookies();
    await saveSessionToRedis(connection.id, cookies);

    await db.update(tfaChallenges)
      .set({ status: 'verified', resolvedAt: new Date() })
      .where(eq(tfaChallenges.id, challenge[0].id));

    return { success: true };
  } else {
    await db.update(tfaChallenges)
      .set({ status: 'failed', resolvedAt: new Date() })
      .where(eq(tfaChallenges.id, challenge[0].id));

    return { success: false, reason: 'tfa_invalid_code' };
  }
}

// Helper: wait for admin to provide code via API
function waitForTFACode(challengeId: string, opts: { timeout: number }): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      eventBus.off(`tfa:code:${challengeId}`, handler);
      resolve(null);
    }, opts.timeout);

    const handler = (code: string) => {
      clearTimeout(timer);
      resolve(code);
    };

    eventBus.once(`tfa:code:${challengeId}`, handler);
  });
}
```

### 2FA Detection Selectors (Per OTA — Adapter-Owned)

2FA selectors are **not** stored in a central lookup table. Instead, each channel adapter owns its own selectors via the `tfaConfig` field on `ChannelAdapter`. This keeps channel-specific details contained within the adapter.

```typescript
// In each adapter's tfaConfig (part of ChannelAdapter interface):
interface TFAConfig {
  selectors: TFASelectors;
  supportedMethods: ('sms' | 'email' | 'totp')[];
}

interface TFASelectors {
  detect: string;        // CSS selector to detect 2FA page
  input: string;         // CSS selector for code input field
  submit: string;        // CSS selector for verify/submit button
  maskedTarget: string;  // CSS selector showing masked phone/email
  resend: string;        // CSS selector for "resend code" link
}
```

**Current adapter TFA selectors**:

| Adapter | detect | input | submit |
|---------|--------|-------|--------|
| airbnb | `[data-testid="login-pane-email-verification"], [data-testid="phone-verification"]` | `[data-testid="verification-code-input"], input[name="verificationCode"]` | `[data-testid="verify-btn"], button[type="submit"]` |
| goibibo | `.otp-input-container, #otp-input` | `.otp-input, input[name="otp"]` | `.verify-otp-btn, button[type="submit"]` |
| agoda | `[data-element-name="verification-code"], .verification-container` | `input[name="verificationCode"], .verification-input` | `button[data-element-name="verify-button"]` |
| expedia | `#verification-code-input, .mfa-container` | `#verification-code-input, input[name="code"]` | `#verify-button, button[type="submit"]` |

> **Note**: These selectors live inside each adapter and will need maintenance as OTAs update their UIs. Multiple fallback selectors per element improve resilience. When adding a new channel, its 2FA selectors are defined in the adapter — no central file to update.

---

## Strategy 3: Cookie Import (Manual Fallback)

When interactive 2FA relay fails (admin not available, Playwright can't load login page, OTA blocks automation on login), offer manual session import.

### Option A: Chrome Extension (Recommended)

A lightweight Chrome extension that captures OTA session cookies:

```
┌─────────────────────────────────────────────────────┐
│  Tarksh Session Helper (Chrome Extension)            │
│                                                      │
│  When you're logged into an OTA:                     │
│  1. Click the Tarksh icon in your browser toolbar    │
│  2. Click "Export Session to Tarksh"                 │
│  3. Your session is securely transferred             │
│                                                      │
│  Supports: Airbnb, Goibibo, Agoda, Expedia           │
│                                                      │
│  [Install Extension]                                 │
└─────────────────────────────────────────────────────┘
```

**Extension logic** (~50 lines):
1. Detect if user is on a supported OTA domain
2. On click: read all cookies for that domain
3. Send cookies to Tarksh API (`POST /api/channels/{id}/import-session`)
4. API encrypts and stores cookies in Redis
5. Done — next outbound send uses imported cookies

**Security**:
- Extension only activates on OTA domains (not all websites)
- Cookies sent over HTTPS to authenticated Tarksh API
- User must be logged into Tarksh (JWT validation on API)

### Option B: Manual Cookie Paste (Simpler, No Extension)

For users who don't want to install an extension:

```
┌─────────────────────────────────────────────────────┐
│  Manual Session Import                               │
│                                                      │
│  1. Open Airbnb in Chrome and log in normally        │
│  2. Press F12 → Application tab → Cookies            │
│  3. Copy all cookies (or use "Export Cookies" ext.)   │
│  4. Paste below:                                     │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │  [Paste cookies JSON here...]       │             │
│  │                                     │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  [Import Session]                                    │
└─────────────────────────────────────────────────────┘
```

Less user-friendly but works without any extension.

---

## Strategy 4: TOTP Auto-Generation (Phase 2+ — Optional)

If a property owner uses a TOTP authenticator app (Google Authenticator, Authy) for their OTA, they can optionally share the TOTP secret with Tarksh for fully automated 2FA.

### How It Works

```
OTA Setup:
1. Property owner sets up TOTP on their OTA account
2. During setup, the OTA shows a QR code / secret key
3. Owner also shares the secret key with Tarksh (opt-in)

Runtime:
1. Playwright hits 2FA page → detects TOTP input
2. System generates current TOTP code from stored secret
3. Code entered automatically → login completes
4. Zero admin intervention needed
```

### Implementation

```typescript
import { authenticator } from 'otplib';

async function autoResolve2FA(
  page: Page,
  connection: ChannelConnection
): Promise<boolean> {
  // Check if TOTP secret is configured
  if (!connection.totpSecretEnc) {
    return false; // Fall back to interactive relay
  }

  const secret = decrypt(connection.totpSecretEnc);
  const code = authenticator.generate(secret);

  const tfaInput = await page.waitForSelector(
    getTFAInputSelector(connection.channelType),
    { timeout: 5000 }
  );
  await tfaInput.fill(code);
  await page.click(getTFASubmitSelector(connection.channelType));

  const isSuccess = await page.waitForURL(
    getDashboardURLPattern(connection.channelType),
    { timeout: 10000 }
  ).then(() => true).catch(() => false);

  return isSuccess;
}
```

### Security Considerations

- TOTP secrets are **highly sensitive** — equivalent to a password
- Stored with AES-256-GCM encryption, same as OTA credentials
- Only decrypted in worker memory during 2FA resolution, never logged
- Opt-in only — clear warning about the security implications
- Admin can revoke/delete the TOTP secret at any time
- Not available in MVP — Phase 2+ feature

### UI for TOTP Setup

```
┌─────────────────────────────────────────────────────┐
│  Auto-2FA Setup (Optional — Advanced)                │
│                                                      │
│  Share your authenticator secret so Tarksh can        │
│  handle verification codes automatically.            │
│                                                      │
│  ⚠️ Security Notice:                                │
│  This secret gives Tarksh the ability to generate    │
│  verification codes for your OTA account. It is      │
│  encrypted and stored with the same security as      │
│  your login credentials.                             │
│                                                      │
│  Where to find your secret:                          │
│  • When you first set up 2FA on the OTA, you were   │
│    shown a QR code and/or a text secret key          │
│  • If you use Authy: Settings > Accounts > tap the  │
│    account > copy secret                             │
│  • You may need to re-setup 2FA to see the secret   │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │  TOTP Secret: [____________________]│             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  [Save Secret]  [Skip — I'll enter codes manually]  │
└─────────────────────────────────────────────────────┘
```

---

## Data Model

### New Table: `tfa_challenges`

```sql
CREATE TABLE tfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  tfa_type TEXT NOT NULL,                   -- 'sms' | 'email' | 'totp' | 'unknown'
  masked_target TEXT,                       -- '+91-XXXX7890' or 'p***@gmail.com'
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'code_submitted' | 'verified' | 'expired' | 'failed'
  screenshot_path TEXT,                     -- path to screenshot of 2FA page
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tfa_challenges_connection ON tfa_challenges(channel_connection_id);
CREATE INDEX idx_tfa_challenges_status ON tfa_challenges(status) WHERE status = 'pending';
```

### Column Addition: `channel_connections`

```sql
-- TOTP secret (Phase 2+, optional)
ALTER TABLE channel_connections ADD COLUMN totp_secret_enc TEXT;
```

---

## Login Flow Decision Tree

Complete decision tree used by the outbound scraper when a session is needed:

```
Need to send outbound message
        │
        ▼
Load session cookies from Redis
        │
        ├── Cookies exist?
        │       │
        │   ┌───▼────┐     ┌──────────┐
        │   │  YES    │     │   NO     │
        │   └───┬────┘     └────┬─────┘
        │       │               │
        │       ▼               ▼
        │  Load cookies    Go to login page
        │  into browser    Enter credentials
        │  context              │
        │       │               ▼
        │       ▼          2FA challenge?
        │  Visit OTA            │
        │  dashboard       ┌────┼────────┐
        │       │          │    │        │
        │       ▼         NO  SMS/Email  TOTP
        │  Logged in?      │    │        │
        │       │          ▼    │        │
        │  ┌────┼────┐  Login   │    TOTP secret
        │  │    │    │  success │    configured?
        │  YES  NO   │    │    │        │
        │  │    │    │    ▼    │   ┌────┼────┐
        │  │    ▼    │  Save   │   YES  NO   │
        │  │  Session│  cookies│   │    │    │
        │  │  expired│    │    │   ▼    ▼    │
        │  │    │    │    │    │ Auto  Interactive
        │  │    ▼    │    │    │ TOTP  2FA relay
        │  │  Go to  │    │    │ gen   to admin
        │  │  login  │    │    │   │    │
        │  │  page   │    │    │   │    │
        │  │  (restart)   │    │   │    │
        │  │         │    │    │   │    │
        │  ▼         │    │    │   │    │
        │  Continue  │    │    │   │    │
        │  outbound  ◄────┘    │   │    │
        │  send      ◄────────┘   │    │
        │            ◄────────────┘    │
        │            ◄─────────────────┘
        │
        ▼
   Send reply via Playwright
   Verify delivery
   Update cookies in Redis
```

---

## User-Facing Channel Connection States

The channel connection status in the UI accounts for 2FA states:

| Status | UI Display | Action Available |
|--------|-----------|-----------------|
| `connected` | ✅ Connected | None needed |
| `session_expiring` | ⚠️ Session expires soon | [Refresh Session] |
| `session_expired` | 🔴 Session expired | [Re-authenticate] |
| `tfa_pending` | 🔐 Verification needed | [Enter Code] |
| `tfa_failed` | ❌ Verification failed | [Try Again] / [Import Session] |
| `disconnected` | 🔴 Disconnected | [Reconnect] |
| `error` | ❌ Error: {message} | [Retry] / [Import Session] |

---

## Frequency Expectations

With all strategies combined, the expected 2FA frequency per OTA connection:

| Scenario | 2FA Frequency | Admin Effort |
|----------|---------------|-------------|
| Session persistence + proactive refresh | Every 60-90 days | ~30 sec per event |
| TOTP auto-generation (Phase 2+) | **Zero** (fully automated) | None |
| Session expired, admin online | Immediate (< 2 min) | Enter one code |
| Session expired, admin offline | Delayed until admin returns | Enter one code + retry outbound queue |

**Worst case**: Admin enters a 2FA code 4-6 times per year per OTA channel. At 3 OTA channels per property, that's ~12-18 codes per year — roughly **once per month**. Each takes 30 seconds.

**Best case (TOTP configured)**: Zero manual intervention.
