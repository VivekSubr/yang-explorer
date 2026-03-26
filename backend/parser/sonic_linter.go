package parser

import (
	"fmt"
	"strings"

	"yang-explorer/models"
)

// LintSonicYang validates a parsed YANG schema against SONiC YANG Model Guidelines.
// Reference: https://github.com/sonic-net/SONiC/blob/master/doc/mgmt/SONiC_YANG_Model_Guidelines.md
func LintSonicYang(schema *models.YangSchema) *models.LintResult {
	var issues []models.LintIssue

	issues = append(issues, lintGuideline1(schema)...)
	issues = append(issues, lintGuideline2(schema)...)
	issues = append(issues, lintGuideline3(schema)...)
	issues = append(issues, lintGuideline4(schema)...)
	issues = append(issues, lintGuideline5And17(schema)...)
	issues = append(issues, lintGuideline9(schema)...)
	issues = append(issues, lintGuideline14(schema)...)
	issues = append(issues, lintGuideline16(schema)...)
	issues = append(issues, lintGuideline18(schema)...)
	issues = append(issues, lintGuideline19(schema)...)

	errors := 0
	for _, i := range issues {
		if i.Severity == "error" {
			errors++
		}
	}

	total := len(issues)
	passed := total - errors
	score := 100
	if total > 0 {
		score = (passed * 100) / total
	}

	summary := fmt.Sprintf("%d issues found (%d errors, %d warnings/info)",
		total, errors, total-errors)

	return &models.LintResult{
		Score:   score,
		Summary: summary,
		Issues:  issues,
	}
}

// Guideline 1: File named sonic-{feature}.yang, module named sonic-{feature}
func lintGuideline1(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue

	if !strings.HasPrefix(schema.Module, "sonic-") {
		issues = append(issues, models.LintIssue{
			Rule:       "module-sonic-prefix",
			Guideline:  1,
			Severity:   "error",
			Message:    fmt.Sprintf("Module name '%s' must start with 'sonic-'", schema.Module),
			Suggestion: fmt.Sprintf("Rename to 'sonic-%s'", strings.TrimPrefix(schema.Module, "sonic-")),
		})
	}

	return issues
}

// Guideline 2: Top-level container named same as module
func lintGuideline2(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue

	hasTopContainer := false
	for _, child := range schema.Children {
		if child.Kind == "container" && child.Name == schema.Module {
			hasTopContainer = true
			break
		}
	}

	if !hasTopContainer {
		issues = append(issues, models.LintIssue{
			Rule:       "top-container-matches-module",
			Guideline:  2,
			Severity:   "error",
			Message:    fmt.Sprintf("Must have a top-level container named '%s' (same as module name)", schema.Module),
			Suggestion: fmt.Sprintf("Add 'container %s { ... }' as the top-level container", schema.Module),
		})
	}

	return issues
}

// Guideline 3: Namespace should be http://github.com/sonic-net/{model-name}
func lintGuideline3(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue

	expectedNS := "http://github.com/sonic-net/" + schema.Module

	if schema.Namespace == "" {
		issues = append(issues, models.LintIssue{
			Rule:       "namespace-format",
			Guideline:  3,
			Severity:   "error",
			Message:    "Namespace is missing",
			Suggestion: fmt.Sprintf("Set namespace to '%s'", expectedNS),
		})
	} else if schema.Namespace != expectedNS {
		issues = append(issues, models.LintIssue{
			Rule:       "namespace-format",
			Guideline:  3,
			Severity:   "warning",
			Message:    fmt.Sprintf("Namespace '%s' should be '%s'", schema.Namespace, expectedNS),
			Suggestion: fmt.Sprintf("Change namespace to '%s'", expectedNS),
		})
	}

	return issues
}

// Guideline 4: Must have revision statements
func lintGuideline4(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue

	if schema.Revision == "" {
		issues = append(issues, models.LintIssue{
			Rule:       "revision-present",
			Guideline:  4,
			Severity:   "error",
			Message:    "Module must have at least one 'revision' statement",
			Suggestion: "Add a revision statement with date and description",
		})
	}

	return issues
}

