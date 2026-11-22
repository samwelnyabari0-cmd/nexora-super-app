import { useState, type FormEvent } from "react";
import { LockKeyhole, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatLockState } from "@/hooks/useChatLock";
import { isValidDeviceLockCode } from "./chat-lock";

type ChatLockPanelProps = {
  lock: ChatLockState;
};

export function ChatLockPanel({ lock }: ChatLockPanelProps) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRemoveLock, setConfirmRemoveLock] = useState(false);
  const [formError, setFormError] = useState("");

  async function createLock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!isValidDeviceLockCode(passphrase)) {
      setFormError("Use a passphrase between 8 and 32 characters.");
      return;
    }
    if (passphrase !== confirmation) {
      setFormError("The passphrases do not match.");
      return;
    }
    setBusy(true);
    const created = await lock.create(passphrase);
    setBusy(false);
    if (created) {
      setPassphrase("");
      setConfirmation("");
    }
  }

  async function unlockChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const opened = await lock.unlock(passphrase);
    setBusy(false);
    if (opened) setPassphrase("");
  }

  if (lock.status === "checking") {
    return (
      <main className="mx-auto flex min-h-[45vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <LockKeyhole className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">Checking this device's chat lock…</p>
      </main>
    );
  }

  if (lock.status === "locked") {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-md flex-col justify-center gap-4 p-6">
        <div className="text-center">
          <LockKeyhole className="mx-auto mb-3 h-9 w-9 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold">This chat is locked</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your device passphrase to open this conversation.
          </p>
        </div>
        <form onSubmit={(event) => void unlockChat(event)} className="space-y-3">
          <label htmlFor="chat-lock-passphrase" className="text-sm font-medium">Device passphrase</label>
          <input
            id="chat-lock-passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            maxLength={32}
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter passphrase"
          />
          <Button type="submit" className="w-full" disabled={busy || !passphrase}>
            <Unlock className="mr-2 h-4 w-4" /> {busy ? "Checking…" : "Unlock chat"}
          </Button>
        </form>
        {(formError || lock.error) && <p role="alert" className="text-sm text-destructive">{formError || lock.error}</p>}
        {!confirmReset ? (
          <Button type="button" variant="ghost" onClick={() => setConfirmReset(true)}>
            Forgot passphrase? Reset this device's lock
          </Button>
        ) : (
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            <p>Resetting removes only this device's privacy lock. Your messages are not deleted.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={lock.reset}>Reset local lock</Button>
            </div>
          </div>
        )}
        <p className="text-center text-[11px] text-muted-foreground">
          This is a local privacy screen, not end-to-end encryption or account authentication.
        </p>
      </main>
    );
  }

  return (
    <details className="w-fit max-w-full shrink-0 self-start rounded-lg border px-2 py-0.5">
      <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-muted-foreground">
        {lock.configured ? "Privacy settings · chat lock enabled" : "Privacy & encryption settings"}
      </summary>
      <div className="pb-2">
        {lock.configured ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={lock.lockNow}>
              <LockKeyhole className="mr-2 h-3.5 w-3.5" /> Lock this chat
            </Button>
            {!confirmRemoveLock ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemoveLock(true)}>
                Remove lock setup
              </Button>
            ) : (
              <div className="w-full space-y-2 rounded-xl border p-3 text-xs">
                <p>Remove this device's lock? Your conversation and messages will stay unchanged.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRemoveLock(false)}>Keep lock</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => { lock.reset(); setConfirmRemoveLock(false); }}>Remove lock</Button>
                </div>
              </div>
            )}
          </div>
        ) : !showSetup ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowSetup(true)}>
            <LockKeyhole className="mr-2 h-3.5 w-3.5" /> Set device lock
          </Button>
        ) : (
          <form onSubmit={(event) => void createLock(event)} className="space-y-2">
            <p className="text-xs font-semibold">Create a device-only passphrase</p>
            <input
              type="password"
              autoComplete="new-password"
              aria-label="New chat lock passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              maxLength={32}
              placeholder="8–32 characters"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <input
              type="password"
              autoComplete="new-password"
              aria-label="Confirm chat lock passphrase"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              maxLength={32}
              placeholder="Confirm passphrase"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy || !passphrase || !confirmation}>
                {busy ? "Saving…" : "Enable lock"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowSetup(false); setPassphrase(""); setConfirmation(""); }}>
                Cancel
              </Button>
            </div>
            {(formError || lock.error) && <p role="alert" className="text-xs text-destructive">{formError || lock.error}</p>}
          </form>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Optional privacy screen on this device only. It is not end-to-end encryption and does not protect a compromised or already-unlocked browser.
        </p>
        {lock.error && !showSetup && <p role="alert" className="mt-1 text-xs text-destructive">{lock.error}</p>}
      </div>
    </details>
  );
}
