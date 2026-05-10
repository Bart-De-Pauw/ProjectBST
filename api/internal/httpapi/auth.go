package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"projectbst/api/internal/auth"
	"projectbst/api/internal/store"
)

type AuthHandler struct {
	Store *store.Store
	Sessions *SessionManager
}

type SessionManager struct {
	mu sync.RWMutex
	byToken map[string]session
}

type session struct {
	PlayerID int64
	ExpiresAt time.Time
}

func NewSessionManager() *SessionManager {
	return &SessionManager{byToken: map[string]session{}}
}

func (sm *SessionManager) Create(playerID int64, ttl time.Duration) (string, error) {
	token, err := auth.NewSessionToken()
	if err != nil {
		return "", err
	}
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.byToken[token] = session{PlayerID: playerID, ExpiresAt: time.Now().Add(ttl)}
	return token, nil
}

func (sm *SessionManager) Get(token string) (int64, bool) {
	sm.mu.RLock()
	s, ok := sm.byToken[token]
	sm.mu.RUnlock()
	if !ok {
		return 0, false
	}
	if time.Now().After(s.ExpiresAt) {
		sm.mu.Lock()
		delete(sm.byToken, token)
		sm.mu.Unlock()
		return 0, false
	}
	return s.PlayerID, true
}

func (sm *SessionManager) Delete(token string) {
	sm.mu.Lock()
	delete(sm.byToken, token)
	sm.mu.Unlock()
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password required", http.StatusBadRequest)
		return
	}

	p, err := h.Store.GetPlayerByUsername(r.Context(), req.Username)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := auth.VerifyPassword(req.Password, p.PasswordHash); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := h.Sessions.Create(p.PlayerID, 7*24*time.Hour)
	if err != nil {
		http.Error(w, "session error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		// Secure can be turned on once we have HTTPS via proxy.
	})

	_ = json.NewEncoder(w).Encode(map[string]any{
		"playerId": p.PlayerID,
		"username": p.Username,
		"role":     p.Role,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("session")
	if err == nil {
		h.Sessions.Delete(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	p, err := h.RequireUser(r.Context(), r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"playerId":   p.PlayerID,
		"username":   p.Username,
		"fullName":   p.FullName,
		"gender":     p.Gender,
		"isActive":   p.IsActive,
		"role":       p.Role,
		"email":      p.Email,
		"emailOptIn": p.EmailOptIn,
	})
}

func (h *AuthHandler) RequireUser(ctx context.Context, r *http.Request) (*store.Player, error) {
	c, err := r.Cookie("session")
	if err != nil {
		return nil, errors.New("no session")
	}
	playerID, ok := h.Sessions.Get(c.Value)
	if !ok {
		return nil, errors.New("invalid session")
	}
	return h.Store.GetPlayerByID(ctx, playerID)
}

func RequireRole(role string, next http.HandlerFunc, me func(ctx context.Context, r *http.Request) (*store.Player, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, err := me(r.Context(), r)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if p.Role != role {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

