import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  api: {
    users: {
      me: vi.fn().mockResolvedValue({
        id: "u1",
        full_name: "Ada Lovelace",
        email: "ada@x.com",
        role: "analyst",
        is_email_verified: true,
        created_at: new Date().toISOString(),
      }),
      stats: vi.fn().mockResolvedValue({ datasets: 12, chats: 9, forecasts: 3, reports: 4 }),
    },
    settings: {
      get: vi.fn().mockResolvedValue({ theme: "dark", language: "en", preferences: {} }),
      update: vi.fn(),
    },
    datasets: { list: vi.fn().mockResolvedValue([]) },
    chats: { list: vi.fn().mockResolvedValue([]) },
    forecasts: { list: vi.fn().mockResolvedValue([]) },
    reports: { list: vi.fn().mockResolvedValue([]) },
  },
}));

import ProfilePage from "@/features/profile/profile-page";

describe("ProfilePage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "iq_csrf=test"; // simulate a session so the user loads
  });

  it("shows the user's stats from /users/me/stats", async () => {
    renderWithProviders(<ProfilePage />);
    // counts come from the stats endpoint, not full-list downloads
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Datasets")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });
});
