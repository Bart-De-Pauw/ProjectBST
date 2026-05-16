import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { SeasonDetailPage } from "./SeasonDetailPage";

const apiFetch = vi.fn();

vi.mock("../api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiErrorText: async (res: Response) => (await res.text()) || "failed",
  jsonArray: <T,>(raw: unknown) => (Array.isArray(raw) ? (raw as T[]) : []),
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function presidentMocks() {
  apiFetch.mockImplementation(async (path: string) => {
    if (path === "/auth/me") {
      return jsonResponse({ playerId: 1, username: "pres", role: "President", email: null, emailOptIn: false });
    }
    if (path === "/seasons/1/teams") return jsonResponse([{ seasonId: 1, teamId: 10, seasonPoints: 0 }]);
    if (path === "/teams") return jsonResponse([{ teamId: 10, teamName: "Pins" }]);
    if (path === "/players") return jsonResponse([]);
    if (path === "/seasons/1/affiliations") return jsonResponse([]);
    if (path === "/seasons/1/events") {
      return jsonResponse([{ eventId: 5, seasonId: 1, eventDate: "2026-05-01", finalized: false }]);
    }
    if (path === "/events/5/matches") {
      return jsonResponse([{ matchId: 1, eventId: 5, laneNumber: "1", teamAId: 10, teamBId: 11 }]);
    }
    return new Response("not found", { status: 404 });
  });
}

describe("SeasonDetailPage schedule", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows schedule section with match counts for president", async () => {
    presidentMocks();
    render(
      <MemoryRouter initialEntries={["/admin/seasons/1"]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/seasons/:seasonId" element={<SeasonDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/schedule \(events\)/i)).toBeTruthy();
    expect(await screen.findByText("2026-05-01")).toBeTruthy();
    expect(await screen.findByText("1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /new event/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /live view/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /manage/i })).toBeTruthy();
  });
});
