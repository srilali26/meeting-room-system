# Meeting Room Booking — Windows Server Deployment Guide

This guide walks through deploying the **Meeting Room Booking** web application onto a physical or virtual **Windows Server** (2019, 2022, or 2025) on your company's internal network at **`http://192.168.50.143`**.

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         Internal Corporate LAN           |
                      |            (192.168.50.0/24)             |
                      +--------------------+---------------------+
                                           |
                              HTTP Port 80 | (No Cloud Dependencies)
                                           v
+---------------------------------------------------------------------------------+
| Windows Server 2022 (Fixed IP: 192.168.50.143)                                  |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   | Reverse Proxy: Caddy / Nginx (Port 80)                                  |   |
|   | - Buffering disabled (X-Accel-Buffering: no) for Server-Sent Events     |   |
|   | - Proxies to http://127.0.0.1:3000                                      |   |
|   +------------------------------------+------------------------------------+   |
|                                        |                                        |
|   +------------------------------------v------------------------------------+   |
|   | Next.js App Router (Port 3000)                                          |   |
|   | - Managed via Windows Service (NSSM)                                    |   |
|   | - Timezone: Asia/Dubai (UTC+4)                                          |   |
|   +------------------------------------+------------------------------------+   |
|                                        |                                        |
|   +------------------------------------v------------------------------------+   |
|   | Self-Hosted PostgreSQL 16 (Port 5432)                                   |   |
|   | - btree_gist extension (Database-level exclusion constraint)            |   |
|   | - Nightly automated backups with 14-day retention                       |   |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 1. Prerequisites on Windows Server

1. **Fixed IP Address**: Verify server is configured with static IP `192.168.50.143`.
2. **Node.js LTS (v20+)**: Download and install from [nodejs.org](https://nodejs.org/).
3. **PostgreSQL 16 for Windows**: Download from [enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
4. **NSSM (Non-Sucking Service Manager)**: Download `nssm.exe` from [nssm.cc](https://nssm.cc/) to manage services.
5. **Reverse Proxy (Caddy or Nginx)**: Caddy is strongly recommended for Windows due to its single-binary execution and automatic zero-config reload.

---

## 2. PostgreSQL Configuration

1. Open **Command Prompt** or **psql** as administrator:
   ```cmd
   psql -U postgres
   ```
2. Create the production database and user:
   ```sql
   CREATE USER meeting_admin WITH PASSWORD 'StrongDatabaseSecret2026!';
   CREATE DATABASE meeting_room_db OWNER meeting_admin;
   \c meeting_room_db
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```
3. Run the initialization script:
   ```cmd
   psql -U meeting_admin -d meeting_room_db -f "C:\inetpub\meeting-room-system\sql\init.sql"
   ```

---

## 3. Application Setup

1. Copy the project files to `C:\inetpub\meeting-room-system`.
2. Configure `.env.local`:
   ```ini
   NODE_ENV=production
   PORT=3000
   APP_URL=http://192.168.50.143
   TIMEZONE=Asia/Dubai
   DATABASE_URL=postgresql://meeting_admin:StrongDatabaseSecret2026!@localhost:5432/meeting_room_db
   COOKIE_SECURE=false
   ```
3. Install production dependencies and build:
   ```cmd
   cd C:\inetpub\meeting-room-system
   npm install --omit=dev
   npm run build
   ```
4. Create the initial Receptionist Admin account:
   ```cmd
   npm run create-admin
   ```
   Follow the CLI prompt to set the admin password and 4-digit PIN.

---

## 4. Install as a Windows Service (NSSM)

To ensure the Next.js application automatically boots with Windows and auto-restarts upon failure:

1. Open PowerShell as Administrator.
2. Run:
   ```powershell
   # Install the service
   nssm install MeetingRoomApp "C:\Program Files\nodejs\node.exe" "C:\inetpub\meeting-room-system\node_modules\next\dist\bin\next" "start -p 3000"
   
   # Set the working directory
   nssm set MeetingRoomApp AppDirectory "C:\inetpub\meeting-room-system"
   
   # Configure environment variables
   nssm set MeetingRoomApp AppEnvironmentExtra NODE_ENV=production PORT=3000
   
   # Set restart behavior
   nssm set MeetingRoomApp AppRestartDelay 5000
   
   # Start the service
   nssm start MeetingRoomApp
   ```

---

## 5. Reverse Proxy Configuration (Port 80)

To serve the app cleanly at `http://192.168.50.143` (port 80):

### Option A: Using Caddy (Recommended)
Place the provided `Caddyfile` into `C:\Caddy\Caddyfile` and run Caddy as a service:
```powershell
nssm install CaddyWebServer "C:\Caddy\caddy.exe" "run --config C:\Caddy\Caddyfile"
nssm start CaddyWebServer
```

### Option B: Using Nginx for Windows
Place the provided `nginx.conf` into `C:\nginx\conf\nginx.conf` and start Nginx:
```cmd
cd C:\nginx
start nginx
```

---

## 6. Windows Firewall Rules

Allow internal inbound HTTP traffic on port 80:

```powershell
New-NetFirewallRule -DisplayName "Meeting Room Booking (Port 80)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 80 `
    -RemoteAddress 192.168.50.0/24 `
    -Action Allow
```

---

## 7. Automated Backups & Health Checks

1. **Nightly Database Dump**: Schedule `backup.ps1` in Windows Task Scheduler to run daily at 02:00 AM.
2. **Service Monitoring**: Schedule `check-services.ps1` to run every 10 minutes to verify server health, port 80 availability, and restart services if interrupted.

---

## 8. Verification Checklist

- [ ] Visit `http://192.168.50.143` from any workstation on the network.
- [ ] Visit `http://192.168.50.143/admin` and sign in with the receptionist credentials.
- [ ] Test booking a room from a smartphone connected to internal Wi-Fi.
- [ ] Check wall display screen preview at `http://192.168.50.143/display/11111111-1111-1111-1111-111111111111`.
- [ ] Check health status at `http://192.168.50.143/api/health`.
