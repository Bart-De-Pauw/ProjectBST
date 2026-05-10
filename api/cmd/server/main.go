package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
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

	r.Use(corsForDev)

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
	})
	r.Route("/profile", func(r chi.Router) {
		r.Put("/", playersHandler.UpdateSelf)
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

func corsForDev(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")) {
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
