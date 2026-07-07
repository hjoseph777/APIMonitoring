# Xerox API Monitor ERP

A lightweight, enterprise-ready desktop application dedicated exclusively to **HTTP/HTTPS API endpoint monitoring**, built using **Electron**, **React**, **Vite**, and **TypeScript**.

Designed specifically to run 24/7 in the system tray, bypassing browser CORS issues to monitor internal ERP API endpoints, database APIs, and intranet-only microservices.

---

## 🚀 Key Features

* **Sleek Compact Window Layout**: Optimized for desktop utility with a compact `750x550` window size.
* **Corporate Xerox Branding**: Features the exact Xerox corporate logo emblem (red rounded square with rotated white star) and custom brand typography.
* **Horizontal Navigation Cockpit**: Reorganized into a clean three-tab layout:
  * **Dashboard (Status Only)**: Minimal StatCards (Total, Online, Offline, Alerts), endpoint status checklist, active alerts feed, and Xerox clipboard copy audit logs.
  * **Reports (Diagnostic Charts)**: Dedicated performance panel containing 10-point response time line charts (inline SVG) and Uptime health gauges.
  * **Settings (Configuration Center)**: Consolidated inputs for adding/removing endpoints, setting custom check intervals, native OS banner toggles, SMTP servers, Discord/Slack webhooks, and JSON data backup exports.
* **24/7 System Tray Operations**: 
  * Minimizes to tray automatically on close to prevent interruption.
  * Dynamically updates tooltips showing outage warnings (e.g. `Xerox API Monitor - Outages: 2 offline`).
  * Features a tray context menu for focusing the app, triggering manual checks, or quitting.
* **Direct Intranet Access**: Bypasses browser sandboxes and CORS limitations, allowing direct HTTP monitoring of local network addresses (`192.168.x.x`), loopbacks (`127.0.0.1`), and intranet servers.
* **Enterprise Authentication Suite**: Supports static API Keys (including onboarding bearer tokens), Windows Auth (NTLM/Kerberos), client certificates (mTLS), session cookies, and OAuth2/JWT token exchange.

---

## 🔍 Monitored Connection & API Errors

The background monitoring engine actively catches, categorizes, and logs over 30 API connection issues, including:
* **Network TCP Failures**: `ECONNREFUSED` (server port closed), `ETIMEDOUT` (connection timeout), `ENOTFOUND` (DNS / VPN disconnected).
* **SSL/TLS Certificate Rejections**: `CERT_HAS_EXPIRED` (expired credentials), `DEPTH_ZERO_SELF_SIGNED_CERT` (self-signed blocks), and mTLS handshake mismatched keys.
* **HTTP Client Errors (4xx)**: `401 Unauthorized` (expired bearer tokens, missing credentials, failed NTLM), `403 Forbidden` (privilege restrictions), and `404 Not Found`.
* **HTTP Server Exceptions (5xx)**: `500 Internal Server Error` (backend crash), `502 Bad Gateway` (proxy down), and `503 Service Unavailable`.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, TypeScript, TailwindCSS (Tokyo Night & Clear themes), Lucide Icons
* **Runtime / Shell**: Electron 28+, `electron-store` (Preferences), `electron-safe-storage` (Credentials encryption)
* **Build System**: `electron-vite`, `vite`
* **Local Database**: `better-sqlite3` (with `electron-store` fallback)
* **HTTP Client**: `axios`, `axios-ntlm`, `axios-cookiejar-support`

---

## 📁 Repository Layout

```text
API_Monitor/
├── electron/
│   ├── main.ts             # Main process setup, Tray loop & IPC Handlers
│   ├── preload.ts          # IPC Secure Context Bridge mapping
│   ├── database.ts         # Database wrapper with SQLite/Store fallback
│   └── monitoring.ts       # 24/7 Background HTTP(S) checking service loop
├── src/
│   ├── components/         # Core UI layouts and dashboards
│   │   ├── ui/             # Reusable UI widgets
│   │   │   ├── Spinner.tsx  # Loading spinner animation
│   │   │   ├── Skeleton.tsx # Loading skeleton block
│   │   │   └── UptimeChart.tsx # SVG response time graph & health gauge
│   │   ├── Layout.tsx      # Top horizontal navbar layout
│   │   ├── StatsCards.tsx  # KPI summary metrics cards
│   │   ├── Dashboard.tsx   # Dashboard status cockpit
│   │   ├── Settings.tsx    # Configuration center (forms, auth, backup)
│   │   ├── Reports.tsx     # Latency graphs mapping page
│   │   └── XeroxLogs.tsx   # Audit clipboard records
│   ├── context/            # React Global Providers
│   │   ├── ToastContext.tsx # Toast Stacking manager Provider
│   │   └── MonitoringContext.tsx # Central Reducer State Provider
│   ├── types/
│   │   └── index.ts        # TypeScript contracts (Endpoint, Auth, Logs)
│   ├── App.tsx             # Application wrapper
│   ├── index.css           # CSS entry, variables, and Tokyo Night themes
│   └── main.tsx            # Renderer entry point
```

---

## 📷 Visual Walkthrough & System Tray States

The following screenshots illustrate the layout and tray behavior options of the application:

### Taskbar Navigation & Default Electron Frame

![Windows Taskbar Jump List](Pictures/Screenshot%202026-07-06%20174303.png)

*Shows the standard Windows OS Jump list for the active taskbar window button.*

### System Tray Icons Caret

![System Tray Icons Caret](Pictures/First_Tray_with_statusScreenshot%202026-07-06%20175134.png)

*The Windows taskbar caret (`^`) where background-monitored tray processes reside.*

### Expanded Tray Applications Pop-up

![Tray Applications Pop-up](Pictures/Screenshot%202026-07-06%20174454.png)

*The expanded Windows notification tray displaying all active background items.*

### Endpoint Authentication Configuration

![Endpoint Authentication Configuration](Pictures/AuthticationTypeScreenshot%202026-07-07%20082104.png)

*The settings panel showing the dropdown list of supported enterprise authentication methods, including API Key, Windows NTLM, mTLS Client Certificate, OAuth2, and Session Cookies.*

### Active Taskbar View

![Active Taskbar View](Pictures/Screenshot%202026-07-06%20174734.png)

*The active Windows taskbar layout showcasing open explorer windows.*

### Tray Context Menu Controls

![Tray Context Menu Controls](Pictures/2nd_Tray_Screenshot%202026-07-06%20175037.png)

*The custom right-click options displayed on the Xerox tray icon, exposing status details and exit controls.*

---

## ⚙️ Development Guide

### Prerequisites
Make sure you have Node.js (v18+) installed.

### Setup and Installation
1. Install project dependencies:
   ```bash
   npm install
   ```

2. Start the hot-reloading development environment:
   ```bash
   npm run dev
   ```

3. Compile and build the production bundles:
   ```bash
   npm run compile
   ```
