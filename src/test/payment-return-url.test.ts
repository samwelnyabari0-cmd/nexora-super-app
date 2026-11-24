import { describe, expect, it } from "vitest";
import { paymentReturnCleanupPath } from "@/lib/payment-return-url";

describe("paymentReturnCleanupPath", () => {
  it("removes Paystack return parameters without changing the selected creator route", () => {
    expect(
      paymentReturnCleanupPath(
        "https://nexora.example/profile/id/829cf6ba-6877-41fa-9d7d-303fb437986a?post=post-1&reference=pay_123&payment=return#comments",
      ),
    ).toBe("/profile/id/829cf6ba-6877-41fa-9d7d-303fb437986a?post=post-1#comments");
  });

  it("removes trxref while preserving unrelated search parameters", () => {
    expect(
      paymentReturnCleanupPath("https://nexora.example/profile/creator?tab=reels&trxref=pay_123"),
    ).toBe("/profile/creator?tab=reels");
  });
});
