import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('AnnualTable', () => {
  it('n’utilise pas de clés aléatoires pour le rendu des cellules', () => {
    const file = path.join(
      process.cwd(),
      'src/ui/pages/substations/tabs/components/AnnualTable.jsx',
    );

    expect(fs.readFileSync(file, 'utf8')).not.toContain('key={Math.random()}');
  });
});
