export interface PackCommandOptions {
  focus?: string[];
  output?: string;
  format?: string;
  diet?: boolean;
  noDiet?: boolean;
  summary?: boolean;
  ignore?: string[];
  tsconfig?: string;
}

export interface CliFactoryOptions {
  exitOverride?: boolean;
}
