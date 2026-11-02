import { listNotifications } from "@cashow/services";
import { Bell } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { NotificationActions, PushSubscribe } from "@/components/ledger/push-subscribe";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { displayDateTime } from "@/lib/format";
import { unwrap } from "@/lib/ledger";

export const metadata = {
  title: "Kotak masuk",
};

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Kotak masuk
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Notifikasi
        </h1>
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-40 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton twoColumn={false} />
          </div>
        }
      >
        <Inbox />
      </Suspense>
    </div>
  );
}

async function Inbox() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const notifications = unwrap(await listNotifications(ctx, { limit: 100 }));

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        {notifications.filter((n) => n.readAt === null).length} belum dibaca.
      </p>

      <PushSubscribe vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />

      <Card>
        <CardHeader>
          <CardTitle>Riwayat</CardTitle>
          <CardDescription>Notifikasi terbaru.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Belum ada notifikasi</EmptyTitle>
                <EmptyDescription>
                  Notifikasi akan muncul di sini dan dikirim ke perangkat Anda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="space-y-3">
              {notifications.map((notification) => (
                <li key={notification.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{notification.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {displayDateTime(new Date(notification.createdAt), user.timezone)}
                      </p>
                      <NotificationActions
                        id={notification.id}
                        read={notification.readAt !== null}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
