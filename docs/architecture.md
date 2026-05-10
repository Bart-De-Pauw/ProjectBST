## Bowling Competition Manager — Technical Architecture

### Goals
- Usable on **laptop and mobile** (responsive UI).
- Hosted **LAN-only** initially on a **Raspberry Pi** running a **Docker Compose** stack.
- Public **read-only viewing** (leaderboards + live match dashboards) on the LAN.
- Authenticated flows for **players/captains/president**.
- Manual **email digest** sent by the president via **Gmail API** (OAuth2).
- Accurate scoring workflow with:
  - **3 games per evening**
  - Scratch scores stored as raw pins
  - Handicap fixed for the entire evening
  - Match approval and event finalization/reopen governance
  - Live standings incrementally updated game-by-game, with “pending points” when data is missing

---

### High-level system diagram

- **Clients (LAN)**
  - Mobile browsers
  - Laptop browsers

→ **Reverse proxy (optional, recommended)**
- Routes `/api/*` to backend
- Routes `/*` to frontend static site
- Enables easy future HTTPS and future remote access

→ **Backend API (Go)**
- Auth, authorization, scoring logic, leaderboards, email sending
- Computes live/provisional views and persists official results at finalization

→ **Database (PostgreSQL)**
- Source of truth for seasons, schedules, rosters, raw scores, approvals
- Stores official persisted match results and email logs

---

### Deployment (Raspberry Pi, LAN-only)

#### Docker Compose services
- **web**: React build served as static assets (e.g., Nginx)
- **api**: Go backend (REST API)
- **db**: PostgreSQL with persistent volume
- **proxy (optional)**: Caddy/Traefik/Nginx for routing

#### Networking rules
- Expose only the proxy (or web+api) on the LAN.
- Keep PostgreSQL **internal** to the Docker network (no LAN port exposure).
- Give the Pi a stable name/IP (DHCP reservation) and a friendly hostname:
  - Example: `http://bowling.local`

#### Storage & durability
- Prefer SSD over microSD for PostgreSQL storage.
- Nightly backups (e.g., `pg_dump`) to off-device storage (NAS/USB).

---

### Frontend (React)

#### Public (no login) — LAN-only
- Live leaderboards (provisional)
- Official leaderboards (finalized only)
- Live match dashboards:
  - Shows “Game X/3 entered” and missing players/scores
  - Shows “pending” points when opponent data is missing

#### Authenticated
- **Player**
  - Login (username + password)
  - Profile: email opt-in/out for mailings
- **Captain**
  - Enter/edit scores for **their own team only** before event finalization
  - Approve match results for their team (sign-off)
- **President**
  - Season setup (teams/players participation)
  - Schedule/calendar (matches + lane assignment per event)
  - Override approval (with reason)
  - Finalize/reopen events
  - Send digest email (manual, deduped by email)

#### UX requirements for live vs official
- Always label live standings as:
  - **“Live / Unfinalized — may change until finalization”**
- Provide toggle:
  - **Live** (finalized + current unfinalized event)
  - **Official** (finalized events only)

---

### Backend (Go REST API)

#### Authentication & authorization
- Login by **Username + Password**
- Passwords stored as **bcrypt hashes** (never reversible encryption)
- Roles:
  - Player
  - Captain
  - President

#### Permission rules
- Captains can create/edit scores for their own team’s players **until event is finalized**.
- Any score edit triggers **auto-unapprove** for that team’s match approval.
- President can:
  - Override approvals (must provide a reason)
  - Finalize/reopen events
  - Send email digests

#### Live scoring computation rules
- Live standings update incrementally **game-by-game**.
- **Do not award points** for any comparison until **both sides** have the required data.
  - Example: Slot 2 Game 2 remains **pending** until both teams’ slot 2 game 2 scores exist.

#### Finalization / reopening
- President finalizes an event:
  - Locks editing
  - Persists official results as versioned `MatchResult` records
- President can reopen (explicit action) to allow edits:
  - Reopen → edits allowed → re-finalize → new `MatchResult` version
- Correction email is a **manual resend** after re-finalization.

---

### Database (PostgreSQL) — key concepts

#### Core scheduling model
- **Season** contains **Events (evenings)**
- Each Event has **Matches**
  - Match includes Team A vs Team B and a **LaneNumber**
  - Lane assignments can rotate per event

#### Raw scoring model
- Store scratch scores as raw pins (per game)
- Store handicap used that evening (`HdcpAtEvent`) with the score rows, since it is fixed for the evening

#### Official results model
- Persist `MatchResult` at event finalization (versioned)
- Official leaderboards aggregate from persisted results
- Live leaderboards compute from raw score rows for the current unfinalized event + official history

#### Match approvals
- Each match requires captain approval for each team
- Score edits auto-revoke approval for that team
- President override is allowed with a required reason + audit trail

#### Email
- Each player has:
  - Email (not unique)
  - Opt-in/out (per player)
- When sending:
  - Group recipients by email and send **one email per address**
  - Include which opted-in players are associated with that mailbox
- Store `EmailLog` to prevent accidental duplicate sends per event/version/email

---

### Email digest (manual, Gmail API)

#### Sending rules
- Only President can send.
- Only allow sending for a finalized event/version.
- Compute digest **on-demand** at send time from:
  - persisted `MatchResult` (official)
  - leaderboards
- Dedupe by email:
  - One email per mailbox
  - Footer: “This email includes updates for: Alice, Bob”

#### Gmail API approach (recommended)
- OAuth2 with refresh token stored as secret on the Pi
- Scope: `gmail.send`
- Log send results per (EventID, DigestVersion, Email)

---

### Minimal implementation milestones
1. Postgres schema + migrations + seed data
2. Season/Event/Match scheduling (president admin)
3. Roster + score entry (captain)
4. Live standings + completeness indicators
5. Approval workflow + auto-unapprove on edit
6. Finalize/reopen + persisted match results (versioned)
7. Official leaderboards (finalized only) + Live toggle
8. Player auth + profile opt-in/out
9. President manual digest via Gmail API + EmailLog + dedupe
10. Backups + basic monitoring

---

### Future extensions
- Remote access via VPN (e.g., Tailscale) without exposing ports publicly
- HTTPS everywhere (proxy + local CA or public certs if externally reachable)
- Background scheduling for weekly digests (optional)
- Materialized views/caching if leaderboards become heavy
