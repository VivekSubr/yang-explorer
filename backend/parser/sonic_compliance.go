package parser

import (
	"fmt"
	"strings"

	"yang-explorer/models"
)

// CheckSonicCompliance validates a parsed YANG schema against SONiC conventions
func CheckSonicCompliance(schema *models.YangSchema) *models.ComplianceResult {
	var checks []models.ComplianceCheck

	// Metadata checks
	checks = append(checks, checkModuleNaming(schema)...)
	checks = append(checks, checkMetadata(schema)...)

	// Structural checks on children
	for _, child := range schema.Children {
		checks = append(checks, checkNodeStructure(child, "")...)
	}

	// Compute score
	passed, total := 0, len(checks)
	for _, c := range checks {
		if c.Status == "pass" {
			passed++
		}
	}

	score := 0
	if total > 0 {
		score = (passed * 100) / total
	}

	compliant := score >= 70 && !hasFailure(checks)

	summary := fmt.Sprintf("%d/%d checks passed (score: %d%%)", passed, total, score)
	if compliant {
		summary += " — SONiC compliant"
	} else {
		summary += " — not SONiC compliant"
	}

	return &models.ComplianceResult{
		Compliant: compliant,
		Score:     score,
		Summary:   summary,
		Checks:    checks,
	}
}

func hasFailure(checks []models.ComplianceCheck) bool {
	for _, c := range checks {
		if c.Status == "fail" {
			return true
		}
	}
	return false
}

// --- Module-level checks ---

func checkModuleNaming(schema *models.YangSchema) []models.ComplianceCheck {
	var checks []models.ComplianceCheck

	// SONiC YANG modules should use lowercase with hyphens
	if strings.ToLower(schema.Module) != schema.Module {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "module-lowercase",
			Category: "naming",
			Status:   "fail",
			Message:  fmt.Sprintf("Module name '%s' should be lowercase", schema.Module),
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "module-lowercase",
			Category: "naming",
			Status:   "pass",
			Message:  "Module name is lowercase",
		})
	}

	if strings.Contains(schema.Module, "_") {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "module-hyphen-separator",
			Category: "naming",
			Status:   "fail",
			Message:  "Module name should use hyphens, not underscores",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "module-hyphen-separator",
			Category: "naming",
			Status:   "pass",
			Message:  "Module name uses hyphens as separators",
		})
	}

	// SONiC modules conventionally start with "sonic-"
	if strings.HasPrefix(schema.Module, "sonic-") {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "sonic-prefix",
			Category: "naming",
			Status:   "pass",
			Message:  "Module has 'sonic-' prefix",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "sonic-prefix",
			Category: "naming",
			Status:   "warning",
			Message:  fmt.Sprintf("Module '%s' does not have 'sonic-' prefix (expected for SONiC YANG models)", schema.Module),
		})
	}

	return checks
}

func checkMetadata(schema *models.YangSchema) []models.ComplianceCheck {
	var checks []models.ComplianceCheck

	// Namespace
	if schema.Namespace == "" {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "namespace-present",
			Category: "metadata",
			Status:   "fail",
			Message:  "Module must have a namespace",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "namespace-present",
			Category: "metadata",
			Status:   "pass",
			Message:  fmt.Sprintf("Namespace defined: %s", schema.Namespace),
		})
	}

	// Prefix
	if schema.Prefix == "" {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "prefix-present",
			Category: "metadata",
			Status:   "fail",
			Message:  "Module must have a prefix",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "prefix-present",
			Category: "metadata",
			Status:   "pass",
			Message:  fmt.Sprintf("Prefix defined: %s", schema.Prefix),
		})
	}

	// Revision
	if schema.Revision == "" {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "revision-present",
			Category: "metadata",
			Status:   "fail",
			Message:  "Module must have at least one revision statement",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "revision-present",
			Category: "metadata",
			Status:   "pass",
			Message:  fmt.Sprintf("Revision present: %s", schema.Revision),
		})
	}

	// Description
	if schema.Description == "" {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "description-present",
			Category: "metadata",
			Status:   "warning",
			Message:  "Module should have a description",
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "description-present",
			Category: "metadata",
			Status:   "pass",
			Message:  "Module has a description",
		})
	}

	return checks
}

