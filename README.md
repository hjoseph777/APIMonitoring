# Xerox API Monitor ERP Desktop

<div align="center">
  <img src="resources/icon.svg" width="128" height="128" alt="API Monitor ERP Logo">
</div>

| | |
|---|---|
| **Author** | Harry Joseph |
| **Version** | 1.2.0 |
| **Date** | July 9, 2026 |
| **Platform** | Windows (Electron Desktop App) |

A lightweight, enterprise-ready desktop application dedicated exclusively to **HTTP/HTTPS API endpoint monitoring**, built using **Electron**, **React**, **Vite**, **TypeScript**, and **Zustand**.

Designed specifically to run 24/7 in the system tray, bypassing browser CORS issues to monitor internal ERP API endpoints, database APIs, and intranet-only microservices.

### Who Is This For?

| Role | Value Delivered |
|---|---|
| **IT Operations** | Instant visibility when an internal ERP service, database API, or intranet microservice goes silent |
| **System Administrators** | 24/7 background monitoring with email + Teams/Discord alerts — no cloud dependency, no subscription |
| **Integration Engineers** | Validate OAuth2 tokens, NTLM handshakes, client certificates, and session cookies before they break production |
| **Compliance Teams** | Automatic weekly CSV log exports and a 7-day audit trail stored in a local encrypted SQLite database |

> **Key advantage over browser-based tools**: this application runs natively on Windows, meaning it can reach `127.0.0.1`, `192.168.x.x`, and domain-authenticated intranet endpoints that no SaaS monitoring product can touch.

---

## 🚀 Key Features

* **Sleek Compact Window Layout**: Optimized for desktop utility with a compact `750x550` window size.
* **Corporate Xerox Branding**: Features the exact Xerox corporate logo emblem (red rounded square with rotated white star) and custom brand typography.
* **Horizontal Navigation Cockpit**: Reorganized into a clean three-tab layout:
  * **Dashboard (Status Only)**: Minimal StatCards (Total, Online, Offline, Alerts), endpoint status checklist, active alerts feed, and Xerox clipboard copy audit logs.
  * **Reports (Diagnostic Charts)**: Dedicated performance panel containing 10-point response time line charts (inline SVG) and Uptime health gauges.
  * **Settings (Configuration Center)**: Consolidated inputs for adding/removing endpoints, setting custom check intervals, native OS banner toggles, real universal SMTP engine configuration (Host, Port, User, Pass) with connection testing, Discord/Slack webhooks, and JSON data backup exports.
* **24/7 System Tray Operations**: 
  * Minimizes to tray automatically on close to prevent interruption.
  * Dynamically updates tooltips showing outage warnings (e.g. `Xerox API Monitor - Outages: 2 offline`).
  * Features a tray context menu for focusing the app, triggering manual checks, or quitting.
* **Direct Intranet Access**: Bypasses browser sandboxes and CORS limitations, allowing direct HTTP monitoring of local network addresses (`192.168.x.x`), loopbacks (`127.0.0.1`), and intranet servers.
* **Enterprise Authentication Suite**: Full active support for static API Keys (header/query), authentic Windows Auth (NTLM challenges via `axios-ntlm`), client certificates (mTLS), session cookies (automated cookie jar-based multi-step login flows), and OAuth2 Client Credentials (with token caching). Each endpoint independently controls whether to accept self-signed/internal TLS certificates via a dedicated per-endpoint toggle, defaulting to **verified SSL** (secure by default).
* **Pre-Save Connection Test**: Direct credential validation option inside the Add Endpoint form to verify settings before storing.
* **Parallel Endpoint Execution**: The tray “Check All Endpoints Now” action runs all checks concurrently with `Promise.all` — network timeouts on faulty APIs never block other checks or stall the tray.
* **Demonstration Tools**: Embedded 1-click seeding utilities inside the Settings tab to inject live mock endpoints (healthy or mixed) to instantly test the UI and SMTP/Webhook alert dispatchers.
* **Automated Log Rotation**: In-database cleanup policy purging transaction histories and alerts older than 7 days on startup to limit SQLite disk space usage.

