import type { ContextPackAudit, TableReporterOptions } from './types.js';

/**
 * Renders an ANSI/Unicode comparison table displaying original tokens,
 * packed tokens, tokens saved, and percentage reduction.
 */
export function renderComparisonTable(
  audit: ContextPackAudit,
  options: TableReporterOptions = {}
): string {
  const noColor =
    options.noColor ?? (typeof process !== 'undefined' && Boolean(process.env.NO_COLOR));

  const color = {
    reset: noColor ? '' : '\x1b[0m',
    bold: noColor ? '' : '\x1b[1m',
    dim: noColor ? '' : '\x1b[2m',
    cyan: noColor ? '' : '\x1b[36m',
    green: noColor ? '' : '\x1b[32m',
    magenta: noColor ? '' : '\x1b[35m'
  };

  const headers = [
    'File Path',
    'Status',
    'Original Tokens',
    'Packed Tokens',
    'Tokens Saved',
    'Savings %'
  ];

  const files = audit.files || [];
  const rows = files.map(f => {
    const origStr = (f.originalTokens ?? 0).toLocaleString('en-US');
    const packStr = (f.packedTokens ?? 0).toLocaleString('en-US');
    const savedStr = (f.savedTokens ?? 0).toLocaleString('en-US');
    const pctStr = (f.reductionPercentage ?? 0).toFixed(1) + '%';
    return {
      raw: [f.path, f.status, origStr, packStr, savedStr, pctStr],
      status: f.status,
      saved: f.savedTokens ?? 0
    };
  });

  const totalOrigStr = (audit.totalOriginalTokens ?? 0).toLocaleString('en-US');
  const totalPackStr = (audit.totalPackedTokens ?? 0).toLocaleString('en-US');
  const totalSavedStr = (audit.totalSavedTokens ?? 0).toLocaleString('en-US');
  const totalPctStr = (audit.overallReductionPercentage ?? 0).toFixed(1) + '%';

  const totalLabel = `Total (${files.length} file${files.length === 1 ? '' : 's'})`;
  const totalRaw = [
    totalLabel,
    '',
    totalOrigStr,
    totalPackStr,
    totalSavedStr,
    totalPctStr
  ];

  const allRawRows = [headers, ...rows.map(r => r.raw), totalRaw];
  const colWidths = headers.map((_, colIdx) =>
    Math.max(...allRawRows.map(r => (r[colIdx] ?? '').length))
  );

  const topBorder = '┌─' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '─┐';
  const headerSep = '├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤';
  const footerSep = '├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤';
  const botBorder = '└─' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '─┘';

  // Format header row (padded unstyled, then wrapped in bold)
  const headerLine =
    '│ ' +
    headers
      .map((h, i) => {
        const padded = i < 2 ? h.padEnd(colWidths[i]) : h.padStart(colWidths[i]);
        return `${color.bold}${padded}${color.reset}`;
      })
      .join(' │ ') +
    ' │';

  // Format body rows
  const bodyLines = rows.map(r => {
    const cells = r.raw.map((val, i) => {
      const padded = i < 2 ? val.padEnd(colWidths[i]) : val.padStart(colWidths[i]);
      if (i === 1) {
        const stColor = r.status === 'FOCUS' ? color.cyan : color.magenta;
        return `${stColor}${padded}${color.reset}`;
      }
      if (i === 4 || i === 5) {
        const sColor = r.saved > 0 ? color.green : color.dim;
        return `${sColor}${padded}${color.reset}`;
      }
      return padded;
    });
    return '│ ' + cells.join(' │ ') + ' │';
  });

  // Format total row
  const totalLine =
    '│ ' +
    totalRaw
      .map((val, i) => {
        const padded = i < 2 ? val.padEnd(colWidths[i]) : val.padStart(colWidths[i]);
        const tColor = i >= 4 ? color.green : color.bold;
        return `${tColor}${padded}${color.reset}`;
      })
      .join(' │ ') +
    ' │';

  const lines = [topBorder, headerLine, headerSep];
  if (bodyLines.length > 0) {
    lines.push(...bodyLines, footerSep);
  }
  lines.push(totalLine, botBorder);

  return lines.join('\n');
}
