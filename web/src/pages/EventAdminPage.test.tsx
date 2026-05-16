import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { EventAdminPage } from "./EventAdminPage";

const apiFetch = vi.fn();

vi.mock("../api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiUrl: (p: string) => `/api${p}`,
  apiErrorText: async (res: Response) => (await res.text()) || "failed",
  jsonArray: <T,>(raw: unknown) => (Array.isArray(raw) ? (raw as T[]) : []),
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("EventAdminPage schedule", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows evening schedule table for president", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        return jsonResponse({ playerId: 1, username: "pres", role: "President", email: null, emailOptIn: false });
      }
      if (path === "/public/events/5/live") {
        return jsonResponse({
          eventId: 5,
          seasonId: 1,
          finalized: false,
          eventDate: "2026-05-01",
          provisional: true,
          matches: [
            {
              match: { matchId: 1, eventId: 5, laneNumber: "Lane 1", teamAId: 10, teamBId: 11 },
              totals: { subtotalA: 0, subtotalB: 0, eveningBonusA: 0, eveningBonusB: 0, eveningPending: true, gameBreakdowns: [] },
              roster: [],
              scores: [],
            },
          ],
        });
      }
      if (path === "/teams") return jsonResponse([{ teamId: 10, teamName: "Aces" }, { teamId: 11, teamName: "Kings" }]);
      if (path === "/players") return jsonResponse([]);
      if (path === "/seasons/1/affiliations") return jsonResponse([]);
      if (path === "/seasons/1/teams") return jsonResponse([{ teamId: 10 }, { teamId: 11 }]);
      if (path.startsWith("/matches/1/approvals")) return jsonResponse([]);
      return new Response("not found", { status: 404 });
    });

    render(
      <MemoryRouter initialEntries={["/admin/events/5"]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/events/:eventId" element={<EventAdminPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/evening schedule/i)).toBeTruthy();
    expect(await screen.findByText("Lane 1")).toBeTruthy();
    expect(screen.getAllByText("Aces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kings").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /add match/i })).toBeTruthy();
  });

  it("shows roster-only UI for captain on their match", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        return jsonResponse({
          playerId: 2,
          username: "cap1",
          role: "Captain",
          fullName: "Captain One",
          gender: "Male",
          isActive: true,
          email: null,
          emailOptIn: false,
        });
      }
      if (path === "/public/events/5/live") {
        return jsonResponse({
          eventId: 5,
          seasonId: 1,
          finalized: false,
          eventDate: "2026-05-01",
          provisional: true,
          matches: [
            {
              match: { matchId: 1, eventId: 5, laneNumber: "Lane 1", teamAId: 10, teamBId: 11 },
              totals: { subtotalA: 0, subtotalB: 0, eveningBonusA: 0, eveningBonusB: 0, eveningPending: true, gameBreakdowns: [] },
              roster: [],
              scores: [],
            },
          ],
        });
      }
      if (path === "/teams") return jsonResponse([{ teamId: 10, teamName: "Aces" }, { teamId: 11, teamName: "Kings" }]);
      if (path === "/players") return jsonResponse([{ playerId: 2, fullName: "Captain One", username: "cap1" }]);
      if (path === "/seasons/1/affiliations") {
        return jsonResponse([{ playerId: 2, teamId: 10, isCaptain: true }]);
      }
      if (path === "/seasons/1/teams") return jsonResponse([{ teamId: 10 }, { teamId: 11 }]);
      return new Response("not found", { status: 404 });
    });

    render(
      <MemoryRouter initialEntries={["/admin/events/5"]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/events/:eventId" element={<EventAdminPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/match roster & scores/i)).toBeTruthy();
    expect(await screen.findByRole("button", { name: /save roster \+ scores/i })).toBeTruthy();
    expect(await screen.findByRole("columnheader", { name: "G1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /add match/i })).toBeNull();
  });
});