// --- Node-level structural checks ---

func checkNodeStructure(node models.SchemaNode, parentPath string) []models.ComplianceCheck {
	var checks []models.ComplianceCheck
	path := parentPath + "/" + node.Name

	// SONiC top-level containers should match a known table pattern
	if parentPath == "" && node.Kind == "container" {
		checks = append(checks, checkTopLevelContainer(node, path)...)
	}

	// Lists must have keys
	if node.Kind == "list" {
		if node.Key == "" {
			checks = append(checks, models.ComplianceCheck{
				Rule:     "list-has-key",
				Category: "structure",
				Status:   "fail",
				Message:  fmt.Sprintf("List '%s' must define a key", node.Name),
				Path:     path,
			})
		} else {
			checks = append(checks, models.ComplianceCheck{
				Rule:     "list-has-key",
				Category: "structure",
				Status:   "pass",
				Message:  fmt.Sprintf("List '%s' has key: %s", node.Name, node.Key),
				Path:     path,
			})
		}
	}

	// Leaf nodes should have descriptions
	if node.Kind == "leaf" || node.Kind == "leaf-list" {
		if node.Description == "" {
			checks = append(checks, models.ComplianceCheck{
				Rule:     "leaf-description",
				Category: "metadata",
				Status:   "warning",
				Message:  fmt.Sprintf("Leaf '%s' should have a description", node.Name),
				Path:     path,
			})
		}
	}

	// Leaf nodes should have a type
	if node.Kind == "leaf" && node.Type == nil {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "leaf-has-type",
			Category: "types",
			Status:   "fail",
			Message:  fmt.Sprintf("Leaf '%s' must have a type definition", node.Name),
			Path:     path,
		})
	}

	// Node name conventions
	if strings.ToLower(node.Name) != node.Name {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "node-lowercase",
			Category: "naming",
			Status:   "fail",
			Message:  fmt.Sprintf("Node name '%s' should be lowercase", node.Name),
			Path:     path,
		})
	}

	if strings.Contains(node.Name, "_") {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "node-hyphen-separator",
			Category: "naming",
			Status:   "warning",
			Message:  fmt.Sprintf("Node '%s' uses underscores; hyphens are preferred in YANG", node.Name),
			Path:     path,
		})
	}

	// Recurse into children
	for _, child := range node.Children {
		checks = append(checks, checkNodeStructure(child, path)...)
	}

	return checks
}

func checkTopLevelContainer(node models.SchemaNode, path string) []models.ComplianceCheck {
	var checks []models.ComplianceCheck

	// SONiC YANG convention: top-level container should typically represent
	// a SONiC DB table with a matching _TABLE or _LIST pattern inside
	hasListChild := false
	for _, child := range node.Children {
		if child.Kind == "list" {
			hasListChild = true
			break
		}
	}

	if hasListChild {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "container-has-list",
			Category: "sonic-extension",
			Status:   "pass",
			Message:  fmt.Sprintf("Container '%s' has list children (maps to SONiC DB table entries)", node.Name),
			Path:     path,
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "container-has-list",
			Category: "sonic-extension",
			Status:   "warning",
			Message:  fmt.Sprintf("Container '%s' has no list children; SONiC tables typically contain keyed lists", node.Name),
			Path:     path,
		})
	}

	// Check for config true (SONiC config DB tables are writable)
	if node.Config != nil && *node.Config == false {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "top-container-configurable",
			Category: "sonic-extension",
			Status:   "warning",
			Message:  fmt.Sprintf("Container '%s' is read-only; SONiC config DB tables are typically config true", node.Name),
			Path:     path,
		})
	} else {
		checks = append(checks, models.ComplianceCheck{
			Rule:     "top-container-configurable",
			Category: "sonic-extension",
			Status:   "pass",
			Message:  fmt.Sprintf("Container '%s' is configurable", node.Name),
			Path:     path,
		})
	}

	return checks
}
