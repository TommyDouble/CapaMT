import { describe, expect, it } from 'vitest';
import { buildDirectionalTooltipOptions } from '../../../src/ui/pages/substations/tabs/components/DirectionalChart.jsx';

describe('DirectionalChart tooltip theme', () => {
  it('uses resolved theme colors instead of CSS variables', () => {
    const theme = {
      bgRaised: '#ffffff',
      textPrimary: '#1a1230',
      textSecondary: '#4a4162',
      textMuted: '#8a82a0',
      border: '#e8e2f0',
      fontMono: 'JetBrains Mono, monospace',
    };

    const options = buildDirectionalTooltipOptions(theme);

    expect(options.backgroundColor).toBe('#ffffff');
    expect(options.titleColor).toBe('#1a1230');
    expect(options.bodyColor).toBe('#4a4162');
    expect(options.borderColor).toBe('#e8e2f0');
    expect(options.titleFont.family).toBe('JetBrains Mono, monospace');
    expect(options.bodyFont.family).toBe('JetBrains Mono, monospace');
    expect(options.callbacks.labelTextColor()).toBe('#1a1230');
    expect(JSON.stringify(options)).not.toContain('var(--');
  });
});
