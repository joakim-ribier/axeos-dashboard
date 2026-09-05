import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./DataTable";

describe("DataTable", () => {
  it("renders its children inside a table", () => {
    render(
      <DataTable>
        <tbody>
          <tr>
            <td>row content</td>
          </tr>
        </tbody>
      </DataTable>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("row content")).toBeInTheDocument();
  });
});
