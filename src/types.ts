/**
 * ContextDiet Core Domain Types
 */

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go';

export type FileStatus = 'FOCUS' | 'SKELETON';

export interface SkeletonResult {
  code: string;
  language: SupportedLanguage;
  isValidSyntax: boolean;
  diagnostics?: string[];
  originalLength: number;
  skeletonLength: number;
}

export interface AstSkeletonizer {
  canHandle(filePath: string): boolean;
  skeletonize(sourceCode: string, filePath: string): Promise<SkeletonResult> | SkeletonResult;
  validateSyntax(sourceCode: string, language: SupportedLanguage): boolean;
}

export interface SyntaxValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PackedFile {
  filePath: string;
  relativePath: string;
  language: SupportedLanguage | 'other';
  status: FileStatus;
  content: string;
  rawContent: string;
  rawTokens?: number;
  packedTokens?: number;
}

export interface PackOptions {
  repoRoot: string;
  focusFiles?: string[];
  ignorePatterns?: string[];
  noDiet?: boolean;
  tsconfigPath?: string;
}

export interface DependencyGraphResult {
  files: PackedFile[];
  cycles: string[][];
  unreachablePrunedCount: number;
}

export interface FileTokenMetric {
  path: string;
  status: FileStatus;
  originalTokens: number;
  packedTokens: number;
  savedTokens: number;
  reductionPercentage: number;
}

export interface ContextPackAudit {
  files: FileTokenMetric[];
  totalOriginalTokens: number;
  totalPackedTokens: number;
  totalSavedTokens: number;
  overallReductionPercentage: number;
}

export type OutputFormat = 'md' | 'xml' | 'json';

export interface PackOutput {
  formattedContent: string;
  audit: ContextPackAudit;
  tableReport: string;
}
