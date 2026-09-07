import { parser } from '@lezer/python';
import type {
  LanguageSkeletonizer,
  SkeletonOptions,
  SkeletonResult,
  SupportedLanguage,
  SyntaxValidationResult
} from './types.js';
import { validatePython } from './validator.js';

interface ReplacementSpan {
  start: number;
  end: number;
  replacement: string;
}

export class PythonSkeletonizer implements LanguageSkeletonizer {
  public readonly language: SupportedLanguage = 'python';

  private static readonly SUPPORTED_EXTENSIONS = new Set(['.py', '.pyi']);

  public canHandle(filePath: string): boolean {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return PythonSkeletonizer.SUPPORTED_EXTENSIONS.has(ext);
  }

  private getLineIndent(sourceText: string, pos: number): string {
    let lineStart = sourceText.lastIndexOf('\n', pos - 1);
    lineStart = lineStart === -1 ? 0 : lineStart + 1;
    let indent = '';
    while (
      lineStart < sourceText.length &&
      (sourceText[lineStart] === ' ' || sourceText[lineStart] === '\t')
    ) {
      indent += sourceText[lineStart];
      lineStart++;
    }
    return indent;
  }

  public skeletonize(
    sourceText: string,
    filePath: string = 'file.py',
    options?: SkeletonOptions
  ): SkeletonResult {
    const preserveDocstrings = options?.preserveDocstrings ?? true;
    const placeholder = options?.pythonPlaceholder ?? '...';

    const tree = parser.parse(sourceText);
    const replacements: ReplacementSpan[] = [];

    // Traverse AST looking for FunctionDefinition nodes
    const visit = (node: any): void => {
      if (node.name === 'FunctionDefinition') {
        let bodyNode: any = null;
        let child = node.firstChild;
        while (child) {
          if (child.name === 'Body') {
            bodyNode = child;
            break;
          }
          child = child.nextSibling;
        }

        if (bodyNode) {
          let colonNode: any = null;
          let docstringNode: any = null;
          let c = bodyNode.firstChild;

          while (c) {
            if (c.name === ':') {
              colonNode = c;
            } else if (!docstringNode && c.name === 'ExpressionStatement') {
              const exprChild = c.firstChild;
              if (
                exprChild &&
                (exprChild.name === 'String' || exprChild.name === 'FormatString')
              ) {
                docstringNode = c;
              }
              break;
            } else if (c.name !== 'Comment') {
              break;
            }
            c = c.nextSibling;
          }

          const funcIndent = this.getLineIndent(sourceText, node.from);
          const indentStep = funcIndent.includes('\t') ? '\t' : '    ';
          const bodyIndent = funcIndent + indentStep;
          const trailingNewline = sourceText.slice(0, bodyNode.to).endsWith('\n') ? '\n' : '';

          if (preserveDocstrings && docstringNode) {
            replacements.push({
              start: docstringNode.to,
              end: bodyNode.to,
              replacement: `\n${bodyIndent}${placeholder}${trailingNewline}`
            });
          } else {
            const startPos = colonNode ? colonNode.to : bodyNode.from;
            replacements.push({
              start: startPos,
              end: bodyNode.to,
              replacement: `\n${bodyIndent}${placeholder}${trailingNewline}`
            });
          }

          // Do not recurse into the body of this function
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
      language: 'python',
      isValidSyntax: validation.valid,
      diagnostics: validation.errors.length > 0 ? validation.errors : undefined,
      originalLength: sourceText.length,
      skeletonLength: skeletonCode.length
    };
  }

  public validate(sourceText: string, filePath?: string): SyntaxValidationResult {
    return validatePython(sourceText);
  }
}
