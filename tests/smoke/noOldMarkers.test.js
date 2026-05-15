import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkedRoots = ['src', 'README.md', 'index.html', 'package.json'];
const marks = [
  ['charge', 'History'],
  ['leg', 'acyCapacityImpact'],
  ['count_', 'client'],
  ['count_', 'grd'],
  ['base', 'line'],
  ['instruction', 'Status'],
  ['study', 'Outcome'],
  ['life', 'cycle'],
  ['base', 'Load2025'],
  ['plannable', 'Capacity'],
  ['date', 'Depot'],
  ['date', 'Offre'],
  ['date', 'MES'],
  ['raccordement', 'Date'],
  ['year', 'Souhaitee'],
  ['ref', 'Projet'],
  ['organic', 'GrowthRate'],
  ['_directional', 'Migrated'],
  ['capacity', 'Added'],
  ['invest', 'ments'],
  ['engines/', 'load'],
].map((parts) => parts.join(''));

function collectFiles(entry) {
  const full = path.join(root, entry);
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((dirent) => {
    if (dirent.name === 'node_modules' || dirent.name === 'dist') return [];
    const child = path.join(entry, dirent.name);
    return dirent.isDirectory() ? collectFiles(child) : [path.join(root, child)];
  });
}

describe('controle statique du runtime', () => {
  it('ne réintroduit pas les anciens marqueurs', () => {
    const hits = [];
    for (const file of checkedRoots.flatMap(collectFiles)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const mark of marks) {
        if (text.includes(mark)) hits.push(`${path.relative(root, file)}:${mark}`);
      }
    }

    expect(hits).toEqual([]);
  });
});
