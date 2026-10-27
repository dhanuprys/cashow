import type { PushSender } from "@cashow/services";
import webpush from "web-push";

let configured = false;

function configure(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}): boolean {
  if (configured) return true;
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (publicKey === undefined || privateKey === undefined) return false;
  const subject = env.VAPID_SUBJECT ?? "mailto:cashow@example.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

function httpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : null;
}

/**
 * Build the worker's push sender from validated env. Returns a sender that
 * reports missing VAPID config as a normal failure, so a worker without push
 * keys still drains delivery rows instead of stalling on them.
 *
 * The delivery consumer passes the notification payload it already loaded, so
 * this module only owns the VAPID setup and the HTTP error classification.
 */
export function createPushSender(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  WEB_ORIGIN: string;
}): PushSender {
  const configuredOk = configure(env);

  return async (subscription, payload) => {
    if (!configuredOk) {
      return { ok: false, error: "VAPID keys are not configured." };
    }
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          ...payload,
          url: payload.url ?? new URL("/app/inbox", env.WEB_ORIGIN).toString(),
        }),
      );
      return { ok: true };
    } catch (error) {
      const status = httpStatus(error);
      if (status === 404 || status === 410) return { ok: false, gone: true };
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}
