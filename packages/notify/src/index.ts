/**
 * Channel drivers, templates and delivery with retries (section 5).
 *
 * The in-app inbox is the source of truth; every channel here is only a
 * delivery route. No alert is lost when push fails or is denied.
 */

export type NotificationSeverity = "critical" | "warning" | "info";

export type ChannelKind = "inbox" | "web-push" | "ntfy" | "telegram" | "email";

export interface NotificationDraft {
  userId: string;
  /** Unique dedupe key per user (rule + window + threshold). */
  dedupeKey: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  /** Deep link into the relevant screen. */
  deepLink?: string;
}

/** A delivery route. Implementations live in the `notify` package. */
export interface ChannelDriver {
  readonly kind: ChannelKind;
  deliver(notification: NotificationDraft): Promise<void>;
}
