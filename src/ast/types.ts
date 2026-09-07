import type {
  SupportedLanguage,
  SkeletonResult,
  AstSkeletonizer,
  SyntaxValidationResult
} from '../types.js';

export type {
  SupportedLanguage,
  SkeletonResult,
  AstSkeletonizer,
  SyntaxValidationResult
};

export interface SkeletonOptions {
  preserveDocstrings?: boolean;
  pythonPlaceholder?: '...' | 'pass';
  blockPlaceholder?: string;
}

export interface LanguageSkeletonizer {
  readonly language: SupportedLanguage;
  canHandle(filePath: string): boolean;
  skeletonize(sourceText: string, filePath: string, options?: SkeletonOptions): SkeletonResult;
  validate(sourceText: string, filePath?: string): SyntaxValidationResult;
}
