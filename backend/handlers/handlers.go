package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"yang-explorer/parser"
)

// ParseYangHandler handles YANG file upload and parsing
func ParseYangHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit upload size to 10MB
	r.ParseMultipartForm(10 << 20)

	file, header, err := r.FormFile("yangFile")
	if err != nil {
		// Try reading raw body as YANG content
		body, readErr := io.ReadAll(r.Body)
		if readErr != nil || len(body) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "No YANG file provided. Use multipart form with 'yangFile' field.",
			})
			return
		}

		filename := r.Header.Get("X-Filename")
		if filename == "" {
			filename = "input.yang"
		}

		schema, parseErr := parser.ParseYangContent(string(body), filename)
		if parseErr != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
				"error": fmt.Sprintf("Failed to parse YANG: %v", parseErr),
			})
			return
		}

		writeJSON(w, http.StatusOK, schema)
		return
	}
	defer file.Close()

	// Validate file extension
	if !strings.HasSuffix(header.Filename, ".yang") {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "File must have .yang extension",
		})
		return
	}

	// Create temp file
	tmpDir, err := os.MkdirTemp("", "yang-explorer-*")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to create temp directory",
		})
		return
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, header.Filename)
	out, err := os.Create(tmpFile)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to save uploaded file",
		})
		return
	}

	if _, err := io.Copy(out, file); err != nil {
		out.Close()
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Failed to write file",
		})
		return
	}
	out.Close()

	schema, err := parser.ParseYangFile(tmpFile)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
			"error": fmt.Sprintf("Failed to parse YANG: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, schema)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// CORSMiddleware adds CORS headers for development
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Filename")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
