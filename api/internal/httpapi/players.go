package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"projectbst/api/internal/auth"
	"projectbst/api/internal/store"
)

type PlayersHandler struct {
	Store *store.Store
	Me    func(r *http.Request) (*store.Player, error)
}

func (h *PlayersHandler) List(w http.ResponseWriter, r *http.Request) {
	p, err := h.Me(r)
	if err != nil || p.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	players, err := h.Store.ListPlayers(r.Context())
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(players)
}

type createPlayerRequest struct {
	Username   string  `json:"username"`
	FullName   string  `json:"fullName"`
	Gender     string  `json:"gender"`
	Password   string  `json:"password"`
	Email      *string `json:"email"`
	EmailOptIn bool    `json:"emailOptIn"`
	Role       string  `json:"role"`
}

func (h *PlayersHandler) Create(w http.ResponseWriter, r *http.Request) {
	p, err := h.Me(r)
	if err != nil || p.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req createPlayerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.FullName = strings.TrimSpace(req.FullName)
	req.Gender = strings.TrimSpace(req.Gender)
	req.Role = strings.TrimSpace(req.Role)

	if req.Username == "" || req.FullName == "" || req.Password == "" || (req.Gender != "Male" && req.Gender != "Female") {
		http.Error(w, "missing/invalid fields", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "Player"
	}
	if req.Role != "Player" && req.Role != "Captain" && req.Role != "President" {
		http.Error(w, "invalid role", http.StatusBadRequest)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	created, err := h.Store.CreatePlayer(r.Context(), store.CreatePlayerParams{
		Username:     req.Username,
		FullName:     req.FullName,
		Gender:       req.Gender,
		PasswordHash: hash,
		Email:        req.Email,
		EmailOptIn:   req.EmailOptIn,
		Role:         req.Role,
	})
	if err != nil {
		http.Error(w, "create failed", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

type updateSelfRequest struct {
	Email      *string `json:"email"`
	EmailOptIn bool    `json:"emailOptIn"`
}

func (h *PlayersHandler) UpdateSelf(w http.ResponseWriter, r *http.Request) {
	p, err := h.Me(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req updateSelfRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	updated, err := h.Store.UpdateSelfEmail(r.Context(), store.UpdateSelfEmailParams{
		PlayerID:   p.PlayerID,
		Email:      req.Email,
		EmailOptIn: req.EmailOptIn,
	})
	if err != nil {
		http.Error(w, "update failed", http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *PlayersHandler) Get(w http.ResponseWriter, r *http.Request) {
	pres, err := h.Me(r)
	if err != nil || pres.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil || id < 1 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	p, err := h.Store.GetPlayerByID(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(p)
}

type patchPlayerRequest struct {
	FullName   string  `json:"fullName"`
	Gender     string  `json:"gender"`
	IsActive   bool    `json:"isActive"`
	Email      *string `json:"email"`
	EmailOptIn bool    `json:"emailOptIn"`
	Role       string  `json:"role"`
	Password   string  `json:"password,omitempty"`
}

func (h *PlayersHandler) Patch(w http.ResponseWriter, r *http.Request) {
	pres, err := h.Me(r)
	if err != nil || pres.Role != "President" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil || id < 1 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req patchPlayerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.FullName = strings.TrimSpace(req.FullName)
	req.Gender = strings.TrimSpace(req.Gender)
	req.Role = strings.TrimSpace(req.Role)
	if req.FullName == "" || (req.Gender != "Male" && req.Gender != "Female") {
		http.Error(w, "missing/invalid fields", http.StatusBadRequest)
		return
	}
	if req.Role != "Player" && req.Role != "Captain" && req.Role != "President" {
		http.Error(w, "invalid role", http.StatusBadRequest)
		return
	}

	updated, err := h.Store.UpdatePlayer(r.Context(), store.UpdatePlayerParams{
		PlayerID:   id,
		FullName:   req.FullName,
		Gender:     req.Gender,
		IsActive:   req.IsActive,
		Email:      req.Email,
		EmailOptIn: req.EmailOptIn,
		Role:       req.Role,
	})
	if errors.Is(err, store.ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "update failed", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Password) != "" {
		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if err := h.Store.UpdatePlayerPassword(r.Context(), id, hash); err != nil {
			http.Error(w, "password update failed", http.StatusBadRequest)
			return
		}
	}

	_ = json.NewEncoder(w).Encode(updated)
}

