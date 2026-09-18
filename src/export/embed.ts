export interface EmbedSize {
  width?: string;
  height?: string;
}

/** Self-contained iframe via srcdoc — travels with the page, works offline. */
export function iframeSrcdoc(html: string, size: EmbedSize = {}): string {
  const w = size.width || "100%";
  const h = size.height || "640";
  const esc = html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<iframe srcdoc="${esc}" width="${w}" height="${h}" style="border:0;border-radius:12px" loading="lazy" title="Constella graph"></iframe>`;
}

/** Hosted-file iframe — for when the .html is uploaded somewhere. */
export function iframeHosted(fileName: string, size: EmbedSize = {}): string {
  const w = size.width || "100%";
  const h = size.height || "640";
  return `<iframe src="${fileName}" width="${w}" height="${h}" style="border:0;border-radius:12px" loading="lazy" title="Constella graph"></iframe>`;
}
