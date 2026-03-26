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

// ParseYangHandler handles YANG file upload and parsing
func ParseYangHandler(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
return
}

r.ParseMultipartForm(10 << 20)

file, header, err := r.FormFile("yangFile")
if err != nil {
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

schema, err := parseUploadedFile(file, header)
if err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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

r.ParseMultipartForm(10 << 20)

file, header, err := r.FormFile("yangFile")
if err != nil {
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

result := parser.CheckSonicCompliance(schema)
writeJSON(w, http.StatusOK, result)
return
}
defer file.Close()

schema, err := parseUploadedFile(file, header)
if err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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

	r.ParseMultipartForm(10 << 20)

	file, header, err := r.FormFile("yangFile")
	if err != nil {
		body, readErr := io.ReadAll(r.Body)
		if readErr != nil || len(body) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "No YANG file provided.",
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

		lintResult := parser.LintSonicYang(schema)
		writeJSON(w, http.StatusOK, lintResult)
		return
	}
	defer file.Close()

	schema, err := parseUploadedFile(file, header)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
