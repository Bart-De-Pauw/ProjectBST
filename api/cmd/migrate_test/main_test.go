package main_test

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigrationsApplyToEmptyDB(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; run with a disposable postgres in CI")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	_, err = pool.Exec(ctx, "DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	if err != nil {
		t.Fatalf("reset schema: %v", err)
	}

	root := repoRoot(t)
	migrationsDir := filepath.Join(root, "infra", "migrations")

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil {
		t.Fatalf("glob migrations: %v", err)
	}
	if len(files) == 0 {
		t.Fatalf("no migrations found in %s", migrationsDir)
	}

	for _, f := range files {
		cmd := exec.CommandContext(ctx, "psql", dsn, "-v", "ON_ERROR_STOP=1", "-f", f)
		var out bytes.Buffer
		cmd.Stdout = &out
		cmd.Stderr = &out
		if err := cmd.Run(); err != nil {
			t.Fatalf("apply %s: %v\n%s", f, err, out.String())
		}
	}

	// sanity: ensure a few core tables exist
	var exists bool
	err = pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema='public' AND table_name='player'
		)
	`).Scan(&exists)
	if err != nil {
		t.Fatalf("check player table: %v", err)
	}
	if !exists {
		t.Fatalf("expected player table to exist")
	}
}

func repoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 10; i++ {
		if _, err := os.Stat(filepath.Join(dir, "infra")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatalf("could not find repo root from %s", dir)
	return ""
}

