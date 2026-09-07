import ts from 'typescript';
import type {
  LanguageSkeletonizer,
  SkeletonOptions,
  SkeletonResult,
  SupportedLanguage,
  SyntaxValidationResult
} from './types.js';
import { validateTypeScript } from './validator.js';

interface ReplacementSpan {
  start: number;
  end: number;
  replacement: string;
}

export class TypeScriptSkeletonizer implements LanguageSkeletonizer {
  public readonly language: SupportedLanguage = 'typescript';

  private static readonly SUPPORTED_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts'
  ]);

  public canHandle(filePath: string): boolean {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return TypeScriptSkeletonizer.SUPPORTED_EXTENSIONS.has(ext);
  }

  public getLanguage(filePath: string): SupportedLanguage {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
      return 'javascript';
    }
    return 'typescript';
  }

  public skeletonize(
    sourceText: string,
    filePath: string = 'file.ts',
    options?: SkeletonOptions
  ): SkeletonResult {
    const language = this.getLanguage(filePath);
    const blockPlaceholder = options?.blockPlaceholder ?? '{ /* ... */ }';

    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    let scriptKind = ts.ScriptKind.TS;
    if (ext === '.tsx') scriptKind = ts.ScriptKind.TSX;
    else if (ext === '.jsx') scriptKind = ts.ScriptKind.JSX;
    else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') scriptKind = ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );

    const replacements: ReplacementSpan[] = [];

    const visit = (node: ts.Node): void => {
      // Function, Method, Constructor, Getter, Setter with block body
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isClassStaticBlockDeclaration(node)
      ) {
        if (node.body && ts.isBlock(node.body)) {
          replacements.push({
            start: node.body.getStart(sourceFile),
            end: node.body.getEnd(),
            replacement: blockPlaceholder
          });
          // Do not recurse into the body of the function/method
          return;
        }
      } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (node.body) {
          replacements.push({
            start: node.body.getStart(sourceFile),
            end: node.body.getEnd(),
            replacement: blockPlaceholder
          });
          // Do not recurse into the body
          return;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Sort replacements in reverse order so character offsets remain valid
    replacements.sort((a, b) => b.start - a.start);

    let skeletonCode = sourceText;
    for (const rep of replacements) {
      skeletonCode =
        skeletonCode.slice(0, rep.start) + rep.replacement + skeletonCode.slice(rep.end);
    }

    const validation = this.validate(skeletonCode, filePath);

    return {
      code: skeletonCode,
      language,
      isValidSyntax: validation.valid,
      diagnostics: validation.errors.length > 0 ? validation.errors : undefined,
      originalLength: sourceText.length,
      skeletonLength: skeletonCode.length
    };
  }

  public validate(sourceText: string, filePath: string = 'file.ts'): SyntaxValidationResult {
    return validateTypeScript(sourceText, filePath);
  }
}
