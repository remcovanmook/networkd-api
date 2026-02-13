package service

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

type TypeInfo struct {
	IsArray bool
	IsBool  bool
	IsInt   bool
	IsMap   bool
}

type SchemaService struct {
	SchemaDir         string
	RealVersion       string // The detected version (e.g., "257")
	LoadedVersion     string // The schema version used (e.g., "v257")
	AvailableVersions []int
	Schemas           map[string]map[string]interface{}
	// Raw JSON bytes for each schema — preserves key ordering from the original files
	RawSchemas map[string]json.RawMessage
	// Cache for type info: configType -> Section -> Key -> TypeInfo
	TypeCache map[string]map[string]map[string]TypeInfo
	// Sections that can appear multiple times (e.g. Address, Route)
	// Derived from schema oneOf [array, object] pattern
	// configType -> set of section names
	RepeatableSections map[string]map[string]bool
	// Compiled JSON Schema validators for full validation
	Validators map[string]*jsonschema.Schema
}

func NewSchemaService(baseSchemaDir string) (*SchemaService, error) {
	// 1. Detect Real Version
	realVersionStr := "257" // Default fallback
	cmd := exec.Command("networkctl", "--version")
	out, err := cmd.Output()
	if err == nil {
		// Output format: "systemd 257 (257)" or "systemd 261-rc1"
		re := regexp.MustCompile(`systemd (\d+)`)
		matches := re.FindStringSubmatch(string(out))
		if len(matches) > 1 {
			realVersionStr = matches[1]
		}
	} else {
		// Attempt fallback if networkctl fails? Or just log
		fmt.Println("networkctl checks failed, defaulting to", realVersionStr)
	}

	realVersion, _ := strconv.Atoi(realVersionStr)

	// 2. Discover Available Schemas
	availableVersions := []int{}
	entries, err := os.ReadDir(baseSchemaDir)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() && strings.HasPrefix(entry.Name(), "v") {
				if v, err := strconv.Atoi(strings.TrimPrefix(entry.Name(), "v")); err == nil {
					availableVersions = append(availableVersions, v)
				}
			}
		}
	}
	sort.Ints(availableVersions)

	// 3. Select Schema Version
	selectedVersion := 257 // Default if no schemas found
	if len(availableVersions) > 0 {
		if realVersion < availableVersions[0] {
			// Version < Min -> Use Min
			selectedVersion = availableVersions[0]
		} else if realVersion > availableVersions[len(availableVersions)-1] {
			// Version > Max -> Use Max
			selectedVersion = availableVersions[len(availableVersions)-1]
		} else {
			// In between: Use exact match or highest version <= realVersion
			// Since we sorted, we iterate to find it.
			// Finding highest v such that v <= realVersion
			for _, v := range availableVersions {
				if v <= realVersion {
					selectedVersion = v
				} else {
					break
				}
			}
		}
	}

	selectedVersionStr := fmt.Sprintf("v%d", selectedVersion)

	s := &SchemaService{
		SchemaDir:         filepath.Join(baseSchemaDir, selectedVersionStr),
		RealVersion:       realVersionStr,
		LoadedVersion:     selectedVersionStr,
		AvailableVersions: availableVersions,
		Schemas:            make(map[string]map[string]interface{}),
		RawSchemas:         make(map[string]json.RawMessage),
		TypeCache:          make(map[string]map[string]map[string]TypeInfo),
		RepeatableSections: make(map[string]map[string]bool),
		Validators:         make(map[string]*jsonschema.Schema),
	}

	fmt.Printf("Systemd Version: %s, Selected Schema: %s\n", realVersionStr, selectedVersionStr)

	schemaFiles := map[string]string{
		"systemd.network.schema.json":       "network",
		"systemd.netdev.schema.json":        "netdev",
		"systemd.link.schema.json":          "link",
		"systemd.networkd.conf.schema.json": "networkd-conf",
	}
	for file, configType := range schemaFiles {

		schemaPath := filepath.Join(s.SchemaDir, file)
		content, err := os.ReadFile(schemaPath)
		if err != nil {
			fmt.Printf("Warning: Failed to load schema %s: %v\n", schemaPath, err)
			continue
		}

		var schemaMap map[string]interface{}
		if err := json.Unmarshal(content, &schemaMap); err != nil {
			return nil, fmt.Errorf("failed to parse schema %s: %w", file, err)
		}
		s.Schemas[configType] = schemaMap
		s.RawSchemas[configType] = json.RawMessage(content)
		s.buildTypeCache(configType, schemaMap)

		// Compile JSON Schema validator
		c := jsonschema.NewCompiler()
		if err := c.AddResource(file, schemaMap); err != nil {
			fmt.Printf("Warning: Failed to add schema resource %s: %v\n", file, err)
			continue
		}
		compiled, err := c.Compile(file)
		if err != nil {
			fmt.Printf("Warning: Failed to compile schema %s: %v\n", file, err)
			continue
		}
		s.Validators[configType] = compiled
	}

	return s, nil
}

