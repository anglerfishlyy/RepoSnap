const fs = require('fs').promises;
const path = require('path');

function formatBytes(bytes, decimals = 1) {
  if (!bytes && bytes !== 0) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * getFileStats(filePath, { maxFileSizeBytes = Infinity, countLoc = false })
 * returns { size, loc (number|null), skipped (boolean) }
 */
async function getFileStats(filePath, opts = {}) {
  const { maxFileSizeBytes = Infinity, countLoc = false } = opts;
  try {
    const s = await fs.stat(filePath);
    const size = s.size;
    const skipped = size > maxFileSizeBytes;
    let loc = null;
    if (!skipped && countLoc) {
      try {
        // read whole file as text (ok because we skip very large files)
        const txt = await fs.readFile(filePath, 'utf8');
        // simple LOC heuristic: count newline characters
        loc = txt.split(/\r\n|\r|\n/).length;
      } catch (e) {
        // probably binary or unreadable, leave loc=null
        loc = null;
      }
    }
    return { size, loc, skipped };
  } catch (e) {
    return { size: 0, loc: null, skipped: false };
  }
}

/**
 * readSample(filePath, lines = 5, maxBytes = 100*1024)
 * returns string (first N lines) or null if cannot read / too big.
 */
async function readSample(filePath, lines = 5, maxBytes = 100 * 1024) {
  try {
    const s = await fs.stat(filePath);
    if (s.size > maxBytes) return null;
    const txt = await fs.readFile(filePath, 'utf8');
    const arr = txt.split(/\r\n|\r|\n/).slice(0, lines);
    return arr.join('\n');
  } catch (e) {
    return null;
  }
}

module.exports = {
  formatBytes,
  getFileStats,
  readSample,
};