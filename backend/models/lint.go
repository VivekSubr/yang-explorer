package models

// LintResult represents the full linting output
type LintResult struct {
	Score    int        `json:"score"`    // 0-100
	Summary  string    `json:"summary"`
	Issues   []LintIssue `json:"issues"`
}

// LintIssue represents a single lint finding
type LintIssue struct {
	Rule        string `json:"rule"`
	Guideline   int    `json:"guideline"` // SONiC guideline number (1-21)
	Severity    string `json:"severity"`  // error, warning, info
	Message     string `json:"message"`
	Path        string `json:"path,omitempty"`
	Suggestion  string `json:"suggestion,omitempty"`
}
