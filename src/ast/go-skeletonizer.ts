import { parser } from '@lezer/go';
import type {
  LanguageSkeletonizer,
  SkeletonOptions,
  SkeletonResult,
  SupportedLanguage,
  SyntaxValidationResult
} from './types.js';
import { validateGo } from './validator.js';

interface ReplacementSpan {
  start: number;
  end: number;
  replacement: string;
}

export class GoSkeletonizer implements LanguageSkeletonizer {
  public readonly language: SupportedLanguage = 'go';

  private static readonly SUPPORTED_EXTENSIONS = new Set(['.go']);

  public canHandle(filePath: string): boolean {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return GoSkeletonizer.SUPPORTED_EXTENSIONS.has(ext);
  }

  public skeletonize(
    sourceText: string,
    filePath: string = 'file.go',
    options?: SkeletonOptions
  ): SkeletonResult {
    const placeholder = options?.blockPlaceholder ?? '{ /* ... */ }';

    const tree = parser.parse(sourceText);
    const replacements: ReplacementSpan[] = [];

    const visit = (node: any): void => {
      if (
        node.name === 'FunctionDecl' ||
        node.name === 'MethodDecl' ||
        node.name === 'FunctionLiteral'
      ) {
        let blockNode: any = null;
        let child = node.firstChild;

        while (child) {
          if (child.name === 'Block') {
            blockNode = child;
            break;
          }
          child = child.nextSibling;
        }

        if (blockNode) {
          replacements.push({
            start: blockNode.from,
            end: blockNode.to,
            replacement: placeholder
          });
          // Do not recurse into the block
          return;
        }
      }

      let ch = node.firstChild;
      while (ch) {
        visit(ch);
        ch = ch.nextSibling;
      }
    };

    visit(tree.topNode);

    // Sort replacements in reverse order
    replacements.sort((a, b) => b.start - a.start);

    let skeletonCode = sourceText;
    for (const rep of replacements) {
      skeletonCode =
        skeletonCode.slice(0, rep.start) + rep.replacement + skeletonCode.slice(rep.end);
    }

    const validation = this.validate(skeletonCode, filePath);

    return {
      code: skeletonCode,
      language: 'go',
      isValidSyntax: validation.valid,
      diagnostics: validation.errors.length > 0 ? validation.errors : undefined,
      originalLength: sourceText.length,
      skeletonLength: skeletonCode.length
    };
  }

  public validate(sourceText: string, filePath?: string): SyntaxValidationResult {
    return validateGo(sourceText);
  }
}
