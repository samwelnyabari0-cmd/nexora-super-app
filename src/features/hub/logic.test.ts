import { describe, expect, it } from "vitest";
import { splitBill, nextRenewal, monthlyCost, extractTasks } from "./logic";

describe("hub rules", () => {
  it("splits a bill so shares add up exactly", () => {
    expect(splitBill(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });
  it("rejects invalid splits", () => {
    expect(splitBill(0, 3)).toEqual([]);
    expect(splitBill(50, 0)).toEqual([]);
  });
  it("finds next monthly renewal", () => {
    const d = nextRenewal("2026-01-15", "monthly", new Date(2026, 9, 20));
    expect([d.getMonth(), d.getDate()]).toEqual([10, 15]);
  });
  it("converts yearly cost to monthly", () => {
    expect(monthlyCost(1200, "yearly")).toBe(100);
  });
  it("pulls action items from notes", () => {
    expect(extractTasks("Met the team.\n- Draft budget\nCall Amina tomorrow")).toEqual([
      "Draft budget",
      "Call Amina tomorrow",
    ]);
  });
});
