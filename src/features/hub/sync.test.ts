import { describe, expect, it } from "vitest";
import { resolveHub, sanitizeHub, type HubData } from "./useHub";

const local: HubData = {
  modules: ["tasks", "notes"],
  hidden: [],
  tasks: [{ id: "t1", text: "Ship demo", done: false }],
  notes: [],
  subs: [],
  focusMinutes: 25,
  city: "Nairobi",
};

describe("sanitizeHub", () => {
  it("drops unknown module ids and malformed rows", () => {
    const clean = sanitizeHub({
      modules: ["tasks", "bogus", 42],
      tasks: [{ id: "t1", text: "ok" }, { text: 5 }, null],
      notes: "nope",
      subs: [{ name: "Netflix", amount: 1100, cycle: "weird" }],
      focusMinutes: "x",
      city: 7,
    });
    expect(clean).not.toBeNull();
    expect(clean!.modules).toEqual(["tasks"]);
    expect(clean!.tasks).toHaveLength(1);
    expect(clean!.tasks[0].text).toBe("ok");
    expect(clean!.notes).toEqual([]);
    expect(clean!.subs).toHaveLength(1);
    expect(clean!.subs[0].cycle).toBe("monthly");
    expect(clean!.focusMinutes).toBe(0);
    expect(clean!.city).toBe("Nairobi");
  });

  it("rejects non-objects", () => {
    expect(sanitizeHub(null)).toBeNull();
    expect(sanitizeHub([1, 2])).toBeNull();
    expect(sanitizeHub("hub")).toBeNull();
  });
});

describe("resolveHub", () => {
  it("keeps local data when the cloud row is empty", () => {
    expect(resolveHub(local, null, 0).winner).toBe("local");
  });

  it("cloud wins when newer than this device's last sync", () => {
    const cloud = {
      data: { modules: ["notes"], tasks: [{ id: "c1", text: "from phone", done: true }] },
      updated_at: "2026-11-01T10:00:00Z",
    };
    const res = resolveHub(local, cloud, 0);
    expect(res.winner).toBe("cloud");
    expect(res.data.tasks[0].text).toBe("from phone");
    expect(res.data.modules).toEqual(["notes"]);
  });

  it("local wins when this device pushed after the cloud write", () => {
    const cloud = {
      data: { modules: ["notes"] },
      updated_at: "2026-11-01T10:00:00Z",
    };
    // lastSync is 2026-11-01T12:00:00Z in epoch ms
    const res = resolveHub(local, cloud, Date.parse("2026-11-01T12:00:00Z"));
    expect(res.winner).toBe("local");
    expect(res.data.tasks[0].text).toBe("Ship demo");
  });
});
