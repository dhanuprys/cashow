"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // In development, an active Service Worker intercepts Turbopack HMR,
      // React Fast Refresh, and Next.js Flight / RSC streaming requests, causing
      // client-side transitions to freeze with infinite loading.
      // Proactively unregister all workers and purge cache storage.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
