/**
 * Code containing triple backticks in comments:
 * ```ts
 * const example = 42;
 * ```
 */

export function generateMarkdownSnippet(title: string, code: string): string {
  const tripleTicks = '```';
  return `# ${title}\n\n${tripleTicks}typescript\n${code}\n${tripleTicks}`;
}

export const templateWithBackticks = `Here is a code fence:
\`\`\`bash
npm install contextdiet
\`\`\`
Done!`;
