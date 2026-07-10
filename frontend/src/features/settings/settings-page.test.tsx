import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  api: {
    users: {
      me: vi.fn().mockResolvedValue({ id: "u1", full_name: "Ada", email: "ada@x.com", role: "analyst" }),
      updateMe: vi.fn(),
      changePassword: vi.fn().mockResolvedValue({ message: "ok" }),
    },
    settings: {
      get: vi.fn().mockResolvedValue({ theme: "dark", language: "en", preferences: { api_keys_set: {} } }),
      update: vi.fn().mockResolvedValue({ theme: "dark", language: "en", preferences: { api_keys_set: {} } }),
    },
  },
}));

import SettingsPage from "@/features/settings/settings-page";
import { api } from "@/lib/api";

describe("SettingsPage workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "iq_csrf=test";
  });

  it("renders the settings tabs and profile email", async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Security/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("ada@x.com")).toBeInTheDocument();
  });

  it("changes the password via the security tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText("Settings");
    await user.click(screen.getByRole("tab", { name: /Security/i }));

    await user.type(screen.getByLabelText("Current password"), "OldPass123");
    await user.type(screen.getByLabelText("New password"), "BrandNew123");
    await user.click(screen.getByRole("button", { name: /Update password/i }));

    expect(api.users.changePassword).toHaveBeenCalledWith("OldPass123", "BrandNew123");
  });
});
