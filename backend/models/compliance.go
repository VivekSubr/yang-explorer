package models

// ComplianceResult represents the result of a SONiC YANG compliance check
type ComplianceResult struct {
	Compliant   bool              `json:"compliant"`
	Score       int               `json:"score"`       // 0-100
	Summary     string            `json:"summary"`
	Checks      []ComplianceCheck `json:"checks"`
}

// ComplianceCheck represents a single compliance rule evaluation
type ComplianceCheck struct {
	Rule        string `json:"rule"`
	Category    string `json:"category"` // naming, structure, types, metadata, sonic-extension
	Status      string `json:"status"`   // pass, fail, warning
	Message     string `json:"message"`
	Path        string `json:"path,omitempty"`
}
