// src/utils/clipboard.ts

/**
 * Copies text to the clipboard. navigator.clipboard only exists in a secure
 * context (HTTPS or localhost) -- this dashboard is usually opened over
 * plain http://<LAN IP>, where only the legacy execCommand route works.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) {
    throw new Error("copy failed");
  }
}
