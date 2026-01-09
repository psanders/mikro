import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Load loan data from loan JSON file
 */
export function loadLoanData(loanPath) {
  // Resolve the path (handles both relative and absolute paths)
  const resolvedPath = resolve(loanPath);
  
  if (!existsSync(resolvedPath)) {
    throw new Error(`Loan file not found: ${resolvedPath}`);
  }
  
  const content = readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load background image as base64 data URL
 */
export function loadBackgroundImage(assetsDir) {
  const receiptBgPath = join(assetsDir, 'background.png');
  if (existsSync(receiptBgPath)) {
    const content = readFileSync(receiptBgPath);
    const base64 = content.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  
  const svgPath = join(assetsDir, 'background.svg');
  const pngPath = join(assetsDir, 'background.png');
  
  if (existsSync(svgPath)) {
    const svgContent = readFileSync(svgPath, 'utf-8');
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
  
  if (existsSync(pngPath)) {
    const pngContent = readFileSync(pngPath);
    const base64 = pngContent.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  
  return null;
}
