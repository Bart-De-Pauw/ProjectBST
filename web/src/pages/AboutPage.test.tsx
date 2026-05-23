import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AboutPage } from "./AboutPage";

const apiFetch = vi.fn();

vi.mock("../api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

vi.mock("../buildInfo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../buildInfo")>();
  return {
    ...actual,
    readWebBuildInfo: () => ({
      commit: "webcommit1",
      builtAt: "2026-05-23T14:32:00Z",
      environment: "dev",
    }),
  };
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("AboutPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows web and API build rows", async () => {
    apiFetch.mockResolvedValue(
      jsonResponse({
        commit: "apicommit2",
        builtAt: "2026-05-23T14:30:00Z",
        environment: "dev",
      }),
    );

    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Bowling Competition Manager")).toBeTruthy();
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("webcommit1".slice(0, 7))).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("apicommit2".slice(0, 7))).toBeTruthy();
    });
    expect(apiFetch).toHaveBeenCalledWith("/public/version");
  });
});
