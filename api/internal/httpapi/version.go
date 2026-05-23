package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
)

// BuildVersion returns public build metadata for the API (no auth).
func BuildVersion(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"commit":      envOrDefault("BST_GIT_COMMIT", "unknown"),
		"builtAt":     envOrDefault("BST_BUILD_TIME", ""),
		"environment": envOrDefault("BST_APP_ENV", "dev"),
	})
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