func (s *SchemaService) buildTypeCache(configType string, schema map[string]interface{}) {
	if s.TypeCache[configType] == nil {
		s.TypeCache[configType] = make(map[string]map[string]TypeInfo)
	}
	if s.RepeatableSections[configType] == nil {
		s.RepeatableSections[configType] = make(map[string]bool)
	}

	definitions, _ := schema["definitions"].(map[string]interface{})
	properties, ok := schema["properties"].(map[string]interface{})
	if !ok {
		return
	}

	for sectionName, sectionVal := range properties {
		sectionDef, ok := sectionVal.(map[string]interface{})
		if !ok {
			continue
		}

		// Detect repeatable sections: oneOf with an array option
		if oneOf, ok := sectionDef["oneOf"].([]interface{}); ok {
			for _, v := range oneOf {
				if opt, ok := v.(map[string]interface{}); ok {
					if opt["type"] == "array" {
						s.RepeatableSections[configType][sectionName] = true
						break
					}
				}
			}
		}

		// Find the object properties within this section definition
		var findProps func(node map[string]interface{}) map[string]interface{}
		findProps = func(node map[string]interface{}) map[string]interface{} {
			if props, ok := node["properties"].(map[string]interface{}); ok {
				return props
			}
			if oneOf, ok := node["oneOf"].([]interface{}); ok {
				for _, v := range oneOf {
					if m, ok := v.(map[string]interface{}); ok {
						if res := findProps(m); res != nil {
							return res
						}
					}
				}
			}
			if items, ok := node["items"].(map[string]interface{}); ok {
				if props := findProps(items); props != nil {
					return props
				}
			}
			return nil
		}

		objectProps := findProps(sectionDef)
		if objectProps == nil {
			continue
		}

		if s.TypeCache[configType][sectionName] == nil {
			s.TypeCache[configType][sectionName] = make(map[string]TypeInfo)
		}

		for key, propVal := range objectProps {
			propDef, ok := propVal.(map[string]interface{})
			if !ok {
				continue
			}
			info := s.resolveType(propDef, definitions)
			s.TypeCache[configType][sectionName][key] = info
		}
	}
}

func (s *SchemaService) resolveType(propDef map[string]interface{}, definitions map[string]interface{}) TypeInfo {
	info := TypeInfo{}

	var analyze func(p map[string]interface{})
	analyze = func(p map[string]interface{}) {
		if ref, ok := p["$ref"].(string); ok {
			refName := strings.TrimPrefix(ref, "#/definitions/")
			if def, ok := definitions[refName].(map[string]interface{}); ok {
				analyze(def)
			}
			return
		}

		if t, ok := p["type"].(string); ok {
			if t == "boolean" {
				info.IsBool = true
			} else if t == "integer" {
				info.IsInt = true
			} else if t == "array" {
				info.IsArray = true
			} else if t == "object" {
				info.IsMap = true
			}
		}

		if oneOf, ok := p["oneOf"].([]interface{}); ok {
			for _, v := range oneOf {
				if m, ok := v.(map[string]interface{}); ok {
					analyze(m)
				}
			}
		}
		if anyOf, ok := p["anyOf"].([]interface{}); ok {
			for _, v := range anyOf {
				if m, ok := v.(map[string]interface{}); ok {
					analyze(m)
				}
			}
		}
		if allOf, ok := p["allOf"].([]interface{}); ok {
			for _, v := range allOf {
				if m, ok := v.(map[string]interface{}); ok {
					analyze(m)
				}
			}
		}
	}

	analyze(propDef)
	return info
}

func (s *SchemaService) Validate(configType string, data map[string]interface{}) error {
	if _, ok := s.Schemas[configType]; !ok {
		return fmt.Errorf("unknown config type: %s", configType)
	}

	validator, ok := s.Validators[configType]
	if !ok {
		// No compiled validator (schema failed to compile) — skip validation
		return nil
	}

	// jsonschema expects the data to go through JSON round-trip so that
	// numeric types match what the schema expects (e.g. float64 from JSON).
	raw, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	var normalized interface{}
	if err := json.Unmarshal(raw, &normalized); err != nil {
		return fmt.Errorf("failed to normalize config: %w", err)
	}

	return validator.Validate(normalized)
}

func (s *SchemaService) ResolveSchemaVersion(targetVersionStr string) string {
	// Parse target version (handle Suffixes e.g. "257-rc2" -> 257)
	re := regexp.MustCompile(`^v?(\d+)`)
	matches := re.FindStringSubmatch(targetVersionStr)
	targetVersion := 257 // Default if parse fails
	if len(matches) > 1 {
		if v, err := strconv.Atoi(matches[1]); err == nil {
			targetVersion = v
		}
	}

	if len(s.AvailableVersions) == 0 {
		return "v257" // Fallback
	}

	// 1. Version < Min -> Use Min
	if targetVersion < s.AvailableVersions[0] {
		return fmt.Sprintf("v%d", s.AvailableVersions[0])
	}
	// 2. Version > Max -> Use Max
	if targetVersion > s.AvailableVersions[len(s.AvailableVersions)-1] {
		return fmt.Sprintf("v%d", s.AvailableVersions[len(s.AvailableVersions)-1])
	}

	// 3. In between: Find highest version <= targetVersion
	selected := s.AvailableVersions[0]
	for _, v := range s.AvailableVersions {
		if v <= targetVersion {
			selected = v
		} else {
			break
		}
	}
	return fmt.Sprintf("v%d", selected)
}

func (s *SchemaService) IsRepeatableSection(configType, section string) bool {
	if sections, ok := s.RepeatableSections[configType]; ok {
		return sections[section]
	}
	return false
}

func (s *SchemaService) GetTypeInfo(configType, section, key string) TypeInfo {
	if sections, ok := s.TypeCache[configType]; ok {
		if keys, ok := sections[section]; ok {
			if info, ok := keys[key]; ok {
				return info
			}
		}
	}
	// Default to string scalar
	return TypeInfo{}
}
