package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"projectbst/api/internal/store"
)

type TeamsHandler struct {
	Store *store.Store
	Me    func(r *http.Request) (*store.Player, error)
}

func (h *TeamsHandler) List(w http.ResponseWriter, r *http.Request) {
	if _, err := h.Me(r); err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	teams, err := h.Store.ListTeams(r.Context())
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(teams)
}

type createTeamRequest struct {
	TeamName  string `json:"teamName"`
	CaptainID *int64 `json:"captainId"`
}

func (h *TeamsHandler) Create(w http.ResponseWriter, r *http.Request) {
	p, err := h.Me(r)
	if err != nil || p.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var req createTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.TeamName = strings.TrimSpace(req.TeamName)
	if req.TeamName == "" {
		http.Error(w, "teamName required", http.StatusBadRequest)
		return
	}
	if req.CaptainID != nil {
		ok, err := h.Store.PlayerExistsActive(r.Context(), *req.CaptainID)
		if err != nil || !ok {
			http.Error(w, "invalid captain", http.StatusBadRequest)
			return
		}
	}
	t, err := h.Store.CreateTeam(r.Context(), req.TeamName, req.CaptainID)
	if err != nil {
		http.Error(w, "create failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(t)
}

func (h *TeamsHandler) Get(w http.ResponseWriter, r *http.Request) {
	if _, err := h.Me(r); err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil || id < 1 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	t, err := h.Store.GetTeam(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(t)
}

type patchTeamRequest struct {
	TeamName  string `json:"teamName"`
	CaptainID *int64 `json:"captainId"`
}

func (h *TeamsHandler) Patch(w http.ResponseWriter, r *http.Request) {
	p, err := h.Me(r)
	if err != nil || p.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil || id < 1 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req patchTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.TeamName = strings.TrimSpace(req.TeamName)
	if req.TeamName == "" {
		http.Error(w, "teamName required", http.StatusBadRequest)
		return
	}
	if req.CaptainID != nil {
		ok, err := h.Store.PlayerExistsActive(r.Context(), *req.CaptainID)
		if err != nil || !ok {
			http.Error(w, "invalid captain", http.StatusBadRequest)
			return
		}
	}
	t, err := h.Store.UpdateTeam(r.Context(), id, req.TeamName, req.CaptainID)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "update failed", http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(t)
}
