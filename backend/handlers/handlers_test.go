package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleYANG = `
module test-handler {
    namespace "http://test.com/handler";
    prefix th;
    description "A test module for handler tests.";
    revision 2024-06-01 {
        description "Initial.";
    }
    container config {
        leaf name {
            type string;
            description "Device name.";
        }
    }
}
`

// --- extractYangSchema tests ---

func TestExtractYangSchema_JSONContent(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: sampleYANG, Filename: "test.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "test-handler" {
		t.Errorf("expected module 'test-handler', got '%s'", schema.Module)
	}
	if schema.Namespace != "http://test.com/handler" {
		t.Errorf("expected namespace 'http://test.com/handler', got '%s'", schema.Namespace)
	}
}

func TestExtractYangSchema_JSONContentDefaultFilename(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: sampleYANG})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "test-handler" {
		t.Errorf("expected module 'test-handler', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_JSONFilepath(t *testing.T) {
	absPath, _ := filepath.Abs("../testdata/example-system.yang")
	body, _ := json.Marshal(jsonInput{Filepath: absPath})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "example-system" {
		t.Errorf("expected module 'example-system', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_JSONFilepathRelative(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Filepath: "../testdata/example-system.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "example-system" {
		t.Errorf("expected module 'example-system', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_JSONFilepathNotFound(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Filepath: "/nonexistent/path.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	_, err := extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for nonexistent file")
	}
	if !strings.Contains(err.Error(), "file not found") {
		t.Errorf("expected 'file not found' error, got: %v", err)
	}
}

func TestExtractYangSchema_JSONEmpty(t *testing.T) {
	body, _ := json.Marshal(jsonInput{})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	_, err := extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for empty JSON")
	}
	if !strings.Contains(err.Error(), "must include") {
		t.Errorf("expected 'must include' error, got: %v", err)
	}
}

func TestExtractYangSchema_JSONInvalid(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", strings.NewReader("{bad json"))
	req.Header.Set("Content-Type", "application/json")

	_, err := extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
	if !strings.Contains(err.Error(), "invalid JSON") {
		t.Errorf("expected 'invalid JSON' error, got: %v", err)
	}
}

func TestExtractYangSchema_MultipartUpload(t *testing.T) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("yangFile", "test.yang")
	if err != nil {
		t.Fatal(err)
	}
	part.Write([]byte(sampleYANG))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "test-handler" {
		t.Errorf("expected module 'test-handler', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_MultipartNonYangExtension(t *testing.T) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("yangFile", "test.txt")
	if err != nil {
		t.Fatal(err)
	}
	part.Write([]byte(sampleYANG))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	_, err = extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for non-.yang file")
	}
	if !strings.Contains(err.Error(), ".yang extension") {
		t.Errorf("expected '.yang extension' error, got: %v", err)
	}
}

func TestExtractYangSchema_RawBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", strings.NewReader(sampleYANG))
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("X-Filename", "raw.yang")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "test-handler" {
		t.Errorf("expected module 'test-handler', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_RawBodyDefaultFilename(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", strings.NewReader(sampleYANG))
	req.Header.Set("Content-Type", "text/plain")

	schema, err := extractYangSchema(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if schema.Module != "test-handler" {
		t.Errorf("expected module 'test-handler', got '%s'", schema.Module)
	}
}

func TestExtractYangSchema_EmptyBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", strings.NewReader(""))
	req.Header.Set("Content-Type", "text/plain")

	_, err := extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for empty body")
	}
}

func TestExtractYangSchema_InvalidYangContent(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: "this is not valid yang", Filename: "bad.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	_, err := extractYangSchema(req)
	if err == nil {
		t.Fatal("expected error for invalid YANG content")
	}
}

// --- Handler HTTP tests ---

func TestParseYangHandler_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/yang/parse", nil)
	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestParseYangHandler_JSONContent(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: sampleYANG, Filename: "test.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)
	if result["module"] != "test-handler" {
		t.Errorf("expected module 'test-handler', got %v", result["module"])
	}
}

func TestParseYangHandler_JSONFilepath(t *testing.T) {
	absPath, _ := filepath.Abs("../testdata/example-system.yang")
	body, _ := json.Marshal(jsonInput{Filepath: absPath})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)
	if result["module"] != "example-system" {
		t.Errorf("expected module 'example-system', got %v", result["module"])
	}
}

func TestParseYangHandler_MultipartUpload(t *testing.T) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, _ := writer.CreateFormFile("yangFile", "test.yang")
	part.Write([]byte(sampleYANG))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestParseYangHandler_BadInput(t *testing.T) {
	body, _ := json.Marshal(jsonInput{})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestParseYangHandler_InvalidYang(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: "not yang at all", Filename: "bad.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	// Should be 422 (Unprocessable Entity) or 400
	if w.Code != http.StatusUnprocessableEntity && w.Code != http.StatusBadRequest {
		t.Errorf("expected 422 or 400, got %d", w.Code)
	}
}

func TestSonicComplianceHandler_JSONContent(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: sampleYANG, Filename: "test.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/sonic-compliance", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	SonicComplianceHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)
	if _, ok := result["compliant"]; !ok {
		t.Error("expected 'compliant' field in response")
	}
	if _, ok := result["score"]; !ok {
		t.Error("expected 'score' field in response")
	}
	if _, ok := result["checks"]; !ok {
		t.Error("expected 'checks' field in response")
	}
}

func TestSonicComplianceHandler_JSONFilepath(t *testing.T) {
	absPath, _ := filepath.Abs("../testdata/example-system.yang")
	body, _ := json.Marshal(jsonInput{Filepath: absPath})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/sonic-compliance", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	SonicComplianceHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSonicComplianceHandler_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/yang/sonic-compliance", nil)
	w := httptest.NewRecorder()
	SonicComplianceHandler(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

func TestSonicLintHandler_JSONContent(t *testing.T) {
	body, _ := json.Marshal(jsonInput{Content: sampleYANG, Filename: "test.yang"})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/sonic-lint", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	SonicLintHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)
	if _, ok := result["score"]; !ok {
		t.Error("expected 'score' field in response")
	}
	if _, ok := result["issues"]; !ok {
		t.Error("expected 'issues' field in response")
	}
}

func TestSonicLintHandler_JSONFilepath(t *testing.T) {
	absPath, _ := filepath.Abs("../testdata/example-system.yang")
	body, _ := json.Marshal(jsonInput{Filepath: absPath})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/sonic-lint", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	SonicLintHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSonicLintHandler_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/yang/sonic-lint", nil)
	w := httptest.NewRecorder()
	SonicLintHandler(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// --- CORS middleware test ---

func TestCORSMiddleware(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := CORSMiddleware(inner)

	// Normal request should have CORS headers
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("expected Access-Control-Allow-Origin: *")
	}
	if !strings.Contains(w.Header().Get("Access-Control-Allow-Headers"), "Content-Type") {
		t.Error("expected Content-Type in allowed headers")
	}

	// Preflight OPTIONS should return 200 without calling inner handler
	req = httptest.NewRequest(http.MethodOptions, "/", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS, got %d", w.Code)
	}
}

// --- Integration: filepath reads file with correct includes ---

func TestParseYangHandler_FilepathWithExampleSystem(t *testing.T) {
	absPath, _ := filepath.Abs("../testdata/example-system.yang")
	if _, err := os.Stat(absPath); err != nil {
		t.Skipf("test file not found: %s", absPath)
	}

	body, _ := json.Marshal(jsonInput{Filepath: absPath})
	req := httptest.NewRequest(http.MethodPost, "/api/yang/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	ParseYangHandler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var result map[string]interface{}
	json.NewDecoder(w.Body).Decode(&result)

	if result["module"] != "example-system" {
		t.Errorf("expected module 'example-system', got %v", result["module"])
	}

	children, ok := result["children"].([]interface{})
	if !ok || len(children) == 0 {
		t.Fatal("expected children in parsed schema")
	}

	// Verify top-level containers
	names := make(map[string]bool)
	for _, c := range children {
		if m, ok := c.(map[string]interface{}); ok {
			if name, ok := m["name"].(string); ok {
				names[name] = true
			}
		}
	}
	if !names["system"] {
		t.Error("expected 'system' container")
	}
	if !names["interfaces"] {
		t.Error("expected 'interfaces' container")
	}
}

// --- writeJSON test ---

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"msg": "hello"})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %s", ct)
	}

	body, _ := io.ReadAll(w.Body)
	var result map[string]string
	json.Unmarshal(body, &result)
	if result["msg"] != "hello" {
		t.Errorf("expected 'hello', got '%s'", result["msg"])
	}
}
