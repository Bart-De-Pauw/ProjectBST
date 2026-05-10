# Database Schema Proposal: Bowling League Manager

This schema is designed to enforce the state machine and relationship rules defined during the requirements gathering phase. It assumes a relational database structure (e.g., SQLite).

---

## 🏛️ Core Entities & Tables

### 1. Player (The Individual)
Stores immutable player biographical data and evolving metrics.
*   **PlayerID:** (Primary Key, Unique Identifier)
*   **FullName:** String
*   **Gender:** Enum ('Male', 'Female') - *Required for League Leaderboards.*
*   **IsActive:** Boolean - *Used to filter out retired players.*

### 2. Team (The Grouping Unit)
Stores static team composition and leadership information.
*   **TeamID:** (Primary Key, Unique Identifier)
*   **TeamName:** String
*   **CaptainID:** Foreign Key $\rightarrow$ Player(PlayerID). *Must be a valid, active player.*

### 3. SeasonCompetition (The Container)
Defines the overall league context and timeline.
*   **SeasonID:** (Primary Key)
*   **SeasonName:** String (e.g., "Spring 2024")
*   **Start/End Dates:** Date range for the entire competition.

### 4. SeasonTeam (Junction Table - Teams Participating This Season)
Defines which teams exist/participate in a specific season and holds season-scoped totals (all points reset to 0 at season start).
*   **SeasonID:** Foreign Key $\rightarrow$ SeasonCompetition(SeasonID)
*   **TeamID:** Foreign Key $\rightarrow$ Team(TeamID)
*   **SeasonPoints:** Integer - *Team points accumulated across the season (starts at 0).*

### 5. PlayerTeamAffiliation (Junction Table - Season Membership)
Manages which player belongs to which team *for a given season*. Players can be on multiple teams over time but only belong to one primary team during the Season Competition.
*   **SeasonID:** Foreign Key $\rightarrow$ SeasonCompetition(SeasonID)
*   **PlayerID:** Foreign Key $\rightarrow$ Player(PlayerID)
*   **TeamID:** Foreign Key $\rightarrow$ Team(TeamID)
*   **IsCaptain:** Boolean - *Indicates if this specific affiliation makes the player the captain of that team for the season.*

### 6. Event (The Date Anchor)
Defines a single competitive evening within a SeasonCompetition.
*   **EventID:** (Primary Key, Unique Identifier)
*   **SeasonID:** Foreign Key $\rightarrow$ SeasonCompetition(SeasonID)
*   **EventDate:** Date (YYYY-MM-DD)

### 7. Match (The President’s Calendar: Opponent + Lane Per Event)
The president creates the schedule (calendar) at the beginning of the season: who plays whom, and on which lane. Lanes can rotate each event.
*   **MatchID:** (Primary Key)
*   **EventID:** Foreign Key $\rightarrow$ Event(EventID)
*   **LaneNumber:** Integer/Text - *The lane assigned for this match on that event.*
*   **TeamAID:** Foreign Key $\rightarrow$ Team(TeamID)
*   **TeamBID:** Foreign Key $\rightarrow$ Team(TeamID)
*   **Constraints (conceptual):**
    * A team appears in at most one match per event.
    * TeamAID $\neq$ TeamBID.

### 8. MatchRoster (The Daily Slot Declaration)
Locks in which players are participating and for what team/slot for a specific match on a specific event, enforcing the 'single team per night' rule.
*   **MatchID:** Foreign Key $\rightarrow$ Match(MatchID)
*   **TeamID:** Foreign Key $\rightarrow$ Team(TeamID) - *Must be either TeamAID or TeamBID of the match.*
*   **PlayerID:** Foreign Key $\rightarrow$ Player(PlayerID)
*   **SlotPosition:** Integer (1, 2, or 3) - *Fixed position for that evening vs the opposing team’s same slot.*

