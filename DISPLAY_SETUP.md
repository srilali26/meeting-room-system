# Meeting Room Booking — Display Screens & Media Players Setup Guide

This document describes how to configure wall-mounted tablets, commercial displays, and media players outside each meeting room and in the reception lobby.

---

## 1. Permanent Display URLs

Each meeting room and facility has a dedicated, permanent display URL:

| Facility | Display Route | Recommended Resolution |
| :--- | :--- | :--- |
| **Meeting Room 1** | `http://192.168.50.143/display/11111111-1111-1111-1111-111111111111` | 1080p Landscape (16:9) |
| **Meeting Room 2** | `http://192.168.50.143/display/22222222-2222-2222-2222-222222222222` | 1080p Landscape (16:9) |
| **Meeting Room 3** | `http://192.168.50.143/display/33333333-3333-3333-3333-333333333333` | 1080p Portrait (9:16) |
| **Meeting Room 4** | `http://192.168.50.143/display/44444444-4444-4444-4444-444444444444` | 1080p Landscape (16:9) |
| **Meeting Room 5** | `http://192.168.50.143/display/55555555-5555-5555-5555-555555555555` | 1080p Landscape (16:9) |
| **Reception Lobby Board** | `http://192.168.50.143/display/lobby` | 4K / 1080p Landscape (16:9) |
| **Diagnostic Test Page** | `http://192.168.50.143/display-test` | Any screen size |

---

## 2. Hardware Recommendations

1. **Tablets outside meeting rooms**:
   - 10.1" to 15.6" PoE (Power over Ethernet) Android commercial room booking panels (e.g., Qbic, ProDVX, or Samsung Galaxy Tab A9+ with PoE wall mount).
   - Alternatively: Windows Mini PC (Intel N100) mounted behind a commercial monitor.
2. **Reception Lobby Display**:
   - 55" to 65" 4K commercial display connected to a Windows Mini PC or Raspberry Pi 4/5.

---

## 3. Device & OS Settings

Ensure the following system-level settings are enabled on every media player:
- **Display Sleep**: Set to **Never** (turn off screen timeout, energy saving, and ambient mode).
- **Screensaver**: Disabled.
- **Auto-Boot / AC Recovery**: Enable "Power On after Power Loss" in the device BIOS.
- **Auto-Login**: Configure the OS to automatically sign in without prompting for a password.
- **Screen Orientation**: Set to Landscape (or Portrait for vertical tablet mounts).

---

## 4. Setup on Windows Mini PC

1. Save the provided `kiosk-windows.bat` to `C:\MeetingRoomKiosk\kiosk.bat`.
2. Configure your target room ID inside the `.bat` file:
   ```cmd
   set ROOM_ID=11111111-1111-1111-1111-111111111111
   ```
3. Add a shortcut to `kiosk.bat` in the Windows Startup folder:
   - Press `Win + R`, type `shell:startup`, and press Enter.
   - Paste the shortcut into this folder.
4. On reboot, Microsoft Edge will automatically launch in full-screen kiosk mode with crash auto-recovery.

---

## 5. Setup on Android / Android TV

1. Install **Fully Kiosk Browser** (recommended) or any dedicated Android kiosk launcher.
2. Set **Start URL** to:
   ```
   http://192.168.50.143/display/11111111-1111-1111-1111-111111111111
   ```
3. Enable the following settings in Fully Kiosk:
   - **Kiosk Mode**: Enabled (locks status bar and navigation keys).
   - **Keep Screen On**: Always on (using Wake Lock).
   - **Auto-Restart on Crash**: Enabled.
   - **Daily Reload**: Scheduled at 03:00 AM.
   - **Reload on Network Reconnect**: Enabled.

---

## 6. Setup on Raspberry Pi / Linux

1. Install Raspberry Pi OS (with Desktop) or Ubuntu.
2. Copy `kiosk-linux.service` to `/etc/systemd/system/kiosk.service`.
3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kiosk.service
   sudo systemctl start kiosk.service
   ```

---

## 7. Built-in Reliability & Monitoring Features

- **Real-Time Push**: Updates appear within 1 second via Server-Sent Events (SSE).
- **Fallback Polling**: If the SSE connection drops, the display automatically polls `/api/rooms/{id}` every 30 seconds.
- **Daily 03:00 AM Auto-Refresh**: Flushes browser memory and prevents long-term rendering leaks.
- **Remote Reload**: Receptionist can trigger an instant remote browser reload from the Admin Console under the **Display Screens** tab.
- **Screen Heartbeat**: Devices report back to the server every 45 seconds to maintain online health status.
