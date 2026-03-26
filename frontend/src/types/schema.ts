export interface YangType {
  name: string;
  base?: string;
  pattern?: string;
  range?: string;
  length?: string;
  enums?: EnumValue[];
  path?: string;
  unionTypes?: YangType[];
}

export interface EnumValue {
  name: string;
  value?: number;
  description?: string;
}

export interface SchemaNode {
  name: string;
  kind: string;
  path: string;
  description?: string;
  type?: YangType;
  config?: boolean;
  mandatory?: boolean;
  key?: string;
  default?: string;
  status?: string;
  minElements?: number;
  maxElements?: number;
  when?: string;
  ifFeature?: string[];
  children?: SchemaNode[];
}

export interface YangSchema {
  module: string;
  namespace?: string;
  prefix?: string;
  description?: string;
  revision?: string;
  organization?: string;
  contact?: string;
  children: SchemaNode[];
}
