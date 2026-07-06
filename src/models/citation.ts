/**
 * Canonical citation for the SpinWaveToolkit package. Single source of truth
 * used by both the web UI and the generated Jupyter notebooks.
 *
 * Jan Klíma et al 2026 J. Phys.: Condens. Matter 38 175802
 */
export const SWT_CITATION = {
  authors:
    'J. Klíma, O. Wojewoda, J. Krčma, M. Hrtoň, D. Pavelka, J. Holobrádek, and M. Urbánek',
  title:
    'SpinWaveToolkit: Python package for (semi-)analytical calculations in the field of spin-wave physics',
  journal: 'J. Phys.: Condens. Matter',
  volume: '38',
  pages: '175802',
  year: '2026',
  doi: '10.1088/1361-648X/ae6430',
  url: 'https://doi.org/10.1088/1361-648X/ae6430',
} as const;

/** One-line human-readable reference. */
export const SWT_CITATION_TEXT =
  `${SWT_CITATION.authors}, ` +
  `"${SWT_CITATION.title}", ` +
  `${SWT_CITATION.journal} ${SWT_CITATION.volume}, ${SWT_CITATION.pages} (${SWT_CITATION.year}).`;

/** BibTeX entry for the package paper. */
export const SWT_CITATION_BIBTEX = `@article{Klima2026SpinWaveToolkit,
  title   = {SpinWaveToolkit: Python package for (semi-)analytical calculations in the field of spin-wave physics},
  author  = {Kl{\\'\\i}ma, Jan and Wojewoda, Ond{\\v{r}}ej and Kr{\\v{c}}ma, Jakub and Hrto{\\v{n}}, Martin and Pavelka, Dominik and Holobr{\\'a}dek, Jakub and Urb{\\'a}nek, Michal},
  journal = {Journal of Physics: Condensed Matter},
  volume  = {38},
  pages   = {175802},
  year    = {2026},
  doi     = {10.1088/1361-648X/ae6430},
  publisher = {IOP Publishing}
}`;
