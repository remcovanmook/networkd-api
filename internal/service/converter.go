package service

import (
	"bytes"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"gopkg.in/ini.v1"
)

// INIToMap converts INI content to a JSON-compatible map based on schema types
func INIToMap(content string, schemaService *SchemaService, configType string) (map[string]interface{}, error) {
	cfg, err := ini.LoadSources(ini.LoadOptions{AllowShadows: true}, []byte(content))
	if err != nil {
		return nil, err
	}

	result := make(map[string]interface{})

	for _, section := range cfg.Sections() {
		sectionName := section.Name()
		if sectionName == "DEFAULT" {
			continue
		}

		// Check if we already have this section (for multiple sections like [Address])
		// Systemd INI allows multiple sections with same name?
		// Actually, standard INI libraries often merge them or error.
		// "gopkg.in/ini.v1" merges keys if multiple sections exist?
		// Let's assume standard behavior: duplicate sections are merged or we iterate all if library supports it.
		// `cfg.Sections()` returns unique section objects. If file has multiple [Address], they might be merged into one Section object
		// with properties having multiple values (Shadows).
		// Wait, systemd allows:
		// [Address]
		// Address=1.2.3.4
		// [Address]
		// Address=5.6.7.8
		// This is tricky for standard INI parsers.
		// If the library merges them, good. If it overrides, we lose data.
		// `gopkg.in/ini.v1` with `AllowShadows: true` handles duplicate keys but maybe not duplicate sections efficiently?
		// Actually, for networkd, typically we check if the section itself is repeatable (like [Address]).
		// If so, we might want an array of objects in JSON?
		// E.g. "Address": [ { "Address": "..." }, { "Address": "..." } ]
		// OR "Address": [ "1.2.3.4/24", "5.6.7.8/24" ] (shorthand)
		// Systemd schemas usually define [Address] as a section.
		// However, the existing frontend/backend often treated [Address] as an array of objects.
		// But our `from-json.ts` (frontend schema) treats most sections as singular objects in the generated schema?
		// Except for `match`, `network`, etc.
		// Let's look at `schema.ts`: `Address` is `multiple: true` in my manual analysis, but let's see how `from-json` handled it.
		// In `schema-preview.ts`, `Address` key in `Network` section is `type: 'list'`. That handles the shorthand `Address=` inside `[Network]`.
		// But for the `[Address]` *section*, it's an object.
		// If we refer to `NetDevConfig` struct in `config.go`, `Address` was `[]AddressSection`.
		// So we SHOULD produce an array of objects for `Address`, `Route`.
		// BUT `ini.v1` merges duplicate sections!
		// We might need a raw parser or assume the library handles it?
		// `ini.v1` merges keys. So:
		// [Address]
		// Address=A
		// [Address]
		// Address=B
		// Becomes one Section "Address" with Key "Address" = ["A", "B"].
		// This loses the grouping! (e.g. Address=A, Peer=B vs Address=C, Peer=D).
		// If we have mixed keys, merging destroys the relationship.
		// For now, let's implement the simpler case used by `NetworkConfig` struct: it used `[]AddressSection`.
		// How did `ParseNetworkConfig` work before?
		// `cfg.MapTo(config)` uses strict struct mapping.
		// If `ini.v1` mapped `[]AddressSection`, it MUST support creating multiple objects from multiple sections?

		// Let's assume for this refactor we treat sections as maps.
		// If a section can be multiple (heuristic or schema check?), we should make it a list.
		// But since we are replacing strict structs, we need to know WHICH sections are lists.
		// The `SchemaService` doesn't explicitly flag "Section is list" yet, only properties.
		// However, `config.go` had `Address []AddressSection`.
		// Let's iterate keys for now. If we find valid data, we convert.

		sectionMap := make(map[string]interface{})

		for _, key := range section.Keys() {
			keyName := key.Name()
			typeInfo := schemaService.GetTypeInfo(configType, sectionName, keyName)

			values := key.StringsWithShadows(",")

			if typeInfo.IsBool {
				if typeInfo.IsArray {
					// Array of booleans
					bools := make([]bool, len(values))
					for i, v := range values {
						bools[i] = parseBool(v)
					}
					sectionMap[keyName] = bools
				} else {
					// Single boolean (last one wins)
					if len(values) > 0 {
						sectionMap[keyName] = parseBool(values[len(values)-1])
					}
				}
			} else if typeInfo.IsInt {
				if typeInfo.IsArray {
					ints := make([]int, len(values))
					for i, v := range values {
						ints[i] = parseInt(v)
					}
					sectionMap[keyName] = ints
				} else {
					if len(values) > 0 {
						sectionMap[keyName] = parseInt(values[len(values)-1])
					}
				}
			} else if typeInfo.IsArray {
				// Strings array (e.g. DNS=1.1.1.1, DNS=8.8.8.8)
				sectionMap[keyName] = values
			} else {
				// Single string (last one wins)
				if len(values) > 0 {
					sectionMap[keyName] = values[len(values)-1]
				}
			}
		}

		// Handle repeated sections logic?
		// If result[sectionName] exists, convert to array?
		if existing, exists := result[sectionName]; exists {
			// If it's already an array, append.
			if list, ok := existing.([]interface{}); ok {
				result[sectionName] = append(list, sectionMap)
			} else {
				// Convert to list
				result[sectionName] = []interface{}{existing, sectionMap}
			}
		} else {
			// Check if it SHOULD be a list even if singular?
			// For now, store as object. If we need strict arrays for some sections (Address, Route),
			// we might need a list of "MultipleSections" in SchemaService.
			// Known multiples: Address, Route, Rule, ...
			isKnownMultiple := sectionName == "Address" || sectionName == "Route" || sectionName == "RoutingPolicyRule"
			if isKnownMultiple {
				result[sectionName] = []interface{}{sectionMap}
			} else {
				result[sectionName] = sectionMap
			}
		}
	}

	return result, nil
}

