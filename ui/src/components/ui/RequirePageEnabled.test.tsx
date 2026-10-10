import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import type { UIFeatures } from "@/types/uiFeatures";

import { RequirePageEnabled } from "./RequirePageEnabled";

const mockUseUiFeatures = vi.fn();
vi.mock("@/hooks/useMiners", () => ({
  useUiFeatures: () => mockUseUiFeatures(),
}));

function renderGate(page: UIFeatures["page"], isLoading = false) {
  mockUseUiFeatures.mockReturnValue({
    ui: {
      page,
      action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
    },
    isLoading,
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <RequirePageEnabled page="backups">
          <p>backups content</p>
        </RequirePageEnabled>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe("RequirePageEnabled", () => {
  it("renders the page when its flag is enabled", () => {
    renderGate({ settings: "hidden", backups: "enabled", audit: "enabled" });

    expect(screen.getByText("backups content")).toBeInTheDocument();
  });

  it("renders a not-found page when its flag is hidden", () => {
    renderGate({ settings: "enabled", backups: "hidden", audit: "enabled" });

    expect(screen.queryByText("backups content")).not.toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("waits for the flags instead of flashing the page", () => {
    renderGate(
      { settings: "enabled", backups: "hidden", audit: "enabled" },
      true,
    );

    expect(screen.queryByText("backups content")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
