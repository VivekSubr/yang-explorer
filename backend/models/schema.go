package models

// YangSchema represents the top-level parsed YANG schema
type YangSchema struct {
	Module      string       `json:"module"`
	Namespace   string       `json:"namespace,omitempty"`
	Prefix      string       `json:"prefix,omitempty"`
	Description string       `json:"description,omitempty"`
	Revision    string       `json:"revision,omitempty"`
	Organization string      `json:"organization,omitempty"`
	Contact     string       `json:"contact,omitempty"`
	Children    []SchemaNode `json:"children"`
}

// SchemaNode represents a single node in the YANG schema tree
type SchemaNode struct {
	Name        string       `json:"name"`
	Kind        string       `json:"kind"` // container, list, leaf, leaf-list, choice, case, module, uses, grouping, rpc, input, output, notification, augment, typedef, identity, anyxml, anydata
	Path        string       `json:"path"`
	Description string       `json:"description,omitempty"`
	Type        *YangType    `json:"type,omitempty"`
	Config      *bool        `json:"config,omitempty"`
	Mandatory   bool         `json:"mandatory,omitempty"`
	Key         string       `json:"key,omitempty"`
	Default     string       `json:"default,omitempty"`
	Status      string       `json:"status,omitempty"`
	MinElements *uint64      `json:"minElements,omitempty"`
	MaxElements *uint64      `json:"maxElements,omitempty"`
	When        string       `json:"when,omitempty"`
	IfFeature   []string     `json:"ifFeature,omitempty"`
	Children    []SchemaNode `json:"children,omitempty"`
}

// YangType represents a YANG type with its constraints
type YangType struct {
	Name       string      `json:"name"`
	Base       string      `json:"base,omitempty"`
	Pattern    string      `json:"pattern,omitempty"`
	Range      string      `json:"range,omitempty"`
	Length     string      `json:"length,omitempty"`
	Enums      []EnumValue `json:"enums,omitempty"`
	Path       string      `json:"path,omitempty"` // for leafref
	UnionTypes []YangType  `json:"unionTypes,omitempty"`
}

// EnumValue represents a YANG enum value
type EnumValue struct {
	Name        string `json:"name"`
	Value       *int64 `json:"value,omitempty"`
	Description string `json:"description,omitempty"`
}
