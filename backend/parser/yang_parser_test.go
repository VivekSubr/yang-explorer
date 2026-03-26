package parser

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestParseYangFile(t *testing.T) {
	schema, err := ParseYangFile("../testdata/example-system.yang")
	if err != nil {
		t.Fatalf("Failed to parse YANG file: %v", err)
	}

	if schema.Module != "example-system" {
		t.Errorf("Expected module name 'example-system', got '%s'", schema.Module)
	}

	if schema.Namespace != "http://example.com/system" {
		t.Errorf("Expected namespace 'http://example.com/system', got '%s'", schema.Namespace)
	}

	if schema.Prefix != "sys" {
		t.Errorf("Expected prefix 'sys', got '%s'", schema.Prefix)
	}

	if schema.Revision != "2024-01-15" {
		t.Errorf("Expected revision '2024-01-15', got '%s'", schema.Revision)
	}

	if len(schema.Children) == 0 {
		t.Fatal("Expected children nodes, got none")
	}

	// Print the schema as JSON for visual verification
	data, _ := json.MarshalIndent(schema, "", "  ")
	fmt.Fprintf(os.Stdout, "Parsed schema:\n%s\n", string(data))

	// Verify specific children exist
	childNames := make(map[string]bool)
	for _, child := range schema.Children {
		childNames[child.Name] = true
		t.Logf("Top-level child: %s (kind: %s)", child.Name, child.Kind)
	}

	if !childNames["system"] {
		t.Error("Expected 'system' container in children")
	}
	if !childNames["interfaces"] {
		t.Error("Expected 'interfaces' container in children")
	}
}

func TestParseYangContent(t *testing.T) {
	content := `
module test-simple {
    namespace "http://test.com/simple";
    prefix ts;

    description "A simple test module.";

    revision 2024-01-01 {
        description "Initial.";
    }

    container config {
        leaf name {
            type string;
            description "Device name.";
        }

        leaf enabled {
            type boolean;
            default "true";
        }
    }
}
`
	schema, err := ParseYangContent(content, "test-simple.yang")
	if err != nil {
		t.Fatalf("Failed to parse YANG content: %v", err)
	}

	if schema.Module != "test-simple" {
		t.Errorf("Expected module 'test-simple', got '%s'", schema.Module)
	}

	if len(schema.Children) == 0 {
		t.Fatal("Expected children, got none")
	}

	// Find the config container
	var configNode *struct{ name string }
	for _, child := range schema.Children {
		if child.Name == "config" {
			if child.Kind != "container" {
				t.Errorf("Expected 'config' to be container, got '%s'", child.Kind)
			}
			if len(child.Children) == 0 {
				t.Error("Expected 'config' to have children")
			}
			_ = configNode
			break
		}
	}
}
