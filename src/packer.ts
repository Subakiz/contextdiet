import * as fs from 'fs';
import * as path from 'path';
import { getDependencies } from './dependencies';
import { skeletonizeTSJS, skeletonizePython, skeletonizeGo } from './skeletonizer';
import { calculateSavings, TokenStats } from './tokens';

export interface PackerOptions {
  focusFiles: string[];
  rootDir: string;
  outputFormat: 'markdown' | 'xml' | 'json';
}

export interface PackedFile {
  filePath: string;
  content: string;
  isFocus: boolean;
  stats: TokenStats;
}

export interface PackResult {
  files: PackedFile[];
  totalOriginalTokens: number;
  totalSkeletonizedTokens: number;
  totalSavings: number;
  totalSavingsPercentage: number;
  formattedOutput: string;
}

export function packContext(options: PackerOptions): PackResult {
  const { focusFiles, rootDir, outputFormat } = options;
  const absoluteFocusFiles = focusFiles.map(f => path.resolve(rootDir, f));
  
  // Resolve dependencies
  const allDeps = getDependencies(absoluteFocusFiles, rootDir);
  
  const focusSet = new Set(absoluteFocusFiles);
  
  const packedFiles: PackedFile[] = [];
  let totalOriginalTokens = 0;
  let totalSkeletonizedTokens = 0;

  for (const dep of allDeps) {
    if (!fs.existsSync(dep)) continue;

    const source = fs.readFileSync(dep, 'utf-8');
    const isFocus = focusSet.has(dep);
    let finalContent = source;
    const ext = path.extname(dep).toLowerCase();
    
    if (!isFocus) {
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        finalContent = skeletonizeTSJS(source, ext.startsWith('.ts')).skeletonized;
      } else if (ext === '.py') {
        finalContent = skeletonizePython(source).skeletonized;
      } else if (ext === '.go') {
        finalContent = skeletonizeGo(source).skeletonized;
      }
    }

    const stats = calculateSavings(source, finalContent);
    totalOriginalTokens += stats.originalTokens;
    totalSkeletonizedTokens += stats.skeletonizedTokens;

    // Use relative path for output
    let relativePath = path.relative(rootDir, dep);
    if (!relativePath.startsWith('.')) {
      relativePath = './' + relativePath;
    }

    packedFiles.push({
      filePath: relativePath,
      content: finalContent,
      isFocus,
      stats
    });
  }

  const totalSavings = totalOriginalTokens - totalSkeletonizedTokens;
  const totalSavingsPercentage = totalOriginalTokens > 0 ? (totalSavings / totalOriginalTokens) * 100 : 0;

  // Format output
  let formattedOutput = '';
  if (outputFormat === 'json') {
    formattedOutput = JSON.stringify(packedFiles.map(f => ({ path: f.filePath, content: f.content })), null, 2);
  } else if (outputFormat === 'xml') {
    formattedOutput = '<context>\n';
    for (const f of packedFiles) {
      formattedOutput += `  <file path="${f.filePath}">\n`;
      formattedOutput += `<![CDATA[\n${f.content}\n]]>\n`;
      formattedOutput += `  </file>\n`;
    }
    formattedOutput += '</context>\n';
  } else {
    // Markdown
    for (const f of packedFiles) {
      formattedOutput += `## File: ${f.filePath}\n\n`;
      formattedOutput += '```' + getLanguageFromExt(f.filePath) + '\n';
      formattedOutput += f.content;
      if (!f.content.endsWith('\n')) {
          formattedOutput += '\n';
      }
      formattedOutput += '```\n\n';
    }
  }

  return {
    files: packedFiles,
    totalOriginalTokens,
    totalSkeletonizedTokens,
    totalSavings,
    totalSavingsPercentage,
    formattedOutput
  };
}

function getLanguageFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx': return 'typescript';
    case '.js':
    case '.jsx': return 'javascript';
    case '.py': return 'python';
    case '.go': return 'go';
    default: return 'text';
  }
}
