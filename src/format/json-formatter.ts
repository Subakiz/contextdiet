import type {
  FormatInput,
  JsonExportPayload,
  JsonFileExport,
  JsonMetrics,
  FileTokenMetric
} from './types.js';

/**
 * Format context pack into strictly valid JSON matching schema with files array and metrics.
 */
export function formatJson(data: FormatInput): string {
  const { files = [], audit } = data;

  const totalOrig = audit?.totalOriginalTokens ?? 0;
  const totalPack = audit?.totalPackedTokens ?? 0;
  const totalSaved = audit?.totalSavedTokens ?? Math.max(0, totalOrig - totalPack);
  const reductionPct =
    audit?.overallReductionPercentage != null
      ? Number(audit.overallReductionPercentage.toFixed(2))
      : totalOrig > 0
        ? Number((((totalOrig - totalPack) / totalOrig) * 100).toFixed(2))
        : 0;

  // Map file token metrics from audit if provided
  const metricMap = new Map<string, FileTokenMetric>();
  if (audit && Array.isArray(audit.files)) {
    for (const fm of audit.files) {
      if (fm?.path) {
        metricMap.set(fm.path, fm);
      }
    }
  }

  const focusedCount = files.filter(f => f.status === 'FOCUS').length;
  const skeletonCount = files.filter(f => f.status === 'SKELETON').length;

  const metrics: JsonMetrics = {
    totalFiles: files.length,
    focusedFiles: focusedCount,
    skeletonFiles: skeletonCount,
    originalTokens: totalOrig,
    packedTokens: totalPack,
    savedTokens: totalSaved,
    reductionPercentage: reductionPct,
    totalOriginalTokens: totalOrig,
    totalPackedTokens: totalPack,
    totalSavedTokens: totalSaved,
    overallReductionPercentage: reductionPct
  };

  const exportedFiles: JsonFileExport[] = files.map(file => {
    const relPath = file.relativePath || file.filePath || '';
    const metric =
      metricMap.get(relPath) || (file.filePath ? metricMap.get(file.filePath) : undefined);

    const origTokens = metric?.originalTokens ?? file.rawTokens ?? 0;
    const packTokens = metric?.packedTokens ?? file.packedTokens ?? 0;
    const saved = metric?.savedTokens ?? Math.max(0, origTokens - packTokens);
    const red =
      metric?.reductionPercentage ??
      (origTokens > 0
        ? Number((((origTokens - packTokens) / origTokens) * 100).toFixed(2))
        : 0);

    return {
      path: relPath,
      language: file.language || 'other',
      status: file.status || 'SKELETON',
      originalTokens: origTokens,
      packedTokens: packTokens,
      savedTokens: saved,
      reductionPercentage: red,
      content: file.content ?? ''
    };
  });

  const payload: JsonExportPayload = {
    version: '1.0.0',
    generator: 'contextdiet',
    timestamp: new Date().toISOString(),
    metrics,
    files: exportedFiles
  };

  return JSON.stringify(payload, null, 2);
}
