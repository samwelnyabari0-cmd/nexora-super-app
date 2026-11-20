import { describe, expect, it } from "vitest";
import {
  splitBill,
  nextRenewal,
  monthlyCost,
  extractTasks,
  moduleBranding,
  taskCompletion,
  focusProgress,
  hubSyncLabel,
  subscriptionBreakdown,
} from "./logic";

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


describe("Hub mini-app branding", () => {
  it("maps all existing module IDs to the approved brand identities", () => {
    expect(Object.keys(moduleBranding).sort()).toEqual([
      "budget", "deals", "focus", "notes", "tasks", "tools", "workflow",
    ]);
    expect(moduleBranding).toMatchObject({
      budget: { name: "PesaVault", accent: "emerald" },
      tools: { name: "ShareTab", accent: "cyan" },
      focus: { name: "DeepPulse", accent: "violet" },
      workflow: { name: "TaskForge", accent: "indigo" },
      notes: { name: "MindGrid", feature: "Notes", accent: "slate" },
      tasks: { name: "MindGrid", feature: "Tasks", accent: "slate" },
      deals: { name: "TrustSpot", accent: "amber" },
    });
  });
});


describe("Hub progress helpers", () => {
  it("reports task completion accurately, including an empty list", () => {
    expect(taskCompletion([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(taskCompletion([{ done: true }, { done: false }, { done: true }])).toEqual({
      done: 2,
      total: 3,
      percent: 67,
    });
    expect(taskCompletion([{ done: true }, { done: true }])).toEqual({
      done: 2,
      total: 2,
      percent: 100,
    });
  });
});


describe("Hub status and spending helpers", () => {
  it("labels each real cloud sync state accurately", () => {
    expect(hubSyncLabel("off")).toBe("Device saved");
    expect(hubSyncLabel("syncing")).toBe("Syncing");
    expect(hubSyncLabel("synced")).toBe("Cloud synced");
    expect(hubSyncLabel("error")).toBe("Sync issue");
  });

  it("breaks recurring subscriptions into monthly-equivalent cycle totals", () => {
    expect(subscriptionBreakdown([
      { amount: 100, cycle: "weekly" },
      { amount: 500, cycle: "monthly" },
      { amount: 1200, cycle: "yearly" },
    ])).toEqual({
      weekly: 100 * 52 / 12,
      monthly: 500,
      yearly: 100,
      total: 100 * 52 / 12 + 500 + 100,
    });
    expect(subscriptionBreakdown([])).toEqual({ weekly: 0, monthly: 0, yearly: 0, total: 0 });
  });
});

describe("DeepPulse timer progress", () => {
  it("handles full, half, complete, and out-of-range countdown values", () => {
    expect(focusProgress(1500)).toBe(0);
    expect(focusProgress(750)).toBe(50);
    expect(focusProgress(0)).toBe(100);
    expect(focusProgress(-20)).toBe(100);
    expect(focusProgress(2000)).toBe(0);
    expect(focusProgress(10, 0)).toBe(0);
  });
});
