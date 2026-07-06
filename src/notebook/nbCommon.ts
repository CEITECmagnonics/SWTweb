/** Shared building blocks for the generated Jupyter notebooks (nbformat 4.5). */
import { getMaterialPreset } from '../models/materials';
import { SWT_CITATION, SWT_CITATION_BIBTEX, SWT_CITATION_TEXT } from '../models/citation';
import type { MaterialValues, Matrix3 } from '../models/types';

export interface NbCell {
  cell_type: 'markdown' | 'code';
  id: string;
  metadata: Record<string, never>;
  source: string[];
  outputs?: never[];
  execution_count?: null;
}

function toLines(text: string): string[] {
  const lines = text.split('\n');
  return lines.map((l, i) => (i < lines.length - 1 ? l + '\n' : l)).filter((l) => l !== '');
}

/** Collects cells and serializes the final notebook JSON. */
export class NotebookBuilder {
  private cells: NbCell[] = [];
  private counter = 0;

  md(text: string): void {
    this.cells.push({
      cell_type: 'markdown',
      id: `cell-${this.counter++}`,
      metadata: {},
      source: toLines(text),
    });
  }

  code(text: string): void {
    this.cells.push({
      cell_type: 'code',
      id: `cell-${this.counter++}`,
      metadata: {},
      source: toLines(text),
      outputs: [],
      execution_count: null,
    });
  }

  build(): string {
    return JSON.stringify(
      {
        cells: this.cells,
        metadata: {
          kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
          language_info: { name: 'python', version: '3' },
        },
        nbformat: 4,
        nbformat_minor: 5,
      },
      null,
      1,
    );
  }
}

export function isMatrix3(value: unknown): value is Matrix3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((row) => Array.isArray(row) && row.length === 3)
  );
}

/** Format a JS value as a Python literal. */
export function py(value: number | string | Matrix3 | null): string {
  if (value === null) return 'None';
  if (isMatrix3(value)) {
    return `[${value.map((row) => `[${row.map((v) => py(v)).join(', ')}]`).join(', ')}]`;
  }
  if (value === 'inf') return 'np.inf';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

export function pyKwargs(obj: Record<string, number | string | Matrix3> | undefined): string {
  if (!obj) return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${py(v)}`)
    .join(', ');
}

export function materialCode(varName: string, presetId: string, values: MaterialValues): string {
  const preset = getMaterialPreset(presetId);
  if (preset.swtName) {
    return `${varName} = SWT.${preset.swtName}  # predefined material`;
  }
  return [
    `${varName} = SWT.Material(`,
    `    Ms=${py(values.Ms)},        # saturation magnetization (A/m)`,
    `    Aex=${py(values.Aex)},      # exchange stiffness (J/m)`,
    `    alpha=${py(values.alpha)},  # Gilbert damping`,
    `    gamma=${py(values.gamma)},  # gyromagnetic ratio (rad*Hz/T)`,
    `    mu0dH0=${py(values.mu0dH0)},  # inhomogeneous broadening (T)`,
    `    Ku=${py(values.Ku)},        # surface anisotropy (J/m^2)`,
    `)`,
  ].join('\n');
}

/** Markdown "How to cite" section embedded in every generated notebook. */
export function citationMarkdown(): string {
  return `## How to cite

If you use SpinWaveToolkit in your work, please cite the package paper:

> ${SWT_CITATION_TEXT}

DOI: [${SWT_CITATION.doi}](${SWT_CITATION.url}) · Repository: [CEITECmagnonics/SpinWaveToolkit](https://github.com/CEITECmagnonics/SpinWaveToolkit)

\`\`\`bibtex
${SWT_CITATION_BIBTEX}
\`\`\``;
}

/** Markdown table of parameters (display units) for notebook headers. */
export function paramsTable(paramsDisplay: Record<string, string>): string {
  return Object.entries(paramsDisplay)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n');
}

export const INSTALL_CELL = (swtVersion: string | null) =>
  `# Install SpinWaveToolkit (pinned to the version used by the web app)
%pip install --quiet SpinWaveToolkit==${swtVersion ?? '1.3.0'} matplotlib`;

export const IMPORTS_CELL = `import numpy as np
import matplotlib.pyplot as plt
import SpinWaveToolkit as SWT`;
