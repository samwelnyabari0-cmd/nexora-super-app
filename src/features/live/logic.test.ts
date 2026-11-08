import { describe, it, expect, vi } from "vitest";
import {
  tipError,
  feeSplit,
  perSecondCost,
  sponsoredPinCost,
  streak,
  leaderboard,
  createEventBus,
  prioritizeLive,
  vote,
} from "./logic";

describe("live logic", () => {
  it("tip limits", () => {
    expect(tipError(5, 100)).toMatch(/smallest/);
    expect(tipError(20000, 99999)).toMatch(/capped/);
    expect(tipError(500, 100)).toMatch(/balance/);
    expect(tipError(50, 100)).toBeNull();
  });
  it("fee split clamps to 50%", () => {
    expect(feeSplit(1000, 10)).toEqual({ fee: 100, creator: 900, pct: 10 });
    expect(feeSplit(1000, 80).pct).toBe(50);
  });
  it("per-second and CPM", () => {
    expect(perSecondCost(90, 6)).toBe(9);
    expect(sponsoredPinCost(5000, 200)).toBe(1000);
  });
  it("streak counts consecutive days", () => {
    expect(streak(["2026-10-23", "2026-10-24", "2026-10-25"], "2026-10-25")).toBe(3);
    expect(streak(["2026-10-23", "2026-10-24"], "2026-10-25")).toBe(2);
    expect(streak(["2026-10-20"], "2026-10-25")).toBe(0);
  });
  it("leaderboard ignores unverified", () => {
    expect(
      leaderboard([
        { from: "a", to: "x", amount: 50, verified: true },
        { from: "b", to: "x", amount: 999, verified: false },
      ]),
    ).toEqual([{ name: "a", total: 50 }]);
  });
  it("live first", () => {
    const r = prioritizeLive(
      [{ name: "A" }, { name: "B" }],
      [{ id: "1", creator: "B", title: "", viewers: 5, x: 0, y: 0, startedAt: 0 }],
    );
    expect(r[0].name).toBe("B");
  });
  it("poll vote and event bus", () => {
    expect(vote({ question: "q", options: [{ label: "a", votes: 0 }] }, 0).options[0].votes).toBe(
      1,
    );
    const b = createEventBus<{ x: number }>();
    const h = vi.fn();
    const off = b.on("x", h);
    b.emit("x", 3);
    off();
    b.emit("x", 4);
    expect(h).toHaveBeenCalledTimes(1);
  });
});
