// tools/schema-generator/types.ts

export type OptionType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'list'
  | 'ipv4'
  | 'ipv6'
  | 'ip'
  | 'mac'
  | 'duration'
  | 'prefix'
  | 'bytes';

export interface OptionDef {
  key: string;
  description: string;
  types: OptionType[];
  enumValues?: string[];
  multiple?: boolean;
  since?: string;
  default?: string | number | boolean;
}

export interface SectionDef {
  name: string;
  description?: string;
  multiple?: boolean;
  options: OptionDef[];
}

export interface ManPageDef {
  unit: 'network' | 'netdev' | 'link';
  sections: SectionDef[];
}
