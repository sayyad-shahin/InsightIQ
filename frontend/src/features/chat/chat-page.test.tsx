import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import type { StreamHandlers } from "@/lib/api";
import type { ChatMessage } from "@/types/api";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status = 0;
  }
  return {
    ApiError,
    tokenStore: { access: null, refresh: null, set: vi.fn(), clear: vi.fn() },
    api: {
      users: { me: vi.fn().mockResolvedValue({ id: "u1", full_name: "Ada Lovelace" }) },
      datasets: { list: vi.fn().mockResolvedValue([]) },
      chats: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        create: vi.fn(),
        rename: vi.fn(),
        remove: vi.fn(),
        streamMessage: vi.fn(),
      },
    },
  };
});

import ChatPage from "@/features/chat/chat-page";
import { api } from "@/lib/api";

const assistantMsg = {
  id: "m2",
  role: "assistant",
  content: "### Key insights\n\nRevenue is concentrated in the top segment.",
  result_type: "text",
  result_payload: null,
  created_at: new Date().toISOString(),
} satisfies ChatMessage;

describe("ChatPage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.chats.list).mockResolvedValue([]);
    vi.mocked(api.datasets.list).mockResolvedValue([]);
    vi.mocked(api.chats.create).mockResolvedValue({
      id: "c1",
      title: "New conversation",
      dataset_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(api.chats.get).mockResolvedValue({
      id: "c1",
      title: "New conversation",
      dataset_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Summarize the key business insights and give executive recommendations.",
          result_type: "none",
          result_payload: null,
          created_at: new Date().toISOString(),
        },
        assistantMsg,
      ],
    });
    vi.mocked(api.chats.streamMessage).mockImplementation(
      async (_id: string, _content: string, handlers: StreamHandlers) => {
        handlers.onToken("Revenue ");
        handlers.onToken("is concentrated…");
        handlers.onDone(assistantMsg);
      },
    );
  });

  it("shows the welcome screen with suggested prompts", async () => {
    renderWithProviders(<ChatPage />);
    expect(await screen.findByText(/what would you like to know/i)).toBeInTheDocument();
    expect(screen.getByText("Summarize key business insights")).toBeInTheDocument();
  });

  it("creates a chat and streams a grounded reply when a prompt is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatPage />);

    await screen.findByText(/what would you like to know/i);
    await user.click(screen.getByText("Summarize key business insights"));

    await waitFor(() => expect(api.chats.create).toHaveBeenCalled());
    await waitFor(() => expect(api.chats.streamMessage).toHaveBeenCalled());

    // Final persisted assistant reply (from chats.get) is rendered.
    expect(await screen.findByText("Key insights")).toBeInTheDocument();
    expect(screen.getByText(/concentrated in the top segment/)).toBeInTheDocument();
  });
});
