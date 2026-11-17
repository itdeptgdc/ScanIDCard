<<<<<<< HEAD
# Poipet Resort & Casino — Scan ID & Attendance

Next.js · Node.js/Express · PostgreSQL · Docker. Thai UI by default (English switchable).
It replaces the Google Apps Script + Google Sheets version, which was too slow for the scan queue.

## Quick start

```powershell
copy .env.example .env      # then edit secrets
docker compose up -d --build
```

Open **http://localhost:3000** and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default `admin` / `admin1234`).
Change the password straight away under **ผู้ใช้งาน / Users**.

### Start / stop / update

| Task | Command (PowerShell, in `E:\ScanIDCard`) |
|---|---|
| Start (also launches Docker Desktop if it is closed) | `.\start.ps1` |
| Start after changing code | `.\start.ps1 -Build` |
| Stop (data is kept) | `docker compose stop` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api` |

Data lives in the Docker volume `scanid_pgdata` and survives stop/restart. **Never run `docker compose down -v`**, because it deletes the database.
Containers use `restart: unless-stopped`: if Docker Desktop starts automatically (Settings → General → "Start Docker Desktop when you sign in"), the system comes back by itself after a server reboot.

### Viewing the database

PostgreSQL runs in the `db` container; its files live in the Docker volume `scanid_pgdata`.

* **Browser (Adminer)**: open http://localhost:8080 on this server. Choose System **PostgreSQL**, Server `db`, and enter the `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` values from `.env` (default `scanid` / `scanid` / `scanid`).
* **Command line**: `docker compose exec db psql -U scanid -d scanid`, then `\dt` lists tables and `SELECT * FROM staff LIMIT 10;` shows rows (`\q` to quit).
* **Backup**: `docker compose exec -T db pg_dump -U scanid scanid > backup.sql`

Tables: `staff`, `staff_photos`, `attendance` (one row per person per day), `users`, `scan_logs`.

| Page | Who | What |
|---|---|---|
| `/scan` | all roles | Scanning kiosk: card reader, camera QR, typed ID |
| `/dashboard/staff` | admin, HR | Staff, card types, photos, card preview/print, Excel / PDF export |
| `/dashboard/attendance` | admin, HR | Daily check-in/out, Excel (CSV) export |
| `/dashboard/users` | admin | Users and roles (Admin / HR / Checker) |
| `/dashboard/logs` | admin | Security log of rejected scans |

## How scanning is verified

Each staff record has an **ID number** (printed) and an optional **card number** (the number the card reader reads: RFID, magstripe or barcode).

| What is scanned | How it is checked | Shown as |
|---|---|---|
| QR printed on the card: `PRC1.<ID>.<signature>` | HMAC-SHA256 signature over **ID number + current card number**. A hand-made QR fails. An old card fails after re-issue. | ยืนยันรหัส + บัตร |
| Card reader (card number only) | Exact lookup by card number | ยืนยันด้วยหมายเลขบัตร |
| Typed ID / old plain-ID QR | Exact lookup by ID number. Set `ALLOW_ID_ONLY_SCAN=false` to turn this off. | ยืนยันด้วยรหัสพนักงาน |

After a card is found it is rejected if it is **Locked**, **Blocked** or **expired**. Every rejection goes to the scan log.
A card number may not equal another person's ID number, so a scan can never match two people.
The QR does not contain the card number, so photographing the QR does not reveal it.

**Scan windows** (app time zone, set in `.env`):
- `CHECKIN_START`–`CHECKIN_END` (default 04:30–16:30): the first scan records check-in; later scans are duplicates.
- `CHECKOUT_START`–`CHECKOUT_END` (default 16:35–04:00 next day): a scan records check-out (the latest one is kept;
  a repeat within `SCAN_MIN_GAP_SECONDS` is a duplicate). Check-out also works if the person forgot to check in.
- Any other time: rejected as `OUTSIDE_HOURS`.

The work day starts at `CHECKIN_START`, so a check-out after midnight stays on the same record.
If you change the windows, also update the `err.OUTSIDE_HOURS` text in `web/lib/i18n.js`.

### Card readers
USB card readers and USB QR guns act as keyboards. The scan page keeps its input focused, so staff just tap the card.
The page tells a reader from a person typing by keystroke speed, and records the method (`reader` / `camera` / `manual`).

### Camera on kiosk PCs (HTTPS)
Browsers only allow the camera on **HTTPS or localhost**, so kiosks must open **https://192.168.55.88/scan**
(the `caddy` service provides HTTPS on ports 80/443; `SERVER_IP` / `SERVER_NAME` in `.env`).

1. Once on the server (admin PowerShell), allow LAN access:
   `New-NetFirewallRule -DisplayName "Poipet ScanID" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow`
2. On each kiosk PC, trust the local certificate once (removes the browser warning):
   download **http://192.168.55.88/ca.crt**, then in admin PowerShell:
   `Import-Certificate -FilePath "$env:USERPROFILE\Downloads\PoipetScanID-CA.crt" -CertStoreLocation Cert:\LocalMachine\Root`
   and restart the browser. (Without this step, use "Advanced → Proceed": the camera still works, but the warning shows.)
3. Open https://192.168.55.88/scan, press **Start camera** and allow the camera. The kiosk remembers this and starts the camera automatically next time.

If the camera is busy (Teams/Zoom), unplugged, or blocked, the page shows the reason and a Retry button, and reconnects by itself after an unplug.
Several cameras: choose one under the camera button.

### Scan result screen and voice
Each scan shows a full-screen result with the person's ID card, in Thai and English, with check-in/out times.
A beep plus a voice announcement plays, Thai first and then English (speaker button in the header toggles it).

* The voice is a set of **pre-recorded clips** in `web/public/sounds/{th,en}/`, so kiosk PCs need no installed voice.
  They are peak-normalised and boosted through a limiter for maximum loudness. Also set the kiosk's Windows volume to 100%.
* To change the phrases, edit `tools/make-voice.ps1` and run it on the server
  (`powershell -ExecutionPolicy Bypass -File tools\make-voice.ps1`; it uses the Windows Thai voice "Pattara"), then `.\start.ps1 -Build`.
  You can also drop in your own recorded `.wav` files with the same names.
* Browsers block sound until someone touches the page once. The scan page shows **"แตะเพื่อเปิดเสียง / Tap to enable sound"** until then; the first card-reader tap also unlocks it.
  For an unattended kiosk, start Chrome with: `chrome.exe --kiosk --autoplay-policy=no-user-gesture-required https://192.168.55.88/scan`

