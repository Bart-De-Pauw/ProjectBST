package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"projectbst/api/internal/scoring"
	"projectbst/api/internal/store"
)

type LeagueHandler struct {
	Store *store.Store
	Me    func(r *http.Request) (*store.Player, error)
}

func (h *LeagueHandler) requireUser(w http.ResponseWriter, r *http.Request) (*store.Player, bool) {
	p, err := h.Me(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return nil, false
	}
	return p, true
}

func (h *LeagueHandler) requirePresident(w http.ResponseWriter, r *http.Request) (*store.Player, bool) {
	p, err := h.Me(r)
	if err != nil || p.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return nil, false
	}
	return p, true
}

type createSeasonReq struct {
	SeasonName string  `json:"seasonName"`
	StartDate  *string `json:"startDate"`
	EndDate    *string `json:"endDate"`
}

func parseOptDate(s *string) (*time.Time, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", strings.TrimSpace(*s))
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *LeagueHandler) CreateSeason(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	var req createSeasonReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.SeasonName = strings.TrimSpace(req.SeasonName)
	if req.SeasonName == "" {
		http.Error(w, "seasonName required", http.StatusBadRequest)
		return
	}
	sd, err := parseOptDate(req.StartDate)
	if err != nil {
		http.Error(w, "invalid startDate", http.StatusBadRequest)
		return
	}
	ed, err := parseOptDate(req.EndDate)
	if err != nil {
		http.Error(w, "invalid endDate", http.StatusBadRequest)
		return
	}
	se, err := h.Store.CreateSeason(r.Context(), req.SeasonName, sd, ed)
	if err != nil {
		http.Error(w, "create failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(se)
}

func (h *LeagueHandler) ListSeasons(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	list, err := h.Store.ListSeasons(r.Context())
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (h *LeagueHandler) GetSeasonHTTP(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	se, err := h.Store.GetSeason(r.Context(), sid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(se)
}

type patchSeasonReq struct {
	SeasonName string  `json:"seasonName"`
	StartDate  *string `json:"startDate"`
	EndDate    *string `json:"endDate"`
}

func (h *LeagueHandler) PatchSeasonHTTP(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	var req patchSeasonReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.SeasonName = strings.TrimSpace(req.SeasonName)
	if req.SeasonName == "" {
		http.Error(w, "seasonName required", http.StatusBadRequest)
		return
	}
	sd, err := parseOptDate(req.StartDate)
	if err != nil {
		http.Error(w, "invalid startDate", http.StatusBadRequest)
		return
	}
	ed, err := parseOptDate(req.EndDate)
	if err != nil {
		http.Error(w, "invalid endDate", http.StatusBadRequest)
		return
	}
	se, err := h.Store.UpdateSeason(r.Context(), sid, req.SeasonName, sd, ed)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "update failed", http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(se)
}

func (h *LeagueHandler) AddSeasonTeam(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	var body struct {
		TeamID int64 `json:"teamId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TeamID < 1 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if _, err := h.Store.GetSeason(r.Context(), sid); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if _, err := h.Store.GetTeam(r.Context(), body.TeamID); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "team not found", http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if err := h.Store.AddSeasonTeam(r.Context(), sid, body.TeamID); err != nil {
		http.Error(w, "add failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) RemoveSeasonTeam(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	tid, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil || tid < 1 {
		http.Error(w, "invalid team id", http.StatusBadRequest)
		return
	}
	if err := h.Store.RemoveSeasonTeam(r.Context(), sid, tid); err != nil {
		http.Error(w, "remove failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) UpsertAffiliation(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	var body struct {
		PlayerID  int64 `json:"playerId"`
		TeamID    int64 `json:"teamId"`
		IsCaptain bool  `json:"isCaptain"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PlayerID < 1 || body.TeamID < 1 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	ok, err := h.Store.SeasonContainsTeam(r.Context(), sid, body.TeamID)
	if err != nil || !ok {
		http.Error(w, "team not in season", http.StatusBadRequest)
		return
	}
	if err := h.Store.UpsertPlayerAffiliation(r.Context(), sid, body.PlayerID, body.TeamID, body.IsCaptain); err != nil {
		http.Error(w, "save failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) CreateSeasonEvent(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	var body struct {
		EventDate string `json:"eventDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	d, err := time.Parse("2006-01-02", strings.TrimSpace(body.EventDate))
	if err != nil {
		http.Error(w, "invalid eventDate", http.StatusBadRequest)
		return
	}
	if _, err := h.Store.GetSeason(r.Context(), sid); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	ev, err := h.Store.CreateEvent(r.Context(), sid, d)
	if err != nil {
		http.Error(w, "create failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(ev)
}

func (h *LeagueHandler) ListSeasonEvents(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	list, err := h.Store.ListEvents(r.Context(), sid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (h *LeagueHandler) ListSeasonTeamsHTTP(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	if _, err := h.Store.GetSeason(r.Context(), sid); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	list, err := h.Store.ListSeasonTeams(r.Context(), sid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (h *LeagueHandler) ListSeasonAffiliationsHTTP(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireUser(w, r); !ok {
		return
	}
	sid, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil || sid < 1 {
		http.Error(w, "invalid season id", http.StatusBadRequest)
		return
	}
	if _, err := h.Store.GetSeason(r.Context(), sid); errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	list, err := h.Store.ListAffiliations(r.Context(), sid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (h *LeagueHandler) CreateEventMatch(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requirePresident(w, r); !ok {
		return
	}
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	var body struct {
		LaneNumber string `json:"laneNumber"`
		TeamAID    int64  `json:"teamAId"`
		TeamBID    int64  `json:"teamBId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	body.LaneNumber = strings.TrimSpace(body.LaneNumber)
	if body.LaneNumber == "" || body.TeamAID < 1 || body.TeamBID < 1 || body.TeamAID == body.TeamBID {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), eid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if ev.Finalized {
		http.Error(w, "event finalized", http.StatusBadRequest)
		return
	}
	m, err := h.Store.CreateMatch(r.Context(), eid, body.LaneNumber, body.TeamAID, body.TeamBID)
	if err != nil {
		http.Error(w, "create failed", http.StatusBadRequest)
		return
	}
	if err := h.Store.EnsureMatchApprovals(r.Context(), m.MatchID, m.TeamAID, m.TeamBID); err != nil {
		http.Error(w, "approval seed failed", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(m)
}

func (h *LeagueHandler) ListEventMatches(w http.ResponseWriter, r *http.Request) {
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	list, err := h.Store.ListMatchesForEvent(r.Context(), eid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (h *LeagueHandler) ListMatchApprovalsHTTP(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	mid, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil || mid < 1 {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}
	m, err := h.Store.GetMatch(r.Context(), mid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	seasonID, err := h.Store.GetSeasonIDForMatch(r.Context(), mid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if user.Role != "President" {
		okA, errA := h.Store.PlayerIsCaptainOfTeam(r.Context(), seasonID, user.PlayerID, m.TeamAID)
		okB, errB := h.Store.PlayerIsCaptainOfTeam(r.Context(), seasonID, user.PlayerID, m.TeamBID)
		if errA != nil || errB != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if !okA && !okB {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}
	list, err := h.Store.ListMatchApprovals(r.Context(), mid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(list)
}

type rosterEntry struct {
	TeamID       int64 `json:"teamId"`
	PlayerID     int64 `json:"playerId"`
	SlotPosition int16 `json:"slotPosition"`
}

func (h *LeagueHandler) PutMatchRoster(w http.ResponseWriter, r *http.Request) {
	pres, ok := h.requirePresident(w, r)
	if !ok {
		return
	}
	_ = pres
	mid, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil || mid < 1 {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}
	m, err := h.Store.GetMatch(r.Context(), mid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), m.EventID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if ev.Finalized {
		http.Error(w, "event finalized", http.StatusBadRequest)
		return
	}

	var rows []rosterEntry
	if err := json.NewDecoder(r.Body).Decode(&rows); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	for _, row := range rows {
		if row.TeamID != m.TeamAID && row.TeamID != m.TeamBID {
			http.Error(w, "invalid team", http.StatusBadRequest)
			return
		}
		if row.SlotPosition < 1 || row.SlotPosition > 3 {
			http.Error(w, "invalid slot", http.StatusBadRequest)
			return
		}
		if err := h.Store.UpsertMatchRoster(r.Context(), mid, row.TeamID, row.PlayerID, row.SlotPosition); err != nil {
			http.Error(w, "save failed", http.StatusBadRequest)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

type scoreReq struct {
	TeamID       int64 `json:"teamId"`
	PlayerID     int64 `json:"playerId"`
	SlotPosition int16 `json:"slotPosition"`
	GameNumber   int16 `json:"gameNumber"`
	ScratchScore int16 `json:"scratchScore"`
	HdcpAtEvent  int16 `json:"hdcpAtEvent"`
}

func (h *LeagueHandler) PostMatchScore(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	mid, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil || mid < 1 {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}
	var body scoreReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if body.TeamID < 1 || body.PlayerID < 1 || body.GameNumber < 1 || body.GameNumber > 3 || body.SlotPosition < 1 || body.SlotPosition > 3 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	m, err := h.Store.GetMatch(r.Context(), mid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), m.EventID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if ev.Finalized {
		http.Error(w, "event finalized", http.StatusBadRequest)
		return
	}

	seasonID, err := h.Store.GetSeasonIDForMatch(r.Context(), mid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	if user.Role != "President" {
		capOK, err := h.Store.PlayerIsCaptainOfTeam(r.Context(), seasonID, user.PlayerID, body.TeamID)
		if err != nil || !capOK {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	memOK, err := h.Store.PlayerAffiliatedWithTeam(r.Context(), seasonID, body.PlayerID, body.TeamID)
	if err != nil || !memOK {
		http.Error(w, "player not on team", http.StatusBadRequest)
		return
	}

	if err := h.Store.UpsertMatchPlayerGame(r.Context(), mid, body.TeamID, body.PlayerID, body.SlotPosition, body.GameNumber, body.ScratchScore, body.HdcpAtEvent, user.PlayerID); err != nil {
		http.Error(w, "save failed", http.StatusBadRequest)
		return
	}

	// Auto-unapprove captain-side approvals when scores change (president overrides preserved).
	_ = h.Store.RevokeMatchApproval(r.Context(), mid, body.TeamID, user.PlayerID, "score_edit")

	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) ApproveMatch(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	mid, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil || mid < 1 {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}
	var body struct {
		TeamID int64 `json:"teamId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TeamID < 1 {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	m, err := h.Store.GetMatch(r.Context(), mid)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), m.EventID)
	if err != nil || ev.Finalized {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	seasonID, err := h.Store.GetSeasonIDForMatch(r.Context(), mid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	capOK, err := h.Store.PlayerIsCaptainOfTeam(r.Context(), seasonID, user.PlayerID, body.TeamID)
	if err != nil || !capOK {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if body.TeamID != m.TeamAID && body.TeamID != m.TeamBID {
		http.Error(w, "invalid team", http.StatusBadRequest)
		return
	}
	if err := h.Store.ApproveMatchTeam(r.Context(), mid, body.TeamID, user.PlayerID); err != nil {
		http.Error(w, "approve failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) OverrideApproveMatch(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil || user.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	mid, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil || mid < 1 {
		http.Error(w, "invalid match id", http.StatusBadRequest)
		return
	}
	var body struct {
		TeamID int64  `json:"teamId"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TeamID < 1 || strings.TrimSpace(body.Reason) == "" {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	m, err := h.Store.GetMatch(r.Context(), mid)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if body.TeamID != m.TeamAID && body.TeamID != m.TeamBID {
		http.Error(w, "invalid team", http.StatusBadRequest)
		return
	}
	if err := h.Store.OverrideMatchApproval(r.Context(), mid, body.TeamID, user.PlayerID, strings.TrimSpace(body.Reason)); err != nil {
		http.Error(w, "override failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) FinalizeEventHTTP(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil || user.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	if err := h.Store.FinalizeEvent(r.Context(), eid, user.PlayerID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type reopenReq struct {
	Reason string `json:"reason"`
}

func (h *LeagueHandler) ReopenEventHTTP(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil || user.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	var body reopenReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := h.Store.ReopenEvent(r.Context(), eid, user.PlayerID, strings.TrimSpace(body.Reason)); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LeagueHandler) SendDigestStub(w http.ResponseWriter, r *http.Request) {
	user, err := h.Me(r)
	if err != nil || user.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), eid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if !ev.Finalized {
		http.Error(w, "event not finalized", http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":       "not_configured",
		"eventId":      eid,
		"message":      "Gmail API integration pending — configure OAuth credentials and implement send.",
		"finalizeGenerationPlaceholder": true,
	})
}

func (h *LeagueHandler) LiveEvent(w http.ResponseWriter, r *http.Request) {
	eid, err := strconv.ParseInt(chi.URLParam(r, "eventID"), 10, 64)
	if err != nil || eid < 1 {
		http.Error(w, "invalid event id", http.StatusBadRequest)
		return
	}
	ev, err := h.Store.GetEvent(r.Context(), eid)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	matches, err := h.Store.ListMatchesForEvent(r.Context(), eid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	type liveMatch struct {
		Match      store.Match              `json:"match"`
		Totals     scoring.MatchTotals      `json:"totals"`
		Roster     []store.RosterRow        `json:"roster"`
		Scores     []store.MatchPlayerGameRow `json:"scores"`
		Finalized  bool                     `json:"eventFinalized"`
	}

	out := map[string]any{
		"eventId":    ev.EventID,
		"seasonId":   ev.SeasonID,
		"finalized":  ev.Finalized,
		"eventDate":  ev.EventDate,
		"matches":    []liveMatch{},
		"provisional": !ev.Finalized,
	}

	list := make([]liveMatch, 0, len(matches))
	for _, m := range matches {
		roster, _ := h.Store.ListMatchRoster(r.Context(), m.MatchID)
		scores, _ := h.Store.ListMatchPlayerGames(r.Context(), m.MatchID)
		ms := store.BuildMatchScoresPartialFromRows(m.TeamAID, m.TeamBID, roster, scores)
		tot := scoring.ScoreMatch(ms)
		list = append(list, liveMatch{
			Match:     m,
			Totals:    tot,
			Roster:    roster,
			Scores:    scores,
			Finalized: ev.Finalized,
		})
	}
	out["matches"] = list
	_ = json.NewEncoder(w).Encode(out)
}
