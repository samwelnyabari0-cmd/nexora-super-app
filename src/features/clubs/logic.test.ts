import { describe, expect, it } from "vitest";
import { aggregateClubRsvps, upcoming, whenLabel, type Fixture } from "./logic";

describe("clubs & guilds", () => {
  it("aggregates shared RSVP counts and the signed-in member's selection", () => {
    const result = aggregateClubRsvps([
      { event_id: "e1", user_id: "u1", status: "going" },
      { event_id: "e1", user_id: "u2", status: "going" },
      { event_id: "e1", user_id: "u3", status: "maybe" },
      { event_id: "e2", user_id: "u1", status: "cant_make_it" },
    ], "u1");

    expect(result.counts.e1).toEqual({ going: 2, maybe: 1, cant_make_it: 0 });
    expect(result.counts.e2).toEqual({ going: 0, maybe: 0, cant_make_it: 1 });
    expect(result.myRsvps).toEqual({ e1: "going", e2: "cant_make_it" });
  });


  it("shows only upcoming fixtures, soonest first", () => {
    const fixtures: Fixture[] = [
      { id: "f1", guildId: "g1", date: "2026-11-04", time: "18:30" },
      { id: "f2", guildId: "g1", date: "2026-11-08", time: "15:00" },
      { id: "f3", guildId: "g1", date: "2026-10-25", time: "15:00" },
      { id: "f4", guildId: "g2", date: "2026-11-05", time: "19:00" },
    ];
    const g1 = upcoming("g1", fixtures, new Date("2026-11-02T09:00:00"));
    expect(g1.length).toBeGreaterThan(0);
    expect(g1.some((f) => f.date < "2026-11-02")).toBe(false);
    for (let i = 1; i < g1.length; i++) expect(g1[i - 1].date <= g1[i].date).toBe(true);
  });

  it("labels days until an event", () => {
    expect(whenLabel(0)).toBe("Today");
    expect(whenLabel(1)).toBe("Tomorrow");
    expect(whenLabel(5)).toBe("in 5d");
  });


});
