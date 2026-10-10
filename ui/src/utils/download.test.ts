import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadFile } from "./download";

describe("downloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches once and saves the body under the server's file name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", {
        headers: {
          "Content-Disposition":
            'attachment; filename="audit-20261010-080000.json"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:local");
    URL.revokeObjectURL = vi.fn();
    let saved: { href: string; download: string } | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved = { href: this.href, download: this.download };
    });

    await downloadFile("/api/audit/export?type=restart");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/audit/export?type=restart");
    expect(saved).toEqual({
      href: "blob:local",
      download: "audit-20261010-080000.json",
    });
    expect(document.querySelector("a")).toBeNull();
  });

  it("rejects on an error response instead of saving it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 400 })),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await expect(
      downloadFile("/api/backups/download?months=x"),
    ).rejects.toThrow("HTTP 400");
    expect(click).not.toHaveBeenCalled();
  });
});
