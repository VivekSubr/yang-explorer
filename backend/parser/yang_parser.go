package parser

import (
"fmt"
"path/filepath"
"strings"

"github.com/openconfig/goyang/pkg/yang"
"yang-explorer/models"
)

func valueStr(v *yang.Value) string {
if v == nil {
return ""
}
return v.Name
}

// ParseYangFile parses a YANG file and returns the schema representation
func ParseYangFile(filePath string) (*models.YangSchema, error) {
ms := yang.NewModules()
dir := filepath.Dir(filePath)
ms.Path = append(ms.Path, dir)

if err := ms.Read(filePath); err != nil {
return nil, fmt.Errorf("failed to read YANG file: %w", err)
}

errs := ms.Process()
if len(errs) > 0 {
var errMsgs []string
for _, e := range errs {
errMsgs = append(errMsgs, e.Error())
}
return nil, fmt.Errorf("YANG processing errors: %s", strings.Join(errMsgs, "; "))
}

return extractSchema(ms)
}

// ParseYangContent parses YANG content from a string
func ParseYangContent(content string, filename string) (*models.YangSchema, error) {
ms := yang.NewModules()

if err := ms.Parse(content, filename); err != nil {
return nil, fmt.Errorf("failed to parse YANG: %w", err)
}

errs := ms.Process()
if len(errs) > 0 {
var errMsgs []string
for _, e := range errs {
errMsgs = append(errMsgs, e.Error())
}
return nil, fmt.Errorf("YANG processing errors: %s", strings.Join(errMsgs, "; "))
}

return extractSchema(ms)
}

func extractSchema(ms *yang.Modules) (*models.YangSchema, error) {
var module *yang.Module
for _, m := range ms.Modules {
if !isBuiltinModule(m.Name) {
module = m
break
}
}
if module == nil {
return nil, fmt.Errorf("no module found")
}

schema := &models.YangSchema{
Module:       module.Name,
Namespace:    valueStr(module.Namespace),
Prefix:       valueStr(module.Prefix),
Description:  valueStr(module.Description),
Organization: valueStr(module.Organization),
Contact:      valueStr(module.Contact),
}

if len(module.Revision) > 0 {
schema.Revision = module.Revision[0].Name
}

// Convert AST Module to Entry tree
entry := yang.ToEntry(module)
if entry != nil && entry.Dir != nil {
schema.Children = convertEntries(entry.Dir, "/"+module.Name)
}

return schema, nil
}

func convertEntries(dir map[string]*yang.Entry, parentPath string) []models.SchemaNode {
if dir == nil {
return nil
}

var nodes []models.SchemaNode
for name, entry := range dir {
node := convertEntry(entry, parentPath+"/"+name)
nodes = append(nodes, node)
}
return nodes
}

func convertEntry(entry *yang.Entry, path string) models.SchemaNode {
node := models.SchemaNode{
Name:        entry.Name,
Kind:        entryKind(entry),
Path:        path,
Description: entry.Description,
}

// Default is []string in goyang
if len(entry.Default) > 0 {
node.Default = strings.Join(entry.Default, ", ")
}

if entry.Key != "" {
node.Key = entry.Key
}

if entry.Config != yang.TSUnset {
config := entry.Config == yang.TSTrue
node.Config = &config
}

if entry.Mandatory != yang.TSUnset {
node.Mandatory = entry.Mandatory == yang.TSTrue
}

if entry.ListAttr != nil {
if entry.ListAttr.MinElements > 0 {
min := entry.ListAttr.MinElements
node.MinElements = &min
}
if entry.ListAttr.MaxElements > 0 && entry.ListAttr.MaxElements != 0xFFFFFFFFFFFFFFFF {
max := entry.ListAttr.MaxElements
node.MaxElements = &max
}
}

if entry.Type != nil {
node.Type = convertType(entry.Type)
}

node.Children = convertEntries(entry.Dir, path)

return node
}

func convertType(t *yang.YangType) *models.YangType {
yt := &models.YangType{
Name: t.Name,
}

if t.Kind != yang.Ynone {
yt.Base = t.Kind.String()
}

if t.Pattern != nil {
yt.Pattern = strings.Join(t.Pattern, "|")
}

if t.Range != nil {
yt.Range = t.Range.String()
}

if t.Length != nil {
yt.Length = t.Length.String()
}

if t.Path != "" {
yt.Path = t.Path
}

// Handle enums
if len(t.Enum.NameMap()) > 0 {
for name, val := range t.Enum.NameMap() {
v := int64(val)
yt.Enums = append(yt.Enums, models.EnumValue{
Name:  name,
Value: &v,
})
}
}

// Handle union types
if len(t.Type) > 0 {
for _, ut := range t.Type {
yt.UnionTypes = append(yt.UnionTypes, *convertType(ut))
}
}

return yt
}

func entryKind(e *yang.Entry) string {
if e.RPC != nil {
return "rpc"
}
if e.IsList() {
return "list"
}
if e.IsLeafList() {
return "leaf-list"
}
if e.IsLeaf() {
return "leaf"
}
if e.IsChoice() {
return "choice"
}
if e.IsCase() {
return "case"
}
if e.IsContainer() {
return "container"
}
if e.Dir != nil && len(e.Dir) > 0 {
return "container"
}
if e.Type != nil {
return "leaf"
}
return "container"
}

func isBuiltinModule(name string) bool {
builtins := map[string]bool{
"ietf-yang-types":    true,
"ietf-inet-types":   true,
"ietf-yang-library":  true,
"ietf-netconf":       true,
"ietf-interfaces":    true,
"ietf-yang-metadata": true,
"ietf-restconf":      true,
"ietf-datastores":    true,
"ietf-yang-patch":    true,
}
return builtins[name]
}
