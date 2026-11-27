import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const [dismissedInviteId, setDismissedInviteId] = useState<string | null>(null);
  const requestId = useRef(0);
  const visibleInviteId = useRef<string | null>(null);

  const loadActiveCall = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!ready || !user?.id) {
      setInvite(null);
      setOther(undefined);
      return;
    }

    // Expire missed rings and abandoned accepted sessions before deciding
    // whether an overlay should be restored on app launch or refresh.
    const { error: expiryError } = await (supabase as any).rpc("expire_call_invites");
    if (expiryError) console.warn("NEXORA could not expire stale calls:", expiryError);

    const { data, error } = await supabase
      .from("call_invites")
      .select("id, caller, callee, kind, status, callee_peer_id, created_at, ring_expires_at")
      .or(`caller.eq.${user.id},callee.eq.${user.id}`)
      .in("status", ["ringing", "accepted"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (currentRequest !== requestId.current) return;
    if (error) {
      console.warn("NEXORA could not refresh the active call:", error);
      return;
    }

    const active = (data?.[0] as CallInvite | undefined) ?? null;
    if (!active) {
      visibleInviteId.current = null;
      setDismissedInviteId(null);
      setInvite(null);
      setOther(undefined);
      return;
    }

    // Only database-active ringing/accepted rows can be restored.
    // The expiry RPC above has already closed timed-out or abandoned sessions.

    if (active.id === dismissedInviteId) {
      setInvite(null);
      return;
    }
    visibleInviteId.current = active.id;
    setInvite(active);

    const otherId = active.caller === user.id ? active.callee : active.caller;
    const { data: people, error: namesError } = await supabase.rpc("contact_names", {
      ids: [otherId],
    });

    if (currentRequest !== requestId.current) return;
    if (!namesError) {
      setOther((people?.[0] as CallPerson | undefined) ?? undefined);
    }
  }, [ready, user?.id, dismissedInviteId]);

  useEffect(() => {
    const onCallInviteCreated = (event: Event) => {
      const supplied = (event as CustomEvent<{ invite?: CallInvite }>).detail?.invite;
      if (supplied && user?.id && (supplied.status === "ringing" || supplied.status === "accepted")) {
        // Open the call UI from the inserted row immediately; do not wait for polling/realtime.
        visibleInviteId.current = supplied.id;
        setDismissedInviteId(null);
        setInvite(supplied);
        const otherId = supplied.caller === user.id ? supplied.callee : supplied.caller;
        void supabase.rpc("contact_names", { ids: [otherId] }).then(({ data, error }) => {
          if (!error) setOther((data?.[0] as CallPerson | undefined) ?? undefined);
        });
      }
      void loadActiveCall();
    };
    window.addEventListener("nexora:call-invite-created", onCallInviteCreated);
    return () => window.removeEventListener("nexora:call-invite-created", onCallInviteCreated);
  }, [loadActiveCall, user?.id]);

  useEffect(() => {
    if (!ready || !user?.id) {
      setInvite(null);
      setOther(undefined);
      return;
    }

    void loadActiveCall();
    // Realtime is the fast path; polling recovers missed events on mobile.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadActiveCall();
    }, 1800);
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
      requestId.current += 1;
      window.clearInterval(poll);
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
          className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-black/95 p-0 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={invite.status === "ringing" && invite.callee === user.id ? "Incoming call" : "Call"}
        >
          <div className="min-h-[100dvh] w-full max-w-2xl">
            <CallSession
              key={invite.id}
              invite={invite}
              userId={user.id}
              other={other}
              onEnd={() => {
                setDismissedInviteId(invite.id);
                setInvite(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
