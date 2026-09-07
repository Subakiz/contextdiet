import type {
  AstSkeletonizer,
  LanguageSkeletonizer,
  SkeletonOptions,
  SkeletonResult,
  SupportedLanguage,
  SyntaxValidationResult
} from './types.js';
import { TypeScriptSkeletonizer } from './ts-skeletonizer.js';
import { PythonSkeletonizer } from './python-skeletonizer.js';
import { GoSkeletonizer } from './go-skeletonizer.js';
import {
  validateSyntax,
  validateSyntaxDetailed,
  validateTypeScript,
  validatePython,
  validateGo
} from './validator.js';

export * from './types.js';
export * from './validator.js';
export * from './ts-skeletonizer.js';
export * from './python-skeletonizer.js';
export * from './go-skeletonizer.js';

export class AstSkeletonEngine implements AstSkeletonizer {
  private readonly drivers: LanguageSkeletonizer[];

  constructor() {
    this.drivers = [
      new TypeScriptSkeletonizer(),
      new PythonSkeletonizer(),
      new GoSkeletonizer()
    ];
  }

  public canHandle(filePath: string): boolean {
    return this.drivers.some(d => d.canHandle(filePath));
  }

  public detectLanguage(filePath: string): SupportedLanguage | undefined {
    const driver = this.drivers.find(d => d.canHandle(filePath));
    if (!driver) return undefined;
    if (driver instanceof TypeScriptSkeletonizer) {
      return driver.getLanguage(filePath);
    }
    return driver.language;
  }

  public getDriver(languageOrFilePath: SupportedLanguage | string): LanguageSkeletonizer | undefined {
    // Check if it matches a driver by language
    const byLang = this.drivers.find(d => d.language === languageOrFilePath);
    if (byLang) return byLang;

    // Check if it matches by file path / extension
    return this.drivers.find(d => d.canHandle(languageOrFilePath));
  }

  public skeletonize(
    sourceCode: string,
    filePath: string,
    options?: SkeletonOptions
  ): SkeletonResult {
    const driver = this.getDriver(filePath);
    if (!driver) {
      throw new Error(`Unsupported language or file extension for skeletonization: ${filePath}`);
    }
    return driver.skeletonize(sourceCode, filePath, options);
  }

  public validateSyntax(
    sourceCode: string,
    language: SupportedLanguage,
    filePath?: string
  ): boolean {
    return validateSyntax(sourceCode, language, filePath);
  }

  public validateSyntaxDetailed(
    sourceCode: string,
    language: SupportedLanguage,
    filePath?: string
  ): SyntaxValidationResult {
    return validateSyntaxDetailed(sourceCode, language, filePath);
  }
}

export const astSkeletonizer = new AstSkeletonEngine();
export default astSkeletonizer;
