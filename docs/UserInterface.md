# User interface blueprint

Reference for the Bowling Competition Manager UI: information architecture, Modern theme tokens, and screen map. Scoring rules and API behavior live in [architecture.md](./architecture.md).

## Goals

- **Speed:** scoring input and live viewing should be low-friction on competition nights.
- **Clarity:** generous spacing; status colors show saved vs draft vs missing data.
- **Roles:** public leaderboards and live view; captains enter scorecards; presidents manage league setup.

## Modern theme (default)

| Token | Hex | MUI / usage |
| :--- | :--- | :--- |
| `dominant` | `#ffffff` | `palette.background.default`, `palette.background.paper`, page surfaces |
| `secondary` | `#f27272` | `palette.secondary.main`, dividers, outlined borders, table headers |
| `accent` | `#f7d865` | `palette.primary.main`, primary CTAs, active nav, rank #1 highlight |
| `textPrimary` | `#1a1a1a` | `palette.text.primary` |
| `textSecondary` | `#5c5c5c` | `palette.text.secondary` |

Implementation: `web/src/theme/modernTheme.ts` exports `modernTheme`, `modernColors`, `rankRowSx`, and `fieldStatusSx`.

**Status colors (score entry):**

- Green background = saved on server
- Yellow background = draft / unsaved edit

**Leaderboard ranks:**

- Rank 1: strong accent background
- Ranks 2–3: lighter accent background

**Live vs official:**

- Live views show: *Live / Unfinalized — standings and points may change until the president finalizes events.*
- Official views use finalized event data only (see architecture.md).

## Information architecture

### Primary navigation (desktop sidebar)

| Item | Who sees it | Route |
| :--- | :--- | :--- |
| Leaderboards | Everyone | `/leaderboards` → season standings |
| Live scores | Everyone | `/live` → event live hub |
| Scorecard | Captain, President | `/scorecard` → open events |
| Admin | President only | `/admin/*` |

### Mobile (< md)

Bottom tabs (default tab: **Live scores**):

1. Live scores → `/live`
2. Season standings → `/leaderboards`
3. Scorecard → `/scorecard` (captains/presidents only)

Admin is not a public tab; presidents use the desktop sidebar or `/admin`.

## Screen map

| Route | Role | Primary action |
| :--- | :--- | :--- |
| `/live` | Public | Pick or resume a live event |
| `/events/:eventId/live` | Public | Watch match progress + completeness (#5) |
| `/leaderboards` | Public | Open season standings hub |
| `/seasons/:seasonId/leaderboards` | Public | Official / live leaderboards (#6) |
| `/scorecard` | Captain, President | List open events for score entry |
| `/admin/events/:eventId` | Captain, President | Roster + scratch scores (#3, #4) |
| `/admin` | President | Admin hub |
| `/admin/seasons` | President | Seasons & schedule (#2) |
| `/admin/seasons/:seasonId` | President | Teams, affiliations, events |
| `/admin/players` | President | Player accounts |
| `/admin/teams` | President | Teams |
| `/login` | Anonymous | Sign in |
| `/profile` | Authenticated | Email preferences |
| `/about` | Public | App info + web/API build metadata (#14) |

### About page (`/about`)

- Public; linked from sidebar (desktop) and app bar (mobile).
- Shows environment badge (`dev` / `prod`), web commit + UTC build time, API commit + UTC build time (from `GET /public/version`).
- Build metadata injected at Docker build (`GIT_COMMIT`, `BUILD_TIME`); see `scripts/docker-stack.* start --build`.

## Layout notes

- **Desktop:** permanent sidebar; score entry uses a wide grid with large inputs.
- **Mobile:** bottom tabs for consumption; score entry remains usable with horizontal scroll on the grid.
- **Traditional theme:** deferred; keep structural color roles above when adding a second theme later.

## Related issues

- #2 Schedule / calendar UI
- #3 Captain roster
- #4 Captain score entry
- #5 Live match view
- #6 Leaderboards
