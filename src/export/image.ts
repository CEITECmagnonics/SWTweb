/** Plot image export: PNG/SVG download and copy-to-clipboard. */
import Plotly from 'plotly.js-dist-min';
import { downloadBlob } from './download';

export interface ImageOptions {
  width?: number;
  height?: number;
  scale?: number;
}

async function toDataUrl(
  gd: HTMLElement,
  format: 'png' | 'svg',
  opts: ImageOptions = {},
): Promise<string> {
  return Plotly.toImage(gd as Plotly.PlotlyHTMLElement, {
    format,
    width: opts.width ?? 900,
    height: opts.height ?? 560,
    scale: opts.scale ?? 2,
  });
}

export async function downloadImage(
  gd: HTMLElement,
  format: 'png' | 'svg',
  filename: string,
  opts?: ImageOptions,
): Promise<void> {
  const dataUrl = await toDataUrl(gd, format, opts);
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(filename, blob);
}

/** Copy the current plot to the clipboard as a PNG image. */
export async function copyImageToClipboard(gd: HTMLElement, opts?: ImageOptions): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard images are not supported in this browser.');
  }
  // Safari requires the ClipboardItem promise to be constructed synchronously
  // within the user gesture, so pass the blob promise directly.
  const blobPromise = toDataUrl(gd, 'png', opts)
    .then((url) => fetch(url))
    .then((r) => r.blob());
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
}
