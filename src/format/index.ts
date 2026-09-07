import type { OutputFormat } from '../types.js';
import type { FormatInput } from './types.js';
import { formatMarkdown } from './markdown-formatter.js';
import { formatXml } from './xml-formatter.js';
import { formatJson } from './json-formatter.js';

export * from './markdown-formatter.js';
export * from './xml-formatter.js';
export * from './json-formatter.js';
export * from './types.js';

/**
 * Route context pack formatting to the requested format (md | xml | json).
 */
export function formatContext(format: OutputFormat | string, data: FormatInput): string {
  const normalizedFormat = (format || 'md').toLowerCase();
  switch (normalizedFormat) {
    case 'md':
    case 'markdown':
      return formatMarkdown(data);
    case 'xml':
      return formatXml(data);
    case 'json':
      return formatJson(data);
    default:
      throw new Error(
        `Unsupported output format: "${format}". Supported formats are: "md", "xml", "json".`
      );
  }
}

/**
 * Alias for formatContext.
 */
export const formatPack = formatContext;
