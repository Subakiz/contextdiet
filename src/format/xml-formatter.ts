import type { FormatInput } from './types.js';

/**
 * Escape XML special characters in attribute values.
 */
export function escapeXmlAttr(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape content for XML CDATA block.
 * In XML CDATA, ']]>' is the only invalid character sequence.
 * To safely embed ']]>' without prematurely terminating the CDATA block,
 * split it into ']]]]><![CDATA[>'.
 */
export function escapeCdata(content: string | undefined): string {
  if (!content) return '';
  return content.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

/**
 * Format context pack into strictly valid XML with <context_pack> root
 * and <file> elements with CDATA blocks.
 */
export function formatXml(data: FormatInput): string {
  const { files = [], audit } = data;

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

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<context_pack version="1.0" generator="contextdiet" total_files="${files.length}" total_original_tokens="${totalOrig}" total_packed_tokens="${totalPack}" total_saved_tokens="${totalSaved}" overall_reduction_percentage="${reductionPct}%">`
  );
  lines.push('  <metadata>');
  lines.push('    <generator>contextdiet</generator>');
  lines.push(`    <total_files>${files.length}</total_files>`);
  lines.push(`    <original_tokens>${totalOrig}</original_tokens>`);
  lines.push(`    <packed_tokens>${totalPack}</packed_tokens>`);
  lines.push(`    <tokens_saved>${totalSaved}</tokens_saved>`);
  lines.push(`    <reduction_percentage>${reductionPct}%</reduction_percentage>`);
  lines.push('  </metadata>');
  lines.push('  <files>');

  for (const file of files) {
    const relPath = file.relativePath || file.filePath || '';
    const lang = file.language || 'other';
    const status = file.status || 'SKELETON';
    const content = file.content ?? '';
    const safeContent = escapeCdata(content);

    lines.push(
      `    <file path="${escapeXmlAttr(relPath)}" language="${escapeXmlAttr(lang)}" status="${escapeXmlAttr(status)}">`
    );
    lines.push('<![CDATA[');
    lines.push(safeContent);
    lines.push(']]>');
    lines.push('    </file>');
  }

  lines.push('  </files>');
  lines.push('</context_pack>');

  return lines.join('\n');
}
