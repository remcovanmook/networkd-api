// tools/schema-generator/types.ts

export type OptionType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'list';

export interface OptionDef {
  key: string;
  description: string;
  type: OptionType;
  enumValues?: string[];
  multiple?: boolean;
  since?: string;
}

export interface SectionDef {
  name: string;
  options: OptionDef[];
}

export interface ManPageDef {
  unit: 'network' | 'netdev';
  sections: SectionDef[];
}
