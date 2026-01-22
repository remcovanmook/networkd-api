package service

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type TypeInfo struct {
	IsArray bool
	IsBool  bool
	IsInt   bool
	IsMap   bool
}

type SchemaService struct {
	SchemaDir      string
	SystemdVersion string
	Schemas        map[string]map[string]interface{}
	// Cache for type info: Section -> Key -> TypeInfo
	TypeCache map[string]map[string]map[string]TypeInfo
}

func NewSchemaService(baseSchemaDir string) (*SchemaService, error) {
	// 1. Detect Version
	version := "v257" // Default fallback
	cmd := exec.Command("networkctl", "--version")
	out, err := cmd.Output()
	if err == nil {
		// Output format: "systemd 257 (257)"
		re := regexp.MustCompile(`systemd (\d+)`)
		matches := re.FindStringSubmatch(string(out))
		if len(matches) > 1 {
			version = "v" + matches[1]
		}
	} else {
		fmt.Println("networkctl not found or failed, defaulting to", version)
	}

	// 2. Load Schemas
	s := &SchemaService{
		SchemaDir:      filepath.Join(baseSchemaDir, version),
		SystemdVersion: version,
		Schemas:        make(map[string]map[string]interface{}),
		TypeCache:      make(map[string]map[string]map[string]TypeInfo),
	}

	files := []string{"systemd.network.schema.json", "systemd.netdev.schema.json", "systemd.link.schema.json"}
	for _, file := range files {
		configType := strings.TrimSuffix(strings.TrimSuffix(file, ".schema.json"), "systemd.")
		// "systemd.network.schema.json" -> "network"
		// "systemd.netdev.schema.json" -> "netdev"
		// "systemd.link.schema.json" -> "link"
		if strings.HasPrefix(file, "systemd.netdev") {
			configType = "netdev"
		} else if strings.HasPrefix(file, "systemd.network") {
			configType = "network"
		} else if strings.HasPrefix(file, "systemd.link") {
			configType = "link"
		}

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
		s.buildTypeCache(configType, schemaMap)
	}

	return s, nil
}

func (s *SchemaService) buildTypeCache(configType string, schema map[string]interface{}) {
	if s.TypeCache[configType] == nil {
		s.TypeCache[configType] = make(map[string]map[string]TypeInfo)
	}

	definitions := schema["definitions"].(map[string]interface{})
	properties := schema["properties"].(map[string]interface{})

	for sectionName, sectionVal := range properties {
		sectionDef, ok := sectionVal.(map[string]interface{})
		if !ok {
			continue
		}

		// Handle "oneOf" which might contain the actual object definition or array wrapper
		// Also handle standard object definition
		var objectProps map[string]interface{}

		// Helper to find properties in a schema node
		var findProps func(node map[string]interface{}) map[string]interface{}
		findProps = func(node map[string]interface{}) map[string]interface{} {
			if props, ok := node["properties"].(map[string]interface{}); ok {
				return props
			}
			if oneOf, ok := node["oneOf"].([]interface{}); ok {
				for _, v := range oneOf {
					if res := findProps(v.(map[string]interface{})); res != nil {
						return res
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

		objectProps = findProps(sectionDef)
		if objectProps == nil {
			continue
		}

		if s.TypeCache[configType][sectionName] == nil {
			s.TypeCache[configType][sectionName] = make(map[string]TypeInfo)
		}

		for key, propVal := range objectProps {
			propDef := propVal.(map[string]interface{})
			info := s.resolveType(propDef, definitions)
			s.TypeCache[configType][sectionName][key] = info
		}
	}
}

func (s *SchemaService) resolveType(propDef map[string]interface{}, definitions map[string]interface{}) TypeInfo {
	info := TypeInfo{}

	// Recursive helper
	var analyze func(p map[string]interface{})
	analyze = func(p map[string]interface{}) {
		if ref, ok := p["$ref"].(string); ok {
			refName := strings.TrimPrefix(ref, "#/definitions/")
			if def, ok := definitions[refName].(map[string]interface{}); ok {
				analyze(def)
			}
			// Special handling for known refs if needed, but recursive should work if definitions are standard
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
				analyze(v.(map[string]interface{}))
			}
		}
		if anyOf, ok := p["anyOf"].([]interface{}); ok {
			for _, v := range anyOf {
				analyze(v.(map[string]interface{}))
			}
		}
		if allOf, ok := p["allOf"].([]interface{}); ok {
			for _, v := range allOf {
				analyze(v.(map[string]interface{}))
			}
		}
	}

	analyze(propDef)
	return info
}

func (s *SchemaService) Validate(configType string, data map[string]interface{}) error {
	// Lightweight validation: check if sections exist
	// In the future, we can expand this to check types using s.TypeCache

	// Check if we have the schema
	if _, ok := s.Schemas[configType]; !ok {
		return fmt.Errorf("unknown config type: %s", configType)
	}

	for sectionName := range data {
		// Verify section exists in TypeCache (which represents valid sections)
		if _, ok := s.TypeCache[configType][sectionName]; !ok {
			// Ignore unknown sections or warn?
			// Systemd ignores unknown sections, but strict mode might want to flag.
			// For now allow it.
		}
	}

	return nil
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
