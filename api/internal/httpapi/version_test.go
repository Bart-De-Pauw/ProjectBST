package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestBuildVersion(t *testing.T) {
	t.Setenv("BST_GIT_COMMIT", "abc1234def")
	t.Setenv("BST_BUILD_TIME", "2026-05-23T14:32:00Z")
	t.Setenv("BST_APP_ENV", "dev")

	rec := httptest.NewRecorder()
	BuildVersion(rec, httptest.NewRequest(http.MethodGet, "/public/version", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["commit"] != "abc1234def" || got["builtAt"] != "2026-05-23T14:32:00Z" || got["environment"] != "dev" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestBuildVersion_defaults(t *testing.T) {
	os.Unsetenv("BST_GIT_COMMIT")
	os.Unsetenv("BST_BUILD_TIME")
	os.Unsetenv("BST_APP_ENV")

	rec := httptest.NewRecorder()
	BuildVersion(rec, httptest.NewRequest(http.MethodGet, "/public/version", nil))
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["commit"] != "unknown" || got["environment"] != "dev" {
		t.Fatalf("unexpected defaults: %+v", got)
	}
}
