import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import { BoardLockedPage } from "./BoardLockedPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("BoardLockedPage", () => {
  it("renders the locked message and email form", () => {
    render(
      <BoardLockedPage
        boardId="abcd1234efgh5678"
        hashboardUrl="http://localhost:8090"
      />,
    );

    expect(screen.getByText("boardLocked.title")).toBeInTheDocument();
    expect(screen.getByText("boardLocked.message")).toBeInTheDocument();
    expect(screen.getByText("boardLocked.submit")).toBeInTheDocument();
  });

  it("posts to hashboard's request-access endpoint for this board and shows the generic sent message", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { message: "ok" } });

    render(
      <BoardLockedPage
        boardId="abcd1234efgh5678"
        hashboardUrl="http://localhost:8090"
      />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: /boardLocked.emailLabel/ }),
      {
        target: { value: "you@example.com" },
      },
    );
    fireEvent.click(screen.getByText("boardLocked.submit"));

    await waitFor(() => {
      expect(screen.getByText("boardLocked.sent")).toBeInTheDocument();
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/boards/abcd1234efgh5678/request-access"),
      { email: "you@example.com" },
    );
  });

  it("shows the generic sent message even if the request fails (anti-enumeration)", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("network error"));

    render(
      <BoardLockedPage
        boardId="abcd1234efgh5678"
        hashboardUrl="http://localhost:8090"
      />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: /boardLocked.emailLabel/ }),
      {
        target: { value: "you@example.com" },
      },
    );
    fireEvent.click(screen.getByText("boardLocked.submit"));

    await waitFor(() => {
      expect(screen.getByText("boardLocked.sent")).toBeInTheDocument();
    });
  });

  it("disables the submit button until an email is entered", () => {
    render(
      <BoardLockedPage
        boardId="abcd1234efgh5678"
        hashboardUrl="http://localhost:8090"
      />,
    );

    expect(
      screen.getByText("boardLocked.submit").closest("button"),
    ).toBeDisabled();

    fireEvent.change(
      screen.getByRole("textbox", { name: /boardLocked.emailLabel/ }),
      {
        target: { value: "you@example.com" },
      },
    );

    expect(
      screen.getByText("boardLocked.submit").closest("button"),
    ).not.toBeDisabled();
  });

  it("keeps the submit button disabled when hashboardUrl is null (server not configured)", () => {
    render(<BoardLockedPage boardId="abcd1234efgh5678" hashboardUrl={null} />);

    fireEvent.change(
      screen.getByRole("textbox", { name: /boardLocked.emailLabel/ }),
      {
        target: { value: "you@example.com" },
      },
    );

    expect(
      screen.getByText("boardLocked.submit").closest("button"),
    ).toBeDisabled();
  });
});