func parseBool(v string) bool {
	v = strings.ToLower(v)
	return v == "1" || v == "yes" || v == "true" || v == "on"
}

func parseInt(v string) int {
	i, _ := strconv.Atoi(v)
	return i
}

// MapToINI converts a JSON map to INI string
func MapToINI(data map[string]interface{}, schemaService *SchemaService, configType string) (string, error) {
	// We build a raw string or use ini.File?
	// Using ini.File is safer for escaping but we need control over order/duplicates.
	// Let's use ini.File.

	f := ini.Empty()

	// Sort sections to be deterministic?
	var sections []string
	for k := range data {
		sections = append(sections, k)
	}
	sort.Strings(sections)

	for _, sectionName := range sections {
		val := data[sectionName]

		// Helper to write a section
		writeSection := func(sName string, vals map[string]interface{}) error {
			sec, err := f.NewSection(sName)
			if err != nil {
				return err
			}

			// Sort keys
			var keys []string
			for k := range vals {
				keys = append(keys, k)
			}
			sort.Strings(keys)

			for _, key := range keys {
				v := vals[key]
				if v == nil {
					continue
				}

				// Handle arrays vs scalars
				// Also convert bools to "true"/"false" strings

				switch val := v.(type) {
				case []interface{}:
					for _, item := range val {
						sec.NewKey(key, fmt.Sprintf("%v", item))
					}
				case []string:
					for _, item := range val {
						sec.NewKey(key, item)
					}
				case []int:
					for _, item := range val {
						sec.NewKey(key, fmt.Sprintf("%d", item))
					}
				case []bool:
					for _, item := range val {
						sec.NewKey(key, fmt.Sprintf("%t", item))
					}
				case bool:
					sec.NewKey(key, fmt.Sprintf("%t", val))
				default:
					sec.NewKey(key, fmt.Sprintf("%v", val))
				}
			}
			return nil
		}

		// Handle if val is array (Repeated Section) vs Object
		if list, ok := val.([]interface{}); ok {
			for _, item := range list {
				if m, ok := item.(map[string]interface{}); ok {
					writeSection(sectionName, m)
				}
			}
		} else if m, ok := val.(map[string]interface{}); ok {
			writeSection(sectionName, m)
		}
	}

	var buf bytes.Buffer
	_, err := f.WriteTo(&buf)
	return buf.String(), err
}
