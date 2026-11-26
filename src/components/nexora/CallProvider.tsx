import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { CallSession, type CallInvite } from "@/components/nexora/CallSession";

type CallPerson = {
  id: string;
  display_name: string | null;
  handle: string | null;
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const [invite, setInvite] = useState<CallInvite | null>(null);
  const [other, setOther] = useState<CallPerson | undefined>();

  const loadActiveCall = useCallback(async () => {
    if (!ready || !user?.id) {
      setInvite(null);
      setOther(undefined);
      return;
    }

    const { data, error } = await supabase
      .from("call_invites")
      .select("id, caller, callee, kind, status, callee_peer_id")
      .or(`caller.eq.${user.id},callee.eq.${user.id}`)
      .in("status", ["ringing", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("NEXORA could not refresh the active call:", error);
      return;
    }

    const active = (data?.[0] as CallInvite | undefined) ?? null;
    setInvite(active);

    if (!active) {
      setOther(undefined);
      return;
    }

    const otherId = active.caller === user.id ? active.callee : active.caller;
    const { data: people, error: namesError } = await supabase.rpc("contact_names", {
      ids: [otherId],
    });

    if (!namesError) {
      setOther((people?.[0] as CallPerson | undefined) ?? undefined);
    }
  }, [ready, user?.id]);

  useEffect(() => {
    if (!ready || !user?.id) {
      setInvite(null);
      setOther(undefined);
      return;
    }

    void loadActiveCall();
    const channel = supabase
      .channel(`nexora-global-call:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_invites" },
        () => void loadActiveCall(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void loadActiveCall();
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadActiveCall();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [ready, user?.id, loadActiveCall]);

  return (
    <>
      {children}
      {invite && user?.id && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={invite.status === "ringing" && invite.callee === user.id ? "Incoming call" : "Call"}
        >
          <div className="w-full max-w-xl">
            <CallSession
              key={invite.id}
              invite={invite}
              userId={user.id}
              other={other}
            />
          </div>
        </div>
      )}
    </>
  );
}