// Guidelines 5 & 17: Each table maps to a container with a LIST inside named {TABLE}_LIST
func lintGuideline5And17(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue

	// Find the top-level sonic container
	var topContainer *models.SchemaNode
	for i := range schema.Children {
		if schema.Children[i].Kind == "container" && schema.Children[i].Name == schema.Module {
			topContainer = &schema.Children[i]
			break
		}
	}

	if topContainer == nil {
		return issues
	}

	for _, child := range topContainer.Children {
		path := "/" + schema.Module + "/" + child.Name

		if child.Kind == "container" {
			// Each table container should have a list named {CONTAINER}_LIST
			expectedListName := child.Name + "_LIST"
			hasExpectedList := false
			for _, grandchild := range child.Children {
				if grandchild.Kind == "list" && grandchild.Name == expectedListName {
					hasExpectedList = true
					break
				}
			}

			if !hasExpectedList {
				// Check if there's any list at all
				hasAnyList := false
				for _, grandchild := range child.Children {
					if grandchild.Kind == "list" {
						hasAnyList = true
						break
					}
				}

				if hasAnyList {
					issues = append(issues, models.LintIssue{
						Rule:       "table-list-naming",
						Guideline:  17,
						Severity:   "warning",
						Message:    fmt.Sprintf("Container '%s' should contain a list named '%s'", child.Name, expectedListName),
						Path:       path,
						Suggestion: fmt.Sprintf("Rename the list inside '%s' to '%s'", child.Name, expectedListName),
					})
				} else {
					issues = append(issues, models.LintIssue{
						Rule:       "table-has-list",
						Guideline:  5,
						Severity:   "warning",
						Message:    fmt.Sprintf("Table container '%s' should contain a list (representing table entries)", child.Name),
						Path:       path,
						Suggestion: fmt.Sprintf("Add 'list %s { key ...; ... }' inside container '%s'", expectedListName, child.Name),
					})
				}
			}
		}
	}

	return issues
}

// Guideline 9: Keys in YANG must match ABNF keys; all lists must have keys
func lintGuideline9(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue
	checkListKeys(schema.Children, "", &issues)
	return issues
}

func checkListKeys(nodes []models.SchemaNode, parentPath string, issues *[]models.LintIssue) {
	for _, node := range nodes {
		path := parentPath + "/" + node.Name

		if node.Kind == "list" {
			if node.Key == "" {
				*issues = append(*issues, models.LintIssue{
					Rule:       "list-must-have-key",
					Guideline:  9,
					Severity:   "error",
					Message:    fmt.Sprintf("List '%s' must define a key", node.Name),
					Path:       path,
					Suggestion: "Add a 'key' statement to this list",
				})
			} else {
				// Verify key leaves exist as children
				keys := strings.Fields(node.Key)
				for _, k := range keys {
					found := false
					for _, child := range node.Children {
						if child.Name == k {
							found = true
							break
						}
					}
					if !found {
						*issues = append(*issues, models.LintIssue{
							Rule:       "key-leaf-exists",
							Guideline:  9,
							Severity:   "error",
							Message:    fmt.Sprintf("Key leaf '%s' declared in list '%s' but not found as child leaf", k, node.Name),
							Path:       path,
							Suggestion: fmt.Sprintf("Add 'leaf %s { type ...; }' to this list", k),
						})
					}
				}
			}
		}

		checkListKeys(node.Children, path, issues)
	}
}

// Guideline 14: Constraints (range, pattern, length) should have error-message/error-app-tag
func lintGuideline14(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue
	checkConstraintMessages(schema.Children, "", &issues)
	return issues
}

