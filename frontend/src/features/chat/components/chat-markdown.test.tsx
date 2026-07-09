import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "@/features/chat/components/chat-markdown";

describe("ChatMarkdown", () => {
  it("renders headings, bold text, and lists", () => {
    render(<ChatMarkdown content={"### Key insights\n\n- **Revenue** grew\n- Orders up"} />);
    expect(screen.getByText("Key insights")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText(/Orders up/)).toBeInTheDocument();
  });

  it("renders GFM tables", () => {
    const md = "| Product | Revenue |\n| --- | --- |\n| Widget | 400 |";
    render(<ChatMarkdown content={md} />);
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
  });
});
