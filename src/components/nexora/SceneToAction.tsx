import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, MapPin, MessageCircle, ShoppingBag, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Post } from "@/features/core/data";
import { fmtKES } from "@/features/core/data";
import { useApp } from "@/features/core/store";
import { DemoBadge } from "./ui";

export function SceneToAction({
  post,
  open,
  onOpenChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { emit, sendMoney, balance } = useApp();
  const [step, setStep] = useState<null | "checkout">(null);
  const price = 650;

  const actions = [
    {
      icon: CalendarPlus,
      title: "Make it an event",
      body: `Plan "${post.caption.slice(0, 28)}…" with friends`,
      run: () => {
        emit("scene.event", post.id);
        toast.success("Event draft created", {
          description: "Fri 19:00 · invite sent to 3 friends (demo)",
        });
        onOpenChange(false);
      },
    },
    {
      icon: MapPin,
      title: "Go to the place",
      body: post.place ?? "Find similar places nearby",
      run: () => {
        emit("scene.place", post.id);
        onOpenChange(false);
        navigate({ to: "/maps", search: { q: post.place?.split(",")[0] ?? post.tags[0] } });
      },
    },
    {
      icon: MessageCircle,
      title: "Start a group chat",
      body: "Share this scene and chat about it",
      run: () => {
        emit("scene.chat", post.id);
        onOpenChange(false);
        navigate({ to: "/messages" });
      },
    },
    {
      icon: ShoppingBag,
      title: "Shop the scene",
      body: `Featured item · ${fmtKES(price)}`,
      run: () => setStep("checkout"),
    },
  ];

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setStep(null);
      }}
    >
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl border-t bg-popover">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <Zap className="h-5 w-5 text-accent" /> Scene-to-Action
          </SheetTitle>
          <SheetDescription>Turn what you're watching into something you do.</SheetDescription>
        </SheetHeader>
        {step === null ? (
          <div className="grid gap-2 px-4 pb-6">
            {actions.map(({ icon: Icon, title, body, run }) => (
              <button
                key={title}
                onClick={run}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:border-primary/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{body}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-6">
            <DemoBadge>Simulated checkout</DemoBadge>
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-semibold">Featured item from this scene</p>
              <p className="text-sm text-muted-foreground">Seller: @{post.tags[0]}-shop (demo)</p>
              <p className="mt-3 font-display text-2xl font-bold">{fmtKES(price)}</p>
              <p className="text-xs text-muted-foreground">Wallet balance: {fmtKES(balance)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(null)}
                className="flex-1 rounded-xl border py-2.5 font-semibold"
              >
                Back
              </button>
              <button
                disabled={balance < price}
                onClick={() => {
                  sendMoney("Scene shop", price, "demo checkout");
                  toast.success("Order placed (demo)", {
                    description: "Mock ledger updated — no real payment.",
                  });
                  onOpenChange(false);
                  setStep(null);
                }}
                className="bg-brand flex-1 rounded-xl py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                Pay with demo wallet
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