### Existing cards with URL QR codes
Old cards carry QR codes such as `https://qr.poipetresort.net/r/HMVQLM4LHQ39`. The scanner takes the code at the end of the URL (`HMVQLM4LHQ39`, or `?id=` / `?code=` values).
Enter that code as the person's **card number**, and the old card works without reprinting.

## Why it is fast

* **In-memory index**: every API instance holds all staff in hash maps keyed by ID number and card number. A lookup is a few microseconds, with no database call.
  Postgres `LISTEN/NOTIFY` (a trigger on `staff`) keeps every instance in sync on each edit.
* **One SQL statement per scan**: a prepared `INSERT … ON CONFLICT (staff_id, work_date) DO UPDATE` decides check-in or check-out in a single round trip.
* **Audit log is batched** (once per second), never on the scan's critical path.
* Unique indexes on `id_number` and `card_number`; trigram indexes for admin search; photos in a separate table.

Measured on this 2-CPU server, with **100,000 staff** loaded and the load generator on the same machine:

| Scenario | Result |
|---|---|
| 1 gate, sequential | p50 **4.3 ms**, p99 16 ms |
| 10 gates at the same time | p50 31 ms, ~280 scans/s |
| 50 gates at the same time | ~300–390 scans/s, 0 errors |
| CSV import of 100,000 staff | 13.5 s |

For scale: 100,000 people within one hour is about 28 scans per second.

## Exporting staff

**Export Excel** and **Download PDF** on the staff page open a column picker and export the records matching the current search / card-type filter.

## Customising

* **Logo**: `web/public/logo.png` (transparent) and `web/public/favicon.png`; path set in `web/components/Logo.js`.
* **Khmer text on house cards**: `KHMER_BRAND` in `web/lib/cardTypes.js`.
* **Texts / translations**: `web/lib/i18n.js` (add another language by adding a dictionary).
* **Card artwork**: `web/components/IdCard.js` and the `ID cards` section of `web/app/globals.css`. Printing targets CR80 (54 × 86 mm).

## Configuration (`.env`)

See `.env.example`. Before going live, set `POSTGRES_PASSWORD`, `JWT_SECRET` and `QR_SECRET` to long random values.
Changing `QR_SECRET` later invalidates every printed QR; card readers and ID numbers keep working.

## Development without Docker

```bash
cd api && npm install && DATABASE_URL=postgres://... npm run dev
cd web && npm install && API_INTERNAL_URL=http://localhost:4000 npm run dev
```
=======
# ScanIDCard
>>>>>>> 08e28dc3c96d35cd287ade08187556b6f4b35a05
