import { describe, expect, it } from "vitest";
import {
  dueShare,
  emptyClubs,
  fixtures,
  guilds,
  poolPercent,
  sanitizeClubs,
  upcoming,
  whenLabel,
} from "./logic";

describe("clubs & guilds", () => {
  it("shows only upcoming fixtures, soonest first", () => {
    const g1 = upcoming("g1", fixtures, new Date("2026-11-02T09:00:00"));
    expect(g1.length).toBeGreaterThan(0);
    expect(g1.some((f) => f.date < "2026-11-02")).toBe(false);
    for (let i = 1; i < g1.length; i++) expect(g1[i - 1].date <= g1[i].date).toBe(true);
  });

  it("splits dues fairly and rounds up", () => {
    expect(dueShare(9600, 48)).toBe(200);
    expect(dueShare(100, 3)).toBe(34);
    expect(dueShare(0, 3)).toBe(0);
    expect(dueShare(100, 0)).toBe(0);
  });

  it("clamps pool progress between 0 and 100", () => {
    expect(poolPercent(0, 100)).toBe(0);
    expect(poolPercent(50, 100)).toBe(50);
    expect(poolPercent(150, 100)).toBe(100);
    expect(poolPercent(10, 0)).toBe(0);
  });

  it("labels days until an event", () => {
    expect(whenLabel(0)).toBe("Today");
    expect(whenLabel(1)).toBe("Tomorrow");
    expect(whenLabel(5)).toBe("in 5d");
  });

  it("sanitizes stored state and drops unknown ids", () => {
    expect(sanitizeClubs(null)).toEqual(emptyClubs);
    const s = sanitizeClubs({
      joined: ["g1", "gX"],
      rsvps: ["f2", "nope"],
      duesPaid: { g1: 400, gX: 10, g2: -5 },
      messages: {
        g1: [
          { id: "m1", from: "me", text: "hi", at: "10:00" },
          { bad: true },
        ],
        gX: [{ id: "z", from: "me", text: "orphan", at: "" }],
      },
    });
    expect(s.joined).toEqual(["g1"]);
    expect(s.rsvps).toEqual(["f2"]);
    expect(s.duesPaid).toEqual({ g1: 400 });
    expect(s.messages.g1).toHaveLength(1);
    expect(s.messages.gX).toBeUndefined();
  });
});
