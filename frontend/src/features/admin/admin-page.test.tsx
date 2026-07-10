import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  api: {
    users: {
      me: vi.fn().mockResolvedValue({ id: "u1", full_name: "Ada", role: "admin" }),
      list: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({}),
    },
    admin: { stats: vi.fn() },
    audit: { list: vi.fn() },
  },
}));

import AdminPage from "@/features/admin/admin-page";
import { api } from "@/lib/api";

describe("AdminPage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.admin.stats).mockResolvedValue({
      totals: { users: 7, datasets: 12, forecasts: 3, reports: 4, chats: 9 },
      users: { active: 7, verified: 5, new_this_week: 2 },
      datasets: { processing: 1, errored: 0 },
      services: {
        database: true,
        redis_configured: true,
        celery_eager: false,
        ai_configured: false,
        environment: "test",
      },
    });
    vi.mocked(api.users.list).mockResolvedValue([
      {
        id: "u2",
        email: "bob@x.com",
        full_name: "Bob",
        role: "analyst",
        auth_provider: "local",
        is_active: true,
        is_email_verified: true,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(api.audit.list).mockResolvedValue([
      {
        id: "a1",
        user_id: "u2",
        action: "user.login",
        metadata: null,
        ip_address: "127.0.0.1",
        created_at: new Date().toISOString(),
      },
    ]);
  });

  it("renders platform stats, users, and the audit log", async () => {
    renderWithProviders(<AdminPage />);
    expect(await screen.findByText("7")).toBeInTheDocument(); // users total
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("user.login")).toBeInTheDocument();
    await waitFor(() => expect(api.admin.stats).toHaveBeenCalled());
  });

  it("updates a user's role", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPage />);
    await screen.findByText("Bob");
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "admin");
    expect(api.users.updateRole).toHaveBeenCalledWith("u2", "admin");
  });
});