---

## 🛡️ Reliability & Security Architecture

The application implements several advanced architectural patterns to ensure enterprise-grade monitoring stability:

* **Strict Single-Instance Singleton**: Enforces a global OS-level single-instance lock to ensure only one background monitor runs at a time, preventing duplicated tray icons, duplicated alerts, and concurrent SQLite corruption.
* **Event-Driven Zero-Poll (Tray + UI)**: Tray updates fire on `MonitoringService.onStateChange` events; the renderer synchronises via IPC push — when nothing changes, idle CPU and disk I/O drop to absolute zero.
* **Race-Condition-Free Self-Scheduling Loop**: The monitoring engine uses a recursive `setTimeout` pattern — a subsequent check is only queued *after* the previous request fully settles, guaranteeing accurate latency logs and preventing server overload.
* **Parallel Endpoint Execution**: Tray-triggered “Check All Endpoints” runs all checks concurrently with `Promise.all` — a timeout on one faulty endpoint never blocks the rest.
* **Secure-by-Default TLS Verification**: SSL certificate validation is **enabled by default** for all endpoints. Intranet servers with self-signed certificates can individually opt-in via the per-endpoint “Accept self-signed / internal TLS certificates” toggle, preventing global SSL bypass.
* **Stateful Enterprise Authentication**:
  * **OAuth2 Client Credentials**: Automatic bearer token retrieval, caching, and pre-expiry refresh.
  * **Session Cookie Authentication**: Cookie jar-based client with 30-minute session cache — login re-executes only on expiry or 401/403.
  * **Windows Auth (NTLM)**: Authentic challenge-response handshakes via `axios-ntlm`.
* **Universal Email Notifications**: Native `nodemailer` SMTP engine supports any mail server (Gmail, Outlook, corporate relay) with custom ports, credentials, and a live “Test Email” IPC trigger.
* **In-Flight Request Deduplication**: Identical concurrent requests coalesced via a Promise cache, preventing redundant network traffic and SQLite contention.
* **Zero-Collision Cryptographic IDs**: `crypto.randomUUID()` used throughout — no `Date.now()` identifiers.
* **Strict Data Validation & Bounded Queries**: Backup imports structurally validated with URL parsing; database queries hard-capped at `LIMIT 500`.
* **High-Performance Singletons**: Core services instantiated once at module level, eliminating GC spikes in hot monitoring loops.

---

## 🔒 Security & Reliability — v1.2.0 Enterprise Gold Standard

v1.2.0 completes a full server-hardening audit covering every background code path, security surface, and UI control in the application. All 17 audit items were resolved. The audit was conducted under a **server-first lens**: a 24/7 background process where memory leaks and network vulnerabilities are catastrophic.

### Hardening Completed in v1.2.0

| Area | Protection Applied |
|---|---|
| **SMTP Credential Encryption** | Passwords encrypted at rest via Windows DPAPI (`safeStorage`) — never plaintext in `config.json`. Legacy entries auto-migrated on first launch. |
| **Webhook SSRF Guard** | Outbound webhook URLs validated before every POST. Non-HTTPS, loopback, and RFC-1918 private ranges blocked. |
| **mTLS Server Certificate Validation** | `rejectUnauthorized` inversion bug fixed in both `checkEndpoint` and `testConnection` — server TLS verification enforced by default on all certificate-auth paths. |
| **Certificate Passphrase Validation** | `validate-certificate` IPC calls `tls.createSecureContext()` with the actual passphrase — wrong passphrase or corrupt PFX caught at test time, not silently at runtime. |
| **Log Rotation Guarantee** | `clearLogs()` deletes all log record types, preventing unbounded SQLite growth over weeks of continuous background operation. |
| **Alert Burst Protection** | 60-second debounce buffer on both webhook and email channels — a mass-outage affecting 20 endpoints fires one batched message, not 20. |
| **Test Session Memory Safety** | `testConnection()` uses `try/finally` to always evict `'test-temp'` entries from `cookieJars` and `oauth2Cache` — no indefinite Map growth from repeated test clicks. |
| **Configurable Alert Threshold** | Consecutive-failure threshold wired end-to-end from Settings to the monitoring engine — read from the store at runtime, no restart required. |
| **SMTP TLS for Private-CA Relays** | *Allow self-signed / untrusted SMTP certificates* toggle — passes `tls: { rejectUnauthorized: false }` to nodemailer for corporate relays with internal CA certificates. Default is strict. |
| **Dashboard Monitor Feed** | Real-time API monitoring events (`success`/`error`) surface in the Dashboard quick-feed. |
| **Full Settings Persistence** | `minimizeTray`, `autoStart`, `alertThreshold`, `smtpAllowSelfSigned` all load from and persist to the backend on every save. |
| **Clean Type System** | `Log.type` renamed from `'xerox'` to `'clipboard'`; dead `authStatus` field removed from `Endpoint` type. |

