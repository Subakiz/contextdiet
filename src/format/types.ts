import type {
  PackedFile,
  FileStatus,
  SupportedLanguage,
  ContextPackAudit,
  FileTokenMetric,
  OutputFormat
} from '../types.js';

export type {
  PackedFile,
  FileStatus,
  SupportedLanguage,
  ContextPackAudit,
  FileTokenMetric,
  OutputFormat
};

export interface FormatFileInput {
  filePath?: string;
  relativePath?: string;
  language?: SupportedLanguage | 'other' | string;
  status?: FileStatus | string;
  content: string;
  rawContent?: string;
  rawTokens?: number;
  packedTokens?: number;
}

export interface FormatInput {
  files: Array<PackedFile | FormatFileInput>;
  audit?: ContextPackAudit;
}

export interface JsonMetrics {
  totalFiles: number;
  focusedFiles: number;
  skeletonFiles: number;
  originalTokens: number;
  packedTokens: number;
  savedTokens: number;
  reductionPercentage: number;
  totalOriginalTokens: number;
  totalPackedTokens: number;
  totalSavedTokens: number;
  overallReductionPercentage: number;
}

export interface JsonFileExport {
  path: string;
  language: string;
  status: string;
  originalTokens: number;
  packedTokens: number;
  savedTokens: number;
  reductionPercentage: number;
  content: string;
}

export interface JsonExportPayload {
  version: string;
  generator: string;
  timestamp: string;
  metrics: JsonMetrics;
  files: JsonFileExport[];
}