func checkConstraintMessages(nodes []models.SchemaNode, parentPath string, issues *[]models.LintIssue) {
	for _, node := range nodes {
		path := parentPath + "/" + node.Name

		if node.Type != nil {
			if node.Type.Range != "" || node.Type.Pattern != "" || node.Type.Length != "" {
				// We can't check for error-message from the parsed schema alone,
				// but we flag it as an info-level reminder
				*issues = append(*issues, models.LintIssue{
					Rule:       "constraint-error-message",
					Guideline:  14,
					Severity:   "info",
					Message:    fmt.Sprintf("Leaf '%s' has constraints — ensure error-message and error-app-tag are defined", node.Name),
					Path:       path,
					Suggestion: "Add error-message and error-app-tag to range/pattern/length statements",
				})
			}
		}

		checkConstraintMessages(node.Children, path, issues)
	}
}

// Guideline 16: Must/when/pattern conditions should be commented
// We can only check for descriptions on nodes that have constraints
func lintGuideline16(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue
	checkConstraintComments(schema.Children, "", &issues)
	return issues
}

func checkConstraintComments(nodes []models.SchemaNode, parentPath string, issues *[]models.LintIssue) {
	for _, node := range nodes {
		path := parentPath + "/" + node.Name

		hasConstraint := false
		if node.Type != nil && (node.Type.Range != "" || node.Type.Pattern != "" || node.Type.Length != "") {
			hasConstraint = true
		}

		if hasConstraint && node.Description == "" {
			*issues = append(*issues, models.LintIssue{
				Rule:       "constraint-documented",
				Guideline:  16,
				Severity:   "warning",
				Message:    fmt.Sprintf("Leaf '%s' has constraints but no description/comment", node.Name),
				Path:       path,
				Suggestion: "Add a description or comment explaining the constraint",
			})
		}

		checkConstraintComments(node.Children, path, issues)
	}
}

// Guideline 18: Multiple lists in same container must have non-overlapping keys
func lintGuideline18(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue
	checkOverlappingKeys(schema.Children, "", &issues)
	return issues
}

func checkOverlappingKeys(nodes []models.SchemaNode, parentPath string, issues *[]models.LintIssue) {
	for _, node := range nodes {
		path := parentPath + "/" + node.Name

		if node.Kind == "container" && len(node.Children) > 1 {
			// Collect all lists in this container
			type listInfo struct {
				name     string
				keyCount int
				keys     string
			}
			var lists []listInfo
			for _, child := range node.Children {
				if child.Kind == "list" && child.Key != "" {
					keyFields := strings.Fields(child.Key)
					lists = append(lists, listInfo{
						name:     child.Name,
						keyCount: len(keyFields),
						keys:     child.Key,
					})
				}
			}

			// Check for overlapping key counts (same number of keys = potential overlap)
			for i := 0; i < len(lists); i++ {
				for j := i + 1; j < len(lists); j++ {
					if lists[i].keyCount == lists[j].keyCount {
						*issues = append(*issues, models.LintIssue{
							Rule:       "non-overlapping-keys",
							Guideline:  18,
							Severity:   "warning",
							Message:    fmt.Sprintf("Lists '%s' and '%s' have same number of key elements (%d) — keys may overlap", lists[i].name, lists[j].name, lists[i].keyCount),
							Path:       path,
							Suggestion: "Use composite keys with different number of elements to distinguish lists",
						})
					}
				}
			}
		}

		checkOverlappingKeys(node.Children, path, issues)
	}
}

// Guideline 19: State data should use 'config false'
func lintGuideline19(schema *models.YangSchema) []models.LintIssue {
	var issues []models.LintIssue
	checkStateData(schema.Children, "", &issues)
	return issues
}

func checkStateData(nodes []models.SchemaNode, parentPath string, issues *[]models.LintIssue) {
	for _, node := range nodes {
		path := parentPath + "/" + node.Name

		// Container named "state" should have config false
		if node.Kind == "container" && node.Name == "state" {
			if node.Config == nil || *node.Config != false {
				*issues = append(*issues, models.LintIssue{
					Rule:       "state-container-readonly",
					Guideline:  19,
					Severity:   "warning",
					Message:    fmt.Sprintf("Container 'state' at '%s' should have 'config false'", path),
					Path:       path,
					Suggestion: "Add 'config false;' to state data containers",
				})
			}
		}

		checkStateData(node.Children, path, issues)
	}
}