---

## 💾 Database & Storage Paths
Because this application runs securely on your machine, no external databases are required. All endpoints, logs, and alerts are centralized in an isolated `AppData` folder on your machine:
* **Database**: `C:\Users\<Username>\AppData\Roaming\api-monitor-erp\api_monitor.db`
* **Settings**: `C:\Users\<Username>\AppData\Roaming\api-monitor-erp\config.json`

You can back up these files directly, or use the **Export Backup JSON** button inside the GUI to download everything instantly.

### Automated Log Exporting
For compliance purposes, you can enable **Weekly Auto-Export** in the settings. When enabled, the background service will automatically export a CSV file of all transaction logs to your specified directory every 7 days. This feature is fully disabled by default.

### Demo Data Injection
To test the application without real endpoints, you can manually inject mock endpoints by navigating to the Settings tab and using the **Seed Demo Data** button. This demo data is strictly manual and will not automatically reappear on startup once cleared.

---

## 🛠️ Enterprise Operations

### Launch at System Startup
To ensure 24/7 background monitoring without manual intervention, go to **Notification & JSON** settings and enable **Launch at System Startup**. The application will automatically boot directly to the system tray when Windows starts.

### Enable Electron Seamless Auto-Updates
When this is enabled, the background service will periodically check GitHub for new versions of the application. If a new release is found, it will automatically download and install it in the background to ensure your team is always running the latest patches.

### Maintenance Mode (Global Pause)
During planned ERP downtime or network upgrades, you can toggle **Enable Maintenance Mode** in the settings. This instantly pauses all outbound HTTP requests and alert notifications while keeping the application running. The system tray icon will turn grey to indicate it is sleeping.

---

## 🔍 Monitored Connection & API Errors

The background monitoring engine actively catches, categorizes, and logs over 30 API connection issues, including:
* **Network TCP Failures**: `ECONNREFUSED` (server port closed), `ETIMEDOUT` (connection timeout), `ENOTFOUND` (DNS / VPN disconnected).
* **SSL/TLS Certificate Rejections**: `CERT_HAS_EXPIRED` (expired credentials), `DEPTH_ZERO_SELF_SIGNED_CERT` (self-signed blocks), and mTLS handshake mismatched keys.
* **HTTP Client Errors (4xx)**: `401 Unauthorized` (expired bearer tokens, missing credentials, failed NTLM), `403 Forbidden` (privilege restrictions), and `404 Not Found`.
* **HTTP Server Exceptions (5xx)**: `500 Internal Server Error` (backend crash), `502 Bad Gateway` (proxy down), and `503 Service Unavailable`.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, TypeScript, TailwindCSS (Tokyo Night & Clear themes), Zustand (Atomic Store), Lucide Icons
* **Runtime / Shell**: Electron 28+, `electron-store` (Preferences), `safeStorage` / Windows DPAPI (Credential encryption), `electron-updater` (Auto-updates)
* **Build System**: `electron-vite`, `electron-builder` (NSIS Windows installer)
* **Local Database**: `better-sqlite3` (with `electron-store` fallback)
* **HTTP Client**: `axios`, `axios-ntlm`, `axios-cookiejar-support`, `tough-cookie`
* **Notifications**: `nodemailer` (SMTP email), Webhook POST (Discord / Slack / custom HTTPS)

