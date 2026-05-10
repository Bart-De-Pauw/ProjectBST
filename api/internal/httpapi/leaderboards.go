package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"projectbst/api/internal/store"
)

func (h *LeagueHandler) PublicSeasonLeaderboards(w http.ResponseWriter, r *http.Request) {
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

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "official"
	}

	type payload struct {
		SeasonID int64                              `json:"seasonId"`
		Mode     string                             `json:"mode"`
		Teams    []store.TeamLeaderboardRow         `json:"teams"`
		Male     []store.PlayerScratchLeaderboardRow `json:"malePlayers"`
		Female   []store.PlayerScratchLeaderboardRow `json:"femalePlayers"`
		Note     string                             `json:"note"`
	}

	out := payload{
		SeasonID: sid,
		Mode:     mode,
		Note:     "Official standings use finalized events only for scratch totals; team points come from season_team.",
	}

	teams, err := h.Store.TeamLeaderboard(r.Context(), sid)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	out.Teams = teams

	if mode == "live" {
		out.Note = "live mode currently matches official for scratch totals (finalize events to affect standings)."
	}

	male, err := h.Store.PlayerScratchLeaderboard(r.Context(), sid, "Male")
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	female, err := h.Store.PlayerScratchLeaderboard(r.Context(), sid, "Female")
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	out.Male = male
	out.Female = female

	_ = json.NewEncoder(w).Encode(out)
}
