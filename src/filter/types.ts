export interface FilterOptions {
  repoRoot: string;
  customPatterns?: string[];
  enableGitignore?: boolean;
  enableContextdietignore?: boolean;
}

export interface GitignoreRule {
  isNegative: boolean;
  isDirOnly: boolean;
  regex: RegExp;
  sourcePattern: string;
}
