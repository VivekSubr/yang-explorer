package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"yang-explorer/models"
	"yang-explorer/parser"
)

// jsonInput represents a JSON request body with YANG content or a filepath
type jsonInput struct {
	Content  string `json:"content"`
	Filename string `json:"filename"`
	Filepath string `json:"filepath"`
}

// extractYangSchema resolves YANG input from any supported format and returns a parsed schema.
// Supported formats: multipart file upload, JSON body (content or filepath), raw body with X-Filename.
func extractYangSchema(r *http.Request) (*models.YangSchema, error) {
	ct := r.Header.Get("Content-Type")

	// 1. JSON body: {"content":"...", "filename":"..."} or {"filepath":"/path/to/file.yang"}
	if strings.HasPrefix(ct, "application/json") {
		var input jsonInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			return nil, fmt.Errorf("invalid JSON body: %w", err)
		}

		if input.Filepath != "" {
			absPath, err := filepath.Abs(input.Filepath)
			if err != nil {
				return nil, fmt.Errorf("invalid filepath: %w", err)
			}
			if _, err := os.Stat(absPath); err != nil {
				return nil, fmt.Errorf("file not found: %s", absPath)
			}
			return parser.ParseYangFile(absPath)
		}

		if input.Content != "" {
			filename := input.Filename
			if filename == "" {
				filename = "input.yang"
			}
			return parser.ParseYangContent(input.Content, filename)
		}

		return nil, fmt.Errorf("JSON body must include 'content' or 'filepath'")
	}

	// 2. Multipart file upload
	r.ParseMultipartForm(10 << 20)
	file, header, err := r.FormFile("yangFile")
	if err == nil {
		defer file.Close()
		return parseUploadedFile(file, header)
	}

	// 3. Raw body with optional X-Filename header
	body, readErr := io.ReadAll(r.Body)
	if readErr != nil || len(body) == 0 {
		return nil, fmt.Errorf("no YANG input provided. Send multipart form, JSON body, or raw content")
	}

	filename := r.Header.Get("X-Filename")
	if filename == "" {
		filename = "input.yang"
	}
	return parser.ParseYangContent(string(body), filename)
}

// ParseYangHandler handles YANG file upload and parsing
func ParseYangHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	schema, err := extractYangSchema(r)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "parse YANG") || strings.Contains(err.Error(), "processing errors") {
			status = http.StatusUnprocessableEntity
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, schema)
}

// SonicComplianceHandler checks SONiC compliance of an uploaded YANG file
func SonicComplianceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	schema, err := extractYangSchema(r)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "parse YANG") || strings.Contains(err.Error(), "processing errors") {
			status = http.StatusUnprocessableEntity
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	result := parser.CheckSonicCompliance(schema)
	writeJSON(w, http.StatusOK, result)
}

// SonicLintHandler lints a YANG file against SONiC YANG Model Guidelines
func SonicLintHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	schema, err := extractYangSchema(r)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "parse YANG") || strings.Contains(err.Error(), "processing errors") {
			status = http.StatusUnprocessableEntity
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	lintResult := parser.LintSonicYang(schema)
	writeJSON(w, http.StatusOK, lintResult)
}

func parseUploadedFile(file io.Reader, header *multipart.FileHeader) (*models.YangSchema, error) {
	if !strings.HasSuffix(header.Filename, ".yang") {
		return nil, fmt.Errorf("file must have .yang extension")
	}

	tmpDir, err := os.MkdirTemp("", "yang-explorer-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory")
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, header.Filename)
	out, err := os.Create(tmpFile)
	if err != nil {
		return nil, fmt.Errorf("failed to save uploaded file")
	}

	if _, err := io.Copy(out, file); err != nil {
		out.Close()
		return nil, fmt.Errorf("failed to write file")
	}
	out.Close()

	return parser.ParseYangFile(tmpFile)
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
