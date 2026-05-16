import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LiveEventPage } from "./LiveEventPage";

const apiFetch = vi.fn();

vi.mock("../api/client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  jsonArray: <T,>(raw: unknown) => (Array.isArray(raw) ? (raw as T[]) : []),
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("LiveEventPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows live completeness without login", async () => {
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/public/events/7/live") {
        return jsonResponse({
          eventId: 7,
          seasonId: 1,
          finalized: false,
          provisional: true,
          eventDate: "2026-05-01",
          matches: [
            {
              match: { matchId: 1, eventId: 7, laneNumber: "1", teamAId: 10, teamBId: 11 },
              teamAName: "Aces",
              teamBName: "Kings",
              totals: {
                subtotalA: 0,
                subtotalB: 0,
                eveningBonusA: 0,
                eveningBonusB: 0,
                eveningPending: true,
                gameBreakdowns: [
                  { slotsPending: true, teamPending: true, bonusPending: true, slotPtsA: 0, slotPtsB: 0, teamPtsA: 0, teamPtsB: 0, bonusA: 0, bonusB: 0 },
                  { slotsPending: false, teamPending: false, bonusPending: false, slotPtsA: 1, slotPtsB: 0, teamPtsA: 0, teamPtsB: 0, bonusA: 0, bonusB: 0 },
                  { slotsPending: true, teamPending: true, bonusPending: true, slotPtsA: 0, slotPtsB: 0, teamPtsA: 0, teamPtsB: 0, bonusA: 0, bonusB: 0 },
                ],
              },
              roster: [{ teamId: 10, playerId: 1, slotPosition: 1 }],
              scores: [],
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    });

    render(
      <MemoryRouter initialEntries={["/events/7/live"]}>
        <Routes>
          <Route path="/events/:eventId/live" element={<LiveEventPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/live \/ unfinalized/i)).toBeTruthy();
    expect(screen.getAllByText("Aces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kings").length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/slots pending/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/score completeness/i)).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith("/public/events/7/live");
  });
});
