# Meeting Room Booking System

A production-ready, self-hosted web application built for internal network deployment on **Windows Server** at **`http://192.168.50.143`** (HTTP Port 80). 

Designed with zero cloud dependencies (no Supabase, Vercel, Firebase, or cloud SaaS). Strictly titled **"Meeting Room Booking"** with no company names or logos.

---

## Architecture & Technology Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Database**: PostgreSQL 16 (with `btree_gist` extension for database-level exclusion constraint `23P01`)
- **Realtime**: Server-Sent Events (SSE) with Postgres `LISTEN/NOTIFY` (sub-second broadcast to all open screens)
- **Timezone**: `Asia/Dubai (UTC+4)` — stored in UTC, converted for display
- **Security**: Single Receptionist Admin account created via CLI (`npm run create-admin`), brute-force lockout (5 failed attempts = 15-minute lock), and 15-minute inactivity quick PIN unlock (`1234`)
- **Reverse Proxy**: Caddy / Nginx on Port 80 with unbuffered SSE flushing
- **Process Manager**: NSSM (Non-Sucking Service Manager) running Next.js as a persistent Windows Service

---

## Features

1. **Employee Booking Flow (Zero-Login, Mobile-First)**:
   - Scan physical QR sign outside any room -> lands on `http://192.168.50.143/room/{roomId}`.
   - Dynamic status banner: "Available now" or "Occupied until HH:MM, free from HH:MM".
   - 08:00 to 20:00 Dubai vertical timeline with a live pulsing "now" line.
   - Tap free slot -> slide-up booking sheet prefilled with times.
   - Database-enforced overlap rejection: *"This slot was just taken, please pick another."*
   - Secret cancellation token link (`/booking/cancel?token=...`) allows employees to cancel without an account.
   - 30-day advance date picker.

2. **Wall-Mounted Tablet Displays (`/display/{roomId}`)**:
   - Deep navy corporate theme (`#0B1F3A`), giant status banner, digital clock, next 3 upcoming meetings, and 300px QR code.
   - HTML5 Wake Lock API prevents tablet screen sleep.
   - Daily 03:00 AM automatic reload prevents memory leaks.
   - 45-second heartbeat reports health to the Receptionist Console.

3. **Reception Lobby Board (`/display/lobby`)**:
   - High-contrast overview board showing all 5 rooms (`Meeting Room 1` to `Meeting Room 5`) and the general directory QR.

4. **Receptionist Admin Console (`/admin`)**:
   - Dashboard KPIs (Utilization %, Hours Booked Today, Active Rooms).
   - Side-by-side multi-room daily timeline comparison.
   - Bookings manager (edit, move, cancel, book-on-behalf).
   - Room facilities manager (capacity, floor, amenities, deactivation/reactivation).
   - Blocked slots manager (single, date range, or recurring Friday prayer 12:00–14:00).
   - Display screens manager (IP tracking, online status, remote reload command).
   - QR signs manager (preview, PNG/SVG download, printable A4 sign).
   - Security audit trail and system settings.

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Build the Next.js bundle
npm run build

# 3. Create the receptionist admin credentials
npm run create-admin

# 4. Start the server
npm run dev # or npm run start:local for production mode on port 3000
```

---

## Windows Server Deployment (`http://192.168.50.143`)

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions, or run the automated installer:

```powershell
# Open PowerShell as Administrator
Set-Location "C:\inetpub\meeting-room-system"
.\install.ps1
```

---

## License

Private Internal Use Only.