### 9. MatchPlayerGame (The Transactional Scoring Log — Scratch + Fixed Evening Handicap)
Records raw scratch pins per game plus the handicap that applies for the entire evening. Scratch is stored in raw form for statistics.
*   **MatchPlayerGameID:** (Primary Key)
*   **MatchID:** Foreign Key $\rightarrow$ Match(MatchID)
*   **TeamID:** Foreign Key $\rightarrow$ Team(TeamID)
*   **PlayerID:** Foreign Key $\rightarrow$ Player(PlayerID)
*   **SlotPosition:** Integer (1, 2, or 3) - *Must match the slot in `MatchRoster`.*
*   **GameNumber:** Integer (1..3)
*   **ScratchScore:** Integer - *Raw pins count (scratch).*
*   **HdcpAtEvent:** Integer - *Handicap used for the whole evening; calculated at the start of the event and fixed for all 3 games that night.*
*   **SubmittedByCaptainID:** Foreign Key $\rightarrow$ Player(PlayerID) - *The captain submitting the data.*

---

## 🔄 Calculated & Derived Fields (State Management Logic)

These fields are **NOT** stored as primary inputs but must be calculated or updated by application logic after specific triggers.

### 1. Handicap Calculation (Applied per evening; updated for next evening)
*   **Rule:** Handicap is calculated at the beginning of an evening and remains the same for that entire evening (all 3 games).
*   **Storage:** The handicap actually used that night is stored as `HdcpAtEvent` on each `MatchPlayerGame` row (so point calculations are deterministic and auditable).
*   **When it changes:** A new handicap becomes known at the start of the *next* event, based on aggregated season performance up to the previous event(s).
*   **Formula Dependency:** Requires calculating the Player's season statistics (e.g., Season Average Score/SAS) based on recorded scratch scores in the current season.
    $$\text{New Handicap} = \min\left(\max\left( \text{rounddown}\left((200 - \text{SAS}_{\text{prev}} \times 70\%); 0\right), 0\right), 70\right)$$
*   **Initial State:** For Event 1, starting handicap is $\mathbf{0}$.

### 2. Season Statistics Aggregation (Team + Player)
All season-scoped points reset to 0 at the start of a new season. New teams/players may be introduced; some may disappear (simply absent from the season junction tables).

*   **Team season points:** stored on `SeasonTeam.SeasonPoints` (and incremented from per-event results).
*   **Player season stats (for leaderboards):** derived from `MatchPlayerGame.ScratchScore` (and `HdcpAtEvent` where needed), scoped to the season via `Event -> SeasonID`.
*   **Player season points (optional):** if you award player points season-wide, store them in a `SeasonPlayer` junction keyed by `(SeasonID, PlayerID)`; otherwise compute from match results.

### 3. Match & Event Point Calculation (League Rules)
Per match, each evening consists of 3 games. For each game between Team A and Team B:

* Slot comparisons (3 points per game):
  * Slot 1: compare **(scratch + hdcp)** of Team A slot 1 vs Team B slot 1 → winner gets 1 point
  * Slot 2: compare **(scratch + hdcp)** → winner gets 1 point
  * Slot 3: compare **(scratch + hdcp)** → winner gets 1 point
* Team total comparison (1 point per game):
  * Compare **Team A total (sum scratch) + sum hdcp** vs Team B total (sum scratch) + sum hdcp → winner gets 1 point
* Game winner bonus (1 point per game):
  * The team with the highest sum of points for that game receives **an additional 1 point**

Repeat for games 1..3.

End-of-evening bonus (1 point):
* Aggregate all games for the evening and give the team with the highest total for the evening another **1 point**.

Season accumulation:
* The resulting match/evening outcome is stored/aggregated into season totals so the season can show:
  * Team leaderboard (season points)
  * Player leaderboards by gender (male and female)

### 🏆 Final Ranking Logic (At Season End)
Three leaderboards are produced:

1. **Team Leaderboard**
   * Primary: Season points (from `SeasonTeam.SeasonPoints`)
   * Tie-breakers: define explicitly (e.g., head-to-head, total scratch pins, etc.)
2. **Male Player Leaderboard**
   * Filter: `Player.Gender = 'Male'`
   * Ranking metric: based on aggregated season performance (scratch-based stats; tie-breakers as desired)
3. **Female Player Leaderboard**
   * Filter: `Player.Gender = 'Female'`
   * Ranking metric: based on aggregated season performance (scratch-based stats; tie-breakers as desired)

---
This schema provides the necessary backbone for development. Please review this structure against your understanding of the system, and confirm if this detailed model accurately captures all operational requirements before we proceed to writing the initial application code (e.g., Python/SQLite backend).