import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatasetCard } from "@/features/datasets/components/dataset-card";
import { makeDataset, renderWithProviders } from "@/test/test-utils";

describe("DatasetCard", () => {
  it("renders the dataset name, counts, and a ready status", () => {
    const dataset = makeDataset({ name: "revenue.csv", row_count: 1200, column_count: 8 });
    renderWithProviders(
      <DatasetCard dataset={dataset} index={0} onPreview={vi.fn()} onClean={vi.fn()} onRename={vi.fn()} />,
    );

    expect(screen.getByText("revenue.csv")).toBeInTheDocument();
    expect(screen.getByText("1.2K")).toBeInTheDocument(); // compact row count
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows an error message when the dataset failed", () => {
    const dataset = makeDataset({ status: "error", error_message: "Bad file", row_count: null });
    renderWithProviders(
      <DatasetCard dataset={dataset} index={0} onPreview={vi.fn()} onClean={vi.fn()} onRename={vi.fn()} />,
    );
    expect(screen.getByText("Bad file")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