### Why Zustand?
Zustand is utilized as our global atomic store to completely decouple state updates from the React component tree hierarchy. Since our UI rapidly syncs with the background monitoring engine via IPC (Inter-Process Communication) to capture real-time latency changes, using a traditional React Context provider would cause the entire application to constantly re-render, creating noticeable UI lag. Zustand allows our latency charts and status badges to subscribe specifically to atomic state slices, maintaining a lightning-fast UI regardless of the configured ping intervals or background polling volume.

---

## 📁 Repository Layout

```text
API_Monitor/
├── electron/
│   ├── main.ts             # Main process entry, auto-updater, tray loop & IPC handlers
│   ├── preload.ts          # Secure context bridge mapping exposed to the renderer
│   ├── database.ts         # SQLite wrapper, log rotation & credential encryption
│   └── monitoring.ts       # 24/7 background engine, deduplication cache & alerts
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   └── UptimeChart.tsx  # SVG latency sparkline & health gauge
│   │   ├── auth/
│   │   │   └── AuthConfigurator.tsx # Multi-Auth method selector and credentials UI
│   │   ├── Layout.tsx           # App shell — sidebar nav & header bar
│   │   ├── Dashboard.tsx        # Status cockpit with stats, endpoint list, feeds
│   │   ├── Settings.tsx         # Endpoint registry and core database config
│   │   ├── AddEndpointForm.tsx  # New endpoint creation form with connection test
│   │   ├── Reports.tsx          # Per-endpoint latency chart report page
│   │   └── NotificationJson.tsx # Enterprise Settings (Auto-start, Updates, Maintenance), SMTP, Webhooks
│   ├── store/
│   │   └── monitoringStore.ts    # Global Zustand atomic store synced from Electron main
│   ├── context/
│   │   └── ToastContext.tsx      # Toast notification provider and display logic
│   ├── types/
│   │   └── index.ts             # Shared TypeScript types (Endpoint, Alert, Log, AuthConfig)
│   ├── App.tsx                  # Root component and tab router
│   ├── index.css                # CSS variables, theme tokens, and global utilities
│   └── main.tsx                 # Renderer process entry point
```

---

## 📷 Visual Walkthrough

### Dashboard — Status Cockpit


*Real-time monitoring dashboard showing stat cards (Total Monitored, Online Services, Offline Failures, Active Alerts), the Endpoint Status Cockpit with per-endpoint latency sparklines and individual Check buttons, the Active Alerts Feed with Acknowledge controls, and the Recent Monitor Activity log.*

### Endpoint Registry


*The Endpoint Registry tab listing all registered endpoints with their authentication badge (OAuth2, NTLM, Basic, None), last-check timestamps, and edit/delete controls. The Background Engine panel below configures the consecutive-failure alert threshold and tray/autostart behaviour.*

### Add New Endpoint — Authentication Method Selector


*The Add New Endpoint form with the Authentication Method dropdown expanded, showing all seven supported auth methods: None (Public Endpoint), API Key Header/Query, Windows Domain (NTLM), Client Certificate (mTLS), OAuth2 Client Credentials, Basic Credentials, and Session Cookie Authentication. The per-endpoint self-signed TLS toggle and Test Connection button are visible at the bottom.*

### Notification & JSON — Alert Delivery


*The Notification & JSON tab configured with a live SMTP relay (host, port, username, masked password), the Allow self-signed SMTP certificates toggle for private-CA mail relays, recipient alert emails, a Teams/Office 365 webhook channel, native OS toast toggle, Maintenance Mode switch, Weekly Auto-Export, and the Backup & Data / Danger Zone panels below.*

### Reports — Per-Endpoint Latency Charts


*The Reports tab displaying per-endpoint latency trace charts with 10-point sparklines (PEAK ms annotated), Current Status badges (Reachable / Unreachable), and an Export CSV button. Endpoints monitored with OAuth2, NTLM, and unauthenticated methods are shown side-by-side with live fleet health and average response statistics in the header.*
