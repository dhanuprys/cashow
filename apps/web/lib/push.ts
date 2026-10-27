import webpush from "web-push";

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:cashow@example.com";
  if (publicKey === undefined || privateKey === undefined) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<void> {
  if (!configure()) throw new Error("VAPID keys are not configured.");
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
