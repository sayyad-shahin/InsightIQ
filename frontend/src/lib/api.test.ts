import { afterEach, describe, expect, it } from "vitest";
import { csrfHeaders } from "@/lib/api";

describe("csrfHeaders", () => {
  afterEach(() => {
    document.cookie = "iq_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("returns no header for safe methods", () => {
    document.cookie = "iq_csrf=tok123";
    expect(csrfHeaders("GET")).toEqual({});
    expect(csrfHeaders("HEAD")).toEqual({});
  });

  it("adds the double-submit CSRF header for writes from the cookie", () => {
    document.cookie = "iq_csrf=tok123";
    expect(csrfHeaders("POST")).toEqual({ "X-CSRF-Token": "tok123" });
    expect(csrfHeaders("DELETE")).toEqual({ "X-CSRF-Token": "tok123" });
  });

  it("omits the header when no CSRF cookie is present", () => {
    expect(csrfHeaders("POST")).toEqual({});
  });
});
