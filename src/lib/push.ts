import { supabase } from "@/integrations/supabase/client";

function base64ToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function enablePushNotifications(userId: string): Promise<PushSubscription> {
  if (!userId) throw new Error("Sign in to enable call alerts.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Background notifications are not supported by this browser.");
  }
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) throw new Error("Call notifications are not configured yet.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Allow notifications in your browser settings to receive calls.");
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(vapidKey),
    });
  const payload = subscription.toJSON();
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: payload.endpoint,
    subscription: payload,
  }, { onConflict: "endpoint" });
  if (error) throw new Error("Could not save call notification settings. " + error.message);
  return subscription;
}

export async function disablePushNotifications(userId: string): Promise<void> {
  if (!userId || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  const { error } = await supabase.from("push_subscriptions")
    .delete().eq("user_id", userId).eq("endpoint", endpoint);
  if (error) throw new Error("Could not remove call notification settings. " + error.message);
  await subscription.unsubscribe();
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return Boolean(await registration?.pushManager.getSubscription());
}
