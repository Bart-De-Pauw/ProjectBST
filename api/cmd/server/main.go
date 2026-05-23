package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"projectbst/api/internal/httpapi"
	"projectbst/api/internal/store"
)

func main() {
	port := envOr("PORT", "8080")
	dsn := os.Getenv("DATABASE_URL")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var db *pgxpool.Pool
	if dsn != "" {
		pool, err := pgxpool.New(ctx, dsn)
		if err != nil {
			log.Fatalf("db connect: %v", err)
		}
		defer pool.Close()
		db = pool
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(corsReflectOrigin)

	if db == nil {
		log.Fatalf("DATABASE_URL is required")
	}
	st := store.New(db)
	authHandler := &httpapi.AuthHandler{
		Store:    st,
		Sessions: httpapi.NewSessionManager(),
	}
	playersHandler := &httpapi.PlayersHandler{
		Store: st,
		Me: func(r *http.Request) (*store.Player, error) {
			return authHandler.RequireUser(r.Context(), r)
		},
	}
	meFn := func(r *http.Request) (*store.Player, error) {
		return authHandler.RequireUser(r.Context(), r)
	}
	teamsHandler := &httpapi.TeamsHandler{Store: st, Me: meFn}
	leagueHandler := &httpapi.LeagueHandler{Store: st, Me: meFn}

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		if db != nil {
			ctxPing, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			if err := db.Ping(ctxPing); err != nil {
				http.Error(w, "db not ready", http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
		r.Get("/me", authHandler.Me)
	})

	r.Route("/players", func(r chi.Router) {
		r.Get("/", playersHandler.List)
		r.Post("/", playersHandler.Create)
		r.Get("/{playerID}", playersHandler.Get)
		r.Patch("/{playerID}", playersHandler.Patch)
	})
	r.Route("/profile", func(r chi.Router) {
		r.Put("/", playersHandler.UpdateSelf)
	})

	r.Route("/teams", func(r chi.Router) {
		r.Get("/", teamsHandler.List)
		r.Post("/", teamsHandler.Create)
		r.Get("/{teamID}", teamsHandler.Get)
		r.Patch("/{teamID}", teamsHandler.Patch)
	})

	r.Route("/seasons", func(r chi.Router) {
		r.Post("/", leagueHandler.CreateSeason)
		r.Get("/", leagueHandler.ListSeasons)
		r.Route("/{seasonID}", func(r chi.Router) {
			r.Get("/", leagueHandler.GetSeasonHTTP)
			r.Patch("/", leagueHandler.PatchSeasonHTTP)
			r.Post("/teams", leagueHandler.AddSeasonTeam)
			r.Get("/teams", leagueHandler.ListSeasonTeamsHTTP)
			r.Delete("/teams/{teamID}", leagueHandler.RemoveSeasonTeam)
			r.Post("/affiliations", leagueHandler.UpsertAffiliation)
			r.Get("/affiliations", leagueHandler.ListSeasonAffiliationsHTTP)
			r.Post("/events", leagueHandler.CreateSeasonEvent)
			r.Get("/events", leagueHandler.ListSeasonEvents)
		})
	})

	r.Route("/events", func(r chi.Router) {
		r.Post("/{eventID}/matches", leagueHandler.CreateEventMatch)
		r.Get("/{eventID}/matches", leagueHandler.ListEventMatches)
		r.Post("/{eventID}/finalize", leagueHandler.FinalizeEventHTTP)
		r.Post("/{eventID}/reopen", leagueHandler.ReopenEventHTTP)
		r.Post("/{eventID}/send-digest", leagueHandler.SendDigestStub)
	})

	r.Route("/matches", func(r chi.Router) {
		r.Get("/{matchID}/approvals", leagueHandler.ListMatchApprovalsHTTP)
		r.Put("/{matchID}/roster", leagueHandler.PutMatchRoster)
		r.Post("/{matchID}/scores", leagueHandler.PostMatchScore)
		r.Post("/{matchID}/approve", leagueHandler.ApproveMatch)
		r.Post("/{matchID}/approve/override", leagueHandler.OverrideApproveMatch)
	})

	r.Route("/public", func(r chi.Router) {
		r.Get("/version", httpapi.BuildVersion)
		r.Get("/events/{eventID}/live", leagueHandler.LiveEvent)
		r.Get("/seasons/{seasonID}/leaderboards", leagueHandler.PublicSeasonLeaderboards)
	})

	// Placeholder protected endpoint to prove RBAC wiring.
	r.Get("/admin/ping", httpapi.RequireRole("President", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}, authHandler.RequireUser))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Printf("api listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// corsReflectOrigin mirrors the request Origin for LAN/browser credentials + cookies.
// Harden this before exposing the API on the public internet.
func corsReflectOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
