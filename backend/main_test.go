package main

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"yang-explorer/handlers"
)

// TestRunServer starts the server for development/testing.
// Run with: go test -run TestRunServer -timeout 0
func TestRunServer(t *testing.T) {
	if os.Getenv("RUN_SERVER") != "1" {
		t.Skip("Set RUN_SERVER=1 to start the dev server")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/yang/parse", handlers.ParseYangHandler)
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	frontendDir := "./frontend-dist"
	if _, err := os.Stat(frontendDir); err == nil {
		fs := http.FileServer(http.Dir(frontendDir))
		mux.Handle("/", fs)
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`<html><body><h1>YANG Explorer API</h1><p>Run frontend dev server on port 5173.</p></body></html>`))
		})
	}

	handler := handlers.CORSMiddleware(mux)

	fmt.Printf("YANG Explorer server starting on http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		t.Fatalf("Server error: %v", err)
	}
}
