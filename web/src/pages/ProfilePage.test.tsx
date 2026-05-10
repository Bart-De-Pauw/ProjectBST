import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ProfilePage } from "./ProfilePage";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 401 })),
}));

describe("ProfilePage", () => {
  it("prompts anonymous users to sign in", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeTruthy();
  });
});
