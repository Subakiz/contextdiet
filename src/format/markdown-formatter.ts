import type { FormatInput } from './types.js';

/**
 * Determine Markdown code fence delimiter dynamically.
 * If source code contains N consecutive backticks (N >= 3),
 * the fence must use at least N + 1 backticks to prevent markdown fence disruption.
 * Default fence is ``` (3 backticks).
 */
export function getMarkdownCodeFence(content: string): string {
  if (!content) {
    return '```';
  }
  const matches = content.match(/`{3,}/g);
  if (!matches || matches.length === 0) {
    return '```';
  }
  let maxTicks = 0;
  for (const match of matches) {
    if (match.length > maxTicks) {
      maxTicks = match.length;
    }
  }
  return '`'.repeat(Math.max(4, maxTicks + 1));
}

/**
 * Normalize language identifier for markdown syntax highlighting fence.
 */
export function normalizeLanguageTag(lang: string | undefined, relativePath?: string): string {
  if (lang && lang !== 'other') {
    return lang.toLowerCase();
  }
  if (relativePath) {
    const ext = relativePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'mts':
      case 'cts':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'py':
      case 'pyw':
        return 'python';
      case 'go':
        return 'go';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'sh':
      case 'bash':
        return 'bash';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return '';
    }
  }
  return '';
}

/**
 * Generate anchor slug for Table of Contents.
 */
export function createAnchorSlug(filePath: string): string {
  return `file-${filePath.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
}

/**
 * Format context pack into structured Markdown.
 */
export function formatMarkdown(data: FormatInput): string {
  const { files = [], audit } = data;

  const focusCount = files.filter(f => f.status === 'FOCUS').length;
  const skeletonCount = files.filter(f => f.status === 'SKELETON').length;

  const totalOrig = audit?.totalOriginalTokens ?? 0;
  const totalPack = audit?.totalPackedTokens ?? 0;
  const totalSaved = audit?.totalSavedTokens ?? Math.max(0, totalOrig - totalPack);
  const reductionPct =
    audit?.overallReductionPercentage != null
      ? audit.overallReductionPercentage.toFixed(1)
      : totalOrig > 0
        ? (((totalOrig - totalPack) / totalOrig) * 100).toFixed(1)
        : '0.0';

  const lines: string[] = [];

  // Header & Summary Metrics
  lines.push('# ContextDiet');
  lines.push('');
  lines.push(`> **Context Pack Summary**`);
  lines.push(`> - Files: **${files.length}** (${focusCount} FOCUS, ${skeletonCount} SKELETON)`);
  lines.push(`> - Tokens: **${totalOrig.toLocaleString()}** original -> **${totalPack.toLocaleString()}** packed`);
  lines.push(`> - Savings: **${totalSaved.toLocaleString()}** tokens saved (**${reductionPct}%** reduction)`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  if (files.length === 0) {
    lines.push('_No files included in context pack._');
  } else {
    for (const file of files) {
      const relPath = file.relativePath || file.filePath || '';
      const anchor = createAnchorSlug(relPath);
      const statusBadge = file.status === 'FOCUS' ? '`[FOCUS]`' : '`[SKELETON]`';
      lines.push(`- [${relPath}](#${anchor}) ${statusBadge}`);
    }
  }
  lines.push('');

  // File Sections
  for (const file of files) {
    const relPath = file.relativePath || file.filePath || '';
    const anchor = createAnchorSlug(relPath);
    const status = file.status || 'SKELETON';
    const langTag = normalizeLanguageTag(file.language, relPath);
    const content = file.content ?? '';
    const fence = getMarkdownCodeFence(content);

    lines.push('---');
    lines.push('');
    lines.push(`<a id="${anchor}"></a>`);
    lines.push(`## \`${relPath}\` [${status}]`);
    lines.push('');
    lines.push(`${fence}${langTag}`);
    lines.push(content);
    lines.push(fence);
    lines.push('');
  }

  return lines.join('\n');
}
