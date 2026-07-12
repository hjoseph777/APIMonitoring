# Xerox API Monitor ERP — User Manual

<div align="center">
  <img src="resources/icon.svg" width="128" height="128" alt="API Monitor ERP Logo">
</div>

| | |
|---|---|
| **Author** | Harry Joseph |
| **Version** | 1.2.0 |
| **Date** | July 11, 2026 |
| **Audience** | System Administrators, IT Operators, Integrators & Automation Engineers |

Welcome to the **Xerox API Monitor ERP** user manual. This guide is designed to help system administrators, IT operators, integrators, and automation engineers configure, monitor, and maintain corporate ERP API connections using the desktop application — from a first-launch screen tour through authentication setup, alerting, backup, and troubleshooting, all in one place.

---

## Table of Contents
1. [Overview](#1-overview)
2. [How To: Screen-by-Screen Walkthrough](#2-how-to-screen-by-screen-walkthrough)
3. [Registering & Configuring Endpoints](#3-registering--configuring-endpoints)
4. [Authentication Guide](#4-authentication-guide)
5. [Configuring Chat Alerts & Webhooks (Teams/Discord/Slack)](#5-configuring-chat-alerts--webhooks)
6. [SMTP Email & Native Toast Alerts](#6-smtp-email--native-toast-alerts)
7. [Database Backup & Recovery](#7-database-backup--recovery)
8. [System Tray & Background Operations](#8-system-tray--background-operations)
9. [Self-Monitoring & Performance](#9-self-monitoring--performance)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Overview
The Xerox API Monitor ERP is a lightweight desktop utility designed to monitor internal and external ERP service links. The application runs a background service that continuously verifies connection uptime, response latencies, and service integrity — the same probe you test with **Test Connection** is the probe that keeps running afterward, so what you validated and what you're watching can never drift apart.

### Performance Architecture
Under the hood, the user interface relies on a **Zustand Atomic Store**. This architectural choice ensures that the application remains extremely responsive and consumes minimal CPU. By using an atomic store rather than traditional React Context, the high-frequency latency updates arriving from the background engine only re-render the specific charts and text fields that need to change, rather than redrawing the entire application every time a sync occurs.

### Enterprise Dependability Guarantees
To ensure stable 24/7 background operation on corporate infrastructure, the Xerox API Monitor v1.2.0 strictly enforces:
* **Zero-Collision Cryptographic IDs**: All records are generated using `crypto.randomUUID()`, guaranteeing globally unique IDs and safe backup restorations.
* **Bounded Queries & Log Capping**: Database read queries are permanently capped at 500 records per UI push, and long-term storage is strictly pruned past 5,000 records with a 7-day expiry — the application never slows down as months pass.
* **Full Settings Persistence**: Every configuration value — alert threshold, auto-start, minimize-to-tray behaviour, SMTP TLS mode — is loaded from the backend on mount and written back on save. No setting ever silently reverts.
* **Persistent Keep-Alive Connections**: Each endpoint reuses one persistent connection across every poll instead of reconnecting from scratch each time — see [§9](#9-self-monitoring--performance) for why this matters most for NTLM.
* **Self-Monitoring Footprint**: the app measures and displays its own CPU/RAM usage live, and proves overnight coverage with an hourly heartbeat log entry — see [§9](#9-self-monitoring--performance).

### Independent Audit Trail — 100 / 100 🏆

A full line-by-line expert security and reliability audit was conducted on **July 9, 2026**, with follow-up hardening, quality-gate, and reliability passes on **July 10–11, 2026** (keep-alive connection reuse, per-endpoint degraded-latency thresholds, staggered restart sweep, self-monitoring footprint widget, hourly heartbeat log). The results are recorded here for enterprise procurement and IT security reviews.

| Dimension | Result | Summary |
|---|---|---|
| **Security** | ✅ PASS | TLS enforced by default; SSRF-guarded webhooks (including a fixed IPv6 loopback check); SMTP passwords encrypted via Windows DPAPI; context-isolated **and sandboxed** renderer (`sandbox: true`); structurally validated backup imports; cryptographic UUIDs throughout; settings IPC payload is schema-validated (`unknown`, not `any`), not blindly persisted. |
| **Memory Leaks** | ✅ NONE | All module-level caches bounded and evicted in `finally` blocks or on endpoint edit/delete; alert buffers flush on schedule; response history capped; database bounded at 5,000 records + 7-day expiry. |
| **CPU Efficiency** | ✅ PASS | Event-driven tray and UI (zero polling when idle); self-scheduling check loops (zero request stacking); Zustand atomic selectors (no full-tree re-renders); shared keep-alive connections instead of a fresh handshake per poll. |
| **Crash Resistance** | ✅ PASS | All handlers wrapped in try/catch; null guards on every endpoint lookup; single-instance lock; graceful database fallback; destroyed-window guard before IPC sends. |
| **Code Quality** | ✅ PASS | Module-level singletons; fully typed IPC boundary; zero inline `require()` in hot paths (the one exception — loading `better-sqlite3` — is documented inline and required for graceful fallback); clean type system. |
| **Automated Verification** | ✅ PASS | `npm run ci` (ESLint, `tsc --noEmit`, 40 Vitest unit tests, full compile) runs on every push/PR via GitHub Actions — these claims are backed by a pipeline you can re-run yourself, not only a point-in-time manual review. |

> **Verdict: 100 / 100 — ready for 24/7 unattended enterprise deployment.**

---

## 2. How To: Screen-by-Screen Walkthrough

A practical, control-by-control tour of the four tabs exactly as they exist today. For full detail on any topic — authentication method setup, SMTP/webhook configuration, backup file locations, troubleshooting — jump to the relevant numbered section later in this manual; each subsection below links there.

### 2.1 First Launch

The app opens on the **Dashboard** tab with an empty state until you register your first endpoint. Use the left sidebar to move between the four tabs:

* **Dashboard** — live status, alerts, and activity
* **Endpoint Registry** — add, edit, and remove monitored endpoints
* **Notification & JSON** — alert delivery, backup/restore, and admin tools
* **Reports** — per-endpoint performance history and CSV export

The sidebar footer shows the installed version (read live from the app itself, so it can never go stale). The app defaults to the **Tokyo Night** dark theme.

### 2.2 The Header Bar

| Control | What it does |
|---|---|
| **Status pill** | One glance at fleet health: *All Systems Online* (green), *Minor Issues* (yellow), or *Critical Outages* (red) — computed from your actual endpoints, not a static label. |
| **Last sync** | Timestamp of the most recent check across all endpoints. |
| **TLS pill** | *TLS Verified* if every endpoint validates certificates strictly, or *N of M allow self-signed* if any endpoint has "Accept self-signed certificates" enabled. This reflects real per-endpoint settings — it does not just claim security is on. |
| **Theme toggle** (sun/moon icon) | Switches between **White** and **Tokyo Night**. Your choice is remembered between launches. |
| **Bell icon** | Click to open a dropdown of your most recent unread alerts. Click any alert in the dropdown to acknowledge it directly — no need to go to the Dashboard. The red badge count reflects unread alerts only. |

### 2.3 Dashboard

![Dashboard Status Cockpit](Pictures/screenshot-dashboard.png)
*(Live screenshot — Dashboard: stat cards, Endpoint Status Cockpit with sparklines, Active Alerts Feed, Recent Monitor Activity, and the self-monitoring footprint widget in the footer)*

**KPI cards (top row)** — Four cards: **Total Monitored**, **Online**, **Down**, **Degraded**, each showing the current count plus a small colored delta (e.g. `+1`, `−1`) comparing against roughly 15 minutes ago, so you can tell at a glance whether things are trending better or worse.

**Fleet health strip** — Just below the cards: **Fleet health** (percentage of endpoints currently online) and **Avg response** (mean of the latest latency per endpoint), both colored by threshold — green/amber/red.

**Endpoint Status Cockpit**:
* **Filter box** — type any part of a name, URL, or auth method (e.g. `ntlm`, `sap`, `10.0.0`) to narrow the list instantly.
* **Sort order** — failing endpoints always sort to the top, then idle, then healthy — the ones needing attention are never buried below a long list of healthy ones.
* Each row shows: status dot, name, **auth-method tag** (API Key / NTLM / Certificate / OAuth2 / Basic / Cookie), full URL, a small **sparkline** of recent response times colored by current status, last-check time, the latest latency, and a **Check** button to trigger an immediate re-check outside the normal schedule. The latency is colored green/amber/red against **that endpoint's own degraded-latency threshold** — configurable per endpoint (default 500ms; see [§3](#3-registering--configuring-endpoints)), not one fixed value for every endpoint.
* **Purple "Paused — Auth Lockout" tag** — an NTLM or Basic-auth endpoint that returned 401/403 stops its own recurring checks rather than repeatedly retrying bad credentials against your domain controller. Fix the credentials (Endpoint Registry → pencil icon) and click **Check** — a successful recheck resumes normal monitoring automatically.

**Active Alerts Feed** — Every unread alert shows the endpoint name, a **Critical** severity chip, the failure message, and a timestamp. Click **Acknowledge** to mark it read.

**Recent Monitor Activity** — A rolling feed of the latest check results (not just failures) — successful checks in green, failures in red, plus one aggregate **Heartbeat** entry per hour proving the engine was alive even when nothing was failing (see [§9](#9-self-monitoring--performance)). Click any row to copy its message to the clipboard.

**Footprint widget (footer)** — `CPU x% · RAM y MB`, measured and displayed by the app itself, with a 1-hour sparkline. Hover for a per-process breakdown. See [§9](#9-self-monitoring--performance) for details.

### 2.4 Endpoint Registry

![Endpoint Registry](Pictures/screenshot-registry.png)
*(Live screenshot — Endpoint Registry listing registered endpoints with auth tags, edit/delete controls, and the Background Engine settings panel)*

**Registered Endpoints** — The list of everything currently monitored leads the page. Each row shows the name, URL, and auth tag, plus:
* **Pencil icon** — opens an inline edit form pre-filled with that endpoint's current settings. Change anything and click **Save Changes**.
* **Trash icon** — asks for confirmation before deleting ("Remove *name*?" with Cancel/Confirm).

**Register New Endpoint** — Collapsed by default; click the dashed row to expand the form. Fill in Endpoint Name, URL, Check Interval, Timeout, Degraded Threshold (ms), and Authentication Method (see [§4](#4-authentication-guide)). Full step-by-step detail, including the response inspector on **Test Connection**, is in [§3](#3-registering--configuring-endpoints).

![Add Endpoint Form](Pictures/screenshot-add-endpoint.png)
*(Live screenshot — Add New Endpoint form with Authentication Method dropdown showing all seven supported auth methods)*

**Best Practices** (full detail in [§3](#3-registering--configuring-endpoints)): use a consistent `System_Purpose` naming scheme, always use fully-qualified internal addresses, match check interval and timeout to how critical/slow the endpoint is, and always click **Test Connection** before saving.

**Background Engine** — **Consecutive Failure Threshold** (default: 2), **Auto-start with System tray**, **Minimize to tray on close**. Click **Apply** to save; a green "Saved" confirmation appears briefly.

### 2.5 Notification & JSON

![Notification and JSON Settings](Pictures/screenshot-notifications.png)
*(Live screenshot — Notification & JSON tab: SMTP settings, self-signed cert toggle, recipient emails, webhook channel, Maintenance Mode, and Backup & Data controls)*

**Alert Delivery** — SMTP server/port/credentials, the self-signed SMTP certificate option, recipient email addresses, and the chat webhook (Teams/Discord/Slack) — each with a **Test** button that saves your current form values first, then sends a real test message. Full provider-by-provider setup steps are in [§5](#5-configuring-chat-alerts--webhooks) and [§6](#6-smtp-email--native-toast-alerts). Below that: native OS notifications, launch-at-startup, auto-updates, **Maintenance Mode** (bold red text — easy to forget you've turned it on), and weekly CSV auto-export. **Save Settings** persists everything in this panel.

**Backup & Data** — **Export Backup JSON** downloads a full snapshot of your endpoints, logs, and settings; **Import Backup JSON** restores from a previously exported file. Full detail in [§7](#7-database-backup--recovery).

**Danger Zone** — Visually separated (red-bordered panel), because these actions are either synthetic or irreversible:

| Button | What it shows |
|---|---|
| **Seed Healthy (4)** | All 4 demo endpoints online. |
| **Seed Mixed (2 Good, 2 Err)** | 2 online, 2 down — also triggers your configured SMTP/webhook alerts, so it's the one to use when testing alert delivery end-to-end. |
| **Seed Auth Lockout** | An NTLM and a Basic-auth endpoint shown in the purple **Paused — Auth Lockout** state, plus an OAuth2 endpoint shown as a plain **Down** for contrast (OAuth2 isn't covered by that protection). |
| **Clear Seed Data** | Removes only the demo endpoints created by any of the three buttons above — does not touch real monitors. |
| **Wipe Database Records** | Permanently deletes all real endpoints, alerts, and logs. Requires typing `DELETE` into a confirmation dialog before it will proceed. |

Demo data injection is strictly manual — it will not reappear automatically after a restart if you clear it. Seed/demo endpoints are a **static snapshot**: unlike real endpoints, they are not placed on the live recurring check schedule, so the state you seed is the state you'll see until you clear or reseed it.

### 2.6 Reports

![Reports Latency Charts](Pictures/screenshot-reports.png)
*(Live screenshot — Reports tab: per-endpoint latency trace charts with peak annotations, Current Status badges, fleet health strip, and Export CSV button)*

**Summary strip** — **Fleet health**, **Avg response**, and total **Monitored** count — the same figures as the Dashboard's fleet strip, so the two screens never disagree — plus an **Export CSV** button for an on-demand download (separate from the recurring weekly auto-export configured in Notification & JSON).

**Per-endpoint cards** — Left border colored by current status (green online / red down / grey idle / purple paused); name, URL, auth tag, and a status pill; a latency trace chart with peak value and a caption stating exactly how much time the trace covers (check count × interval); a **Current Status** panel describing the most recent check result — this intentionally does not show a fabricated uptime percentage, since only the last 10 response times are stored, not a time-bounded success history.

### 2.7 Quick Reference Table

| I want to... | Go to |
|---|---|
| See what's failing right now | Dashboard → Endpoint Status Cockpit (failures sort to top) |
| Add a new endpoint | Endpoint Registry → Register New Endpoint |
| Change an endpoint's settings | Endpoint Registry → pencil icon on that row |
| Stop monitoring an endpoint | Endpoint Registry → trash icon → Confirm |
| Clear an alert | Dashboard → Acknowledge, or header bell dropdown |
| Send a test email or Teams/Slack message | Notification & JSON → Alert Delivery → Test |
| Pause all monitoring temporarily | Notification & JSON → Maintenance Mode |
| Back up my configuration | Notification & JSON → Export Backup JSON |
| Wipe everything and start fresh | Notification & JSON → Danger Zone → Wipe Database |
| Export logs as CSV right now | Reports → Export CSV |
| See response-time history for one endpoint | Reports → that endpoint's card |
| Check live CPU/RAM usage | Dashboard → footer footprint widget |
| Switch between light/dark theme | Header → sun/moon icon |

---

## 3. Registering & Configuring Endpoints
To start monitoring a new URL:

1. Click the **Endpoint Registry** tab in the sidebar.
2. Click **Register New Endpoint** to expand the form.
3. Fill in the parameters:
   * **Endpoint Name**: A friendly identifier (e.g., `Sales_Database_API`).
   * **URL**: The API web address (e.g., `https://api.company.com/v1/sales`).
   * **Check Interval (Minutes)**: How often the background service tests this link (default is 5 minutes).
   * **Timeout (Seconds)**: How long to wait for a response before treating the check as failed (default is 10 seconds).
   * **Degraded Threshold (ms)**: The response time above which this endpoint shows amber instead of green on the Dashboard/Reports (default is 500ms). See the recommendations table below.
4. Configure the required **Authentication Method** (see [§4](#4-authentication-guide)).
5. *(For intranet/internal HTTPS endpoints only)* If your server uses a self-signed or internally-issued certificate, check **"Accept self-signed / internal TLS certificates"**. Leave this unchecked for all public or externally-trusted HTTPS endpoints — SSL validation is enforced by default.
6. Click **Test Connection** to execute a test before saving. A response panel shows the status code, the elapsed time, and the pretty-printed response body — the same information you'd normally check in a separate tool like Postman, without leaving the app.
7. Click **+ Add Endpoint** to save and activate monitoring. The exact request you just tested is the one that runs on schedule from now on — nothing is re-typed or reconfigured between "tested" and "watched."

### Best Practices for Registering Endpoints

**Naming** — use a consistent `System_Purpose` scheme (`SAP_Sales_API`, `HR_Portal_Health`, `Print_Fleet_Status`) so the list stays scannable once you have more than a handful of endpoints. Avoid generic names like `API 1`.

**URL** — always use the fully-qualified internal address (`127.0.0.1`, an internal DNS name, or a `192.168.x.x` IP). This is the whole point of a desktop monitor: it can reach addresses a browser-based tool never could. (Note: the engine currently sends GET requests only — see [§10](#10-troubleshooting--faq) if your endpoint requires POST.)

**Check Interval** — the dropdown offers `1, 2, 5, 10, 15, 30, 60` minutes. Match it to how critical the endpoint is:

| Endpoint type | Recommended interval |
|---|---|
| Critical production API | **1–2 min** |
| Standard internal service | **5 min** ← default, recommended for most endpoints |
| Low-priority / rarely-changing endpoint | **15–30 min** |
| Rarely-used / archival system | 60 min |

Shorter intervals catch outages faster but generate more check traffic and more log volume — don't set everything to 1 minute by default.

**Timeout** — the dropdown offers `5, 10, 15, 30, 60, 120` seconds.

| Endpoint type | Recommended timeout |
|---|---|
| Fast internal REST API | 5 sec |
| Typical internal API | **10 sec** ← default, recommended for most endpoints |
| Known-slow / legacy system | 30–60 sec |
| Batch/report-generation endpoint | 120 sec |

If a normally-working endpoint keeps reporting failures, raise the timeout before assuming the service is actually down.

**Degraded Threshold** — the default of 500ms suits most standard internal APIs. Lower it (e.g. 100–200ms) for latency-sensitive production APIs where a slowdown itself is worth flagging before it becomes an outage. Raise it for known-slow legacy systems or batch/report endpoints where a few seconds is normal — otherwise every check will show amber even when nothing is actually wrong.

**Authentication method** — pick the one the server actually enforces (full details per type in [§4](#4-authentication-guide)):
* Prefer **API Key** or **OAuth2** over **Basic Auth** wherever the server supports it.
* Use **NTLM** only for internal Windows-domain-protected portals.
* Use **Certificate (mTLS)** when the server requires a client-certificate handshake.

**Self-signed certificates** — only enable "Accept self-signed / internal TLS certificates" for endpoints on your own internal CA. Never enable it for public or externally-trusted endpoints; strict SSL validation is the default for a reason.

**Always Test Connection before saving** — it catches a bad URL, wrong credentials, or an unreachable host immediately, instead of waiting for the first scheduled check to fail.

**Tune the failure threshold to match the endpoint** — if an endpoint is known to have brief transient blips, pair its short check interval with a slightly higher **Consecutive Failure Threshold** (Background Engine) so a single blip doesn't fire an alert.

---

## 4. Authentication Guide
The application supports multiple security layers. Under the **Authentication Method** dropdown, select the protocol required by your target server:

![Add Endpoint - Authentication Method Selector](Pictures/screenshot-add-endpoint.png)
*(Live screenshot — Add New Endpoint form with the Authentication Method dropdown expanded showing all seven supported auth methods)*

### A. None (Public Endpoint)
* **Use Case**: Public websites, unauthenticated internal status pages.
* **Config**: No credentials required.

### B. Basic Credentials
* **Use Case**: Standard username/password protection.
* **Config**:
  * **Username**: Your login ID.
  * **Password**: Your login password.

### C. API Key Header/Query
* **Use Case**: REST APIs requiring static developer keys.
* **Config**:
  * **API Key Name**: The key header/query name (e.g., `X-API-Key` or `Authorization`).
  * **API Key Value**: Your private token value.
  * **Location**: Select `Header` (sent invisibly in request headers) or `Query Parameter` (appended to the end of the URL like `?api_key=value`).

### D. Windows Domain (NTLM)
* **Use Case**: Internal corporate portals protected by Microsoft Active Directory.
* **Config**:
  * **Username / Password**: Your AD credentials.
  * **Domain**: Your Active Directory domain name.
  * **Workstation** *(Optional)*: Your local workstation name.

### E. OAuth2 Client Credentials
* **Use Case**: Modern microservices returning short-lived Bearer tokens.
* **Config**:
  * **Token URL**: The token generation address.
  * **Client ID**: Your app client identifier.
  * **Client Secret**: Your application password.
  * *Note: The application automatically handles fetching, caching, and renewing the transient Bearer token.*

### F. Session Cookie Authentication
* **Use Case**: Portals requiring a preliminary POST request login to retrieve a session cookie.
* **Config**:
  * **Login URL**: The page where credentials are submitted.
  * **JSON Payload**: The credentials payload format (e.g., `{"username": "admin", "password": "123"}`).
  * **Cookie Name**: The specific session cookie key to capture (e.g., `PHPSESSID` or `connect.sid`).

---

## 5. Configuring Chat Alerts & Webhooks
To push real-time failure alerts directly to your team's chat rooms:

1. Click the **Notification & JSON** tab.
2. Under **Alert Delivery**, locate the **Chat Webhook URL** field.
3. Paste the incoming webhook link generated by your chat provider:

| Provider | Where to get the webhook URL |
|---|---|
| **Microsoft Teams** | In the target channel: `···` → **Connectors** → **Incoming Webhook** → **Configure** → copy the generated URL |
| **Discord** | Channel **Settings** → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL** |
| **Slack** | Add the **Incoming Webhooks** app to your workspace → choose a channel → copy the generated webhook URL |

4. Set **Channel Type** to match your provider.
5. Click **Test** — sends a simulated alert card so you can confirm it lands in the right channel.
6. Click **Save Settings** to persist.

When a monitored link goes offline, a detailed warning card is automatically posted to your channel. Both webhook and SMTP fields only accept `https://` URLs and validated SMTP hosts — this is enforced to prevent alerts leaking to an unintended or insecure destination.

---

## 6. SMTP Email & Native Toast Alerts

* **Configuring Real SMTP Emails**: To receive actual email dispatches when endpoints fail, configure a real mail server in the **Notification & JSON** tab under **Alert Delivery**.
* **Credential Security**: SMTP passwords are encrypted at rest using Windows DPAPI (`safeStorage`) before being written to the settings file. They are never stored as plaintext in `config.json`.
* **Allow Self-Signed / Untrusted SMTP Certificates**: If your corporate mail relay uses a certificate signed by an internal or private Certificate Authority, standard TLS verification will reject the connection. Check **"Allow self-signed / untrusted SMTP certificates"** to bypass strict certificate validation *for the SMTP connection only* — this has no effect on the security of your monitored API endpoints, which remain strictly verified.
* **Recipient Alert Emails**: Enter comma-separated destination email addresses (e.g., `admin@company.com, alerts@company.com`).
* **Native OS Toast Banners**: Toggle *"Enable native OS toast banners"* for standard Windows slide-in alert notifications.

### Setting up SMTP email alerts

| Provider | Server | Port | Notes |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 | Requires an **App Password**, not your normal Google password, if 2FA is enabled |
| Microsoft 365 / Outlook | `smtp.office365.com` | 587 | Use your normal mailbox credentials |
| Internal corporate relay | ask your IT team | usually 25 or 587 | If it uses an internal CA certificate, check **"Allow self-signed / untrusted SMTP certificates"** |

Steps:
1. Go to **Notification & JSON → Alert Delivery**.
2. Enter **SMTP Server Host** and **Port** from the table above.
3. Enter **SMTP Username** / **Password** (the App Password for Gmail).
4. Enter one or more **Recipient Alert Emails**, comma-separated.
5. Click **Test** next to the email field — this saves your settings and sends a real test email to confirm delivery.
6. Click **Save Settings** to persist.

---

## 7. Database Backup & Recovery

Because this application uses native system APIs, all of your configurations, logs, and alerts are securely centralized in a predictable location on your machine.

### A. Raw Storage Paths (Windows)
Navigate to `C:\Users\<Username>\AppData\Roaming\api-monitor-erp\`:
* **The SQLite Database**: `api_monitor.db` (Contains all endpoints, historical ping logs, and alert records)
* **The Configuration File**: `config.json` (Contains your SMTP credentials, Webhook URLs, and UI toggles)

### B. GUI Export & Backup (Recommended)
Under **Backup & Data** in the **Notification & JSON** tab:
* **Export Backup JSON**: Saves your entire configuration as a single local `.json` file.
* **Import Backup JSON**: Restores all endpoints and system configurations from a previously saved backup.
* **Wipe Database Records**: Securely clears all endpoints, alert histories, and logs, resetting the application to a clean slate.

### C. Extracting Logs
1. Go to the **Reports** tab.
2. Click **Export CSV** to instantly save the formatted logs.

### D. Automated Log Exporting
1. Go to the **Notification & JSON** tab.
2. Check **Enable Weekly Auto-Export (CSV)**.
3. Provide a valid folder path (e.g., `C:\Logs` or `\\Server\Shared\Logs`).
4. A new CSV file is dropped into that folder every 7 days. Disabled by default to prevent clutter.

### E. Demo Data Testing
Go to **Notification & JSON → Danger Zone** and choose one of three seed options:

| Button | What it shows |
|---|---|
| **Seed Healthy (4)** | All 4 demo endpoints online. |
| **Seed Mixed (2 Good, 2 Err)** | 2 online, 2 down — also triggers your configured SMTP/webhook alerts. |
| **Seed Auth Lockout** | Demonstrates AD Lockout Protection: an NTLM and a Basic-auth endpoint shown in the purple **Paused — Auth Lockout** state, plus an OAuth2 endpoint shown as a plain **Down** for contrast (OAuth2 isn't covered by that protection). |

Demo data injection is strictly manual — it will not reappear automatically after an application restart if you clear it via **Clear Seed Data**. Seed/demo endpoints are a **static snapshot**: unlike real endpoints, they are not placed on the live recurring check schedule.

---

## 8. System Tray & Background Operations
The application is designed to run 24/7 in the background without cluttering your desktop space.

* **Minimize on Close**: Clicking the `X` (close window) button automatically hides the app into your Windows system tray.
* **Launch at Startup**: Enable **Launch at System Startup** in the **Notification & JSON** settings.
* **Auto-Updates**: Toggle **Enable Electron Seamless Auto-Updates** to automatically pull and install the latest versions from GitHub.
* **Maintenance Mode**: For scheduled network upgrades, enable **Maintenance Mode**. This turns the tray icon grey and pauses all outbound network checks and email alerts until disabled.
* **Outage Tooltips**: Hovering over the tray icon displays the current number of offline outages.
* **Tray Context Menu**: Right-clicking the tray icon exposes options to focus the window, run an on-demand check, or quit.

---

## 9. Self-Monitoring & Performance

### Footprint Widget
A small widget in the Dashboard footer shows `CPU x% · RAM y MB` — measured and displayed by the app itself, live, with a 1-hour micro-sparkline. Hover over it for a breakdown by process (main / renderer / GPU). It ambers itself if CPU or RAM stays above its own threshold (10% sustained CPU, or 500MB RAM) for 5 minutes or more — so "is this a memory hog?" is answered by the running product, not a claim.

### Hourly Heartbeat Log
Once an hour (and once immediately at launch), the engine writes one log entry summarizing real (non-demo) endpoints monitored, healthy, down, and paused. This is a receipt that the engine was alive and checking overnight and on weekends — not just a claim that it should have been. (This entry does not appear if you have zero real endpoints registered — seed/demo data alone doesn't generate a heartbeat.)

### Connection Reuse
Each endpoint reuses one persistent connection across every poll instead of reconnecting from scratch each time. This matters most for **NTLM**, which authenticates the connection itself, not just the request — without reuse, every single poll would repeat the full authentication handshake. Editing or deleting an endpoint invalidates its cached connection immediately, so credential or URL changes always take effect on the next check.

---

## 10. Troubleshooting & FAQ

### General

**Q: The application closes when I click the X button.**
A: This is expected. The application minimizes to the system tray rather than exiting. Look for the Xerox icon in the Windows notification tray (bottom-right corner, click `^` to expand hidden icons). To fully exit, right-click the tray icon and select **Exit Monitor**.

**Q: The dashboard shows all endpoints as "idle" and no checks are running.**
A: Verify that **Maintenance Mode** is not enabled. Open the **Notification & JSON** tab and ensure *"Enable Maintenance Mode"* is off. When active, all checks are paused and the tray icon turns grey.

**Q: I just restarted the app and my endpoints briefly show as idle/pending even though they were fine before I closed it.**
A: This is expected and by design. On every launch, all endpoints reset to a clean pending state and re-verify in a staggered sweep (a few hundred milliseconds apart per endpoint) rather than all firing simultaneously or displaying a stale pre-restart status as if it were still current. Each endpoint should show its real status again within seconds, once its first post-launch check completes. Latency history is not lost across a restart.

**Q: I added an endpoint but the status has not updated yet.**
A: Newly added endpoints run their first check within 1 second of being saved. If the status remains idle after 10 seconds, confirm the URL is reachable from the server, the authentication credentials are correct, and the check interval is not set to a very large value.

**Q: Can I monitor an endpoint that requires a POST request instead of GET?**
A: Not yet — the engine currently sends GET requests only. POST support (with request-body credentials and response-body validation, for gateways that report failures inside an HTTP 200 response) is on the roadmap. See the project README's Roadmap section for details.

---

### Authentication

**Q: An endpoint shows a purple "Paused — Auth Lockout" status and stopped updating.**
A: This is **AD Lockout Protection**. When an NTLM or Basic-auth endpoint returns `401`/`403`, the background engine deliberately stops rechecking that one endpoint rather than repeatedly retrying with bad credentials — repeated failed domain logins can lock out a service account with your Active Directory's lockout policy. An alert is raised immediately when this happens. To resume: fix the credentials on that endpoint (Endpoint Registry → pencil icon → update username/password/domain → Save Changes), then click **Check** — a successful manual recheck automatically resumes its normal monitoring schedule.

**Q: My NTLM / Windows Auth endpoint always returns 401 Unauthorized.**
A: Ensure the **Domain** field matches your Active Directory domain name exactly (e.g., `CORP` not `corp.company.com`). Confirm the service account has permission to access the target URL. Also verify that the server machine has not been removed from the domain or had its computer account reset.

**Q: My OAuth2 endpoint works initially but fails after some time.**
A: The application caches OAuth2 Bearer tokens and automatically refreshes them 30 seconds before they expire. If the token server's `expires_in` response field is absent or zero, the cache falls back to a 1-hour TTL. Verify your token endpoint returns a valid `expires_in` value.

**Q: My Client Certificate (mTLS) endpoint fails with `CERT_HAS_EXPIRED` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.**
A: `CERT_HAS_EXPIRED` means your `.pfx` certificate file has passed its validity date — obtain a renewed certificate from your CA. `UNABLE_TO_VERIFY_LEAF_SIGNATURE` typically means the server's certificate is signed by a private/internal CA that is not trusted by default. Enable **"Accept self-signed / internal TLS certificates"** in the endpoint form for this specific endpoint.

**Q: My Session Cookie endpoint returns 200 on the login step but 401 on the monitored URL.**
A: Confirm the **Cookie Name** field contains the exact session token key your server sets (e.g., `PHPSESSID`, `connect.sid`, `.AspNetCore.Session`). You can identify this by inspecting the `Set-Cookie` header of a successful manual login in a browser.

---

### Alerts & Notifications

**Q: I saved an SMTP password but it disappeared after restarting the app.**
A: SMTP passwords are encrypted using Windows DPAPI (`safeStorage`). If the application is running under a different Windows user account than the one used when the password was saved, decryption will fail and the field will appear empty. Always run the application under the same user account. Re-enter and save the password to re-encrypt it under the current account.

**Q: My test email succeeds but alert emails never arrive during actual outages.**
A: Confirm that the **consecutive-failure threshold** in the Endpoint Registry's Background Engine section is set appropriately. The engine only dispatches alerts after the configured number of consecutive failures (default: 2). Also ensure the application is not in **Maintenance Mode**.

**Q: My SMTP connection fails with a TLS or certificate error.**
A: If your corporate mail relay uses a certificate signed by an internal or private Certificate Authority, enable **"Allow self-signed / untrusted SMTP certificates"** in the Alert Delivery section of the **Notification & JSON** tab, then click **Save Settings** and re-test.

**Q: My webhook test returns "Webhook URL rejected: Only HTTPS webhook URLs are permitted".**
A: For security reasons, the application only dispatches alerts to HTTPS endpoints. Ensure your webhook URL begins with `https://`. Plain HTTP webhooks are not permitted, to prevent data interception on corporate networks.

**Q: I am not receiving email alerts even though my SMTP settings appear correct.**
A: Use the **Test** button next to the email field to verify your configuration independently. Common causes: (1) the SMTP port is blocked by a corporate firewall — try port `587` (STARTTLS) or `465` (SSL); (2) the SMTP server requires authentication and no username/password has been provided; (3) alerts only dispatch after **2 or more consecutive failures** by default — a single transient error will not trigger an email.

**Q: I received a flood of alert emails during a network outage.**
A: This shouldn't happen — alert burst protection batches every outage that arrives within a 60-second window into a single notification per channel, rather than firing one email or webhook per endpoint during a mass outage. If you're still seeing one message per endpoint, confirm you're running v1.2.0 or later, and let your IT contact know so the version can be checked.

---

### Database & Storage

**Q: The application is consuming a lot of disk space.**
A: On every startup, the application automatically purges log and alert records older than 7 days and caps the total log count at 5,000 entries. If disk usage continues to grow, go to the **Notification & JSON** tab and click **Wipe Database Records** to perform a full reset. Export a backup first using **Export Backup JSON**.

**Q: The application crashes or fails to start.**
A: Check that no other instance of the application is already running in the tray (the application enforces a single-instance lock). If the problem persists, the SQLite database file may be corrupted. Navigate to `C:\Users\<Username>\AppData\Roaming\api-monitor-erp\` and rename `api_monitor.db` to `api_monitor.db.bak`. The application will create a fresh database on next start. Restore your configuration using a previously exported backup JSON file.

---
