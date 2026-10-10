// src/utils/download.ts

const FILENAME = /filename="?([^";]+)"?/;

/**
 * Downloads url's response as a file, with exactly one request. A plain
 * <a href download> link lets the browser hit the URL again on its own
 * (Chrome re-requests a download, then HEADs it) -- each one a new audit
 * entry server-side. Fetching once and handing the browser a blob: URL
 * keeps any such retry local. The file name comes from the response's
 * Content-Disposition, as it would with a link.
 */
export async function downloadFile(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }
  const filename =
    FILENAME.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "";

  const href = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick, once the browser has picked the download up.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}
