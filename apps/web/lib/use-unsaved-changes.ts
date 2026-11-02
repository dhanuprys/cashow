"use client";

import { useEffect } from "react";

/**
 * Warns before the tab is closed or reloaded while a form has unsaved input.
 *
 * Browsers ignore custom text and show their own prompt, but registering the
 * handler at all is what enables that prompt. Client-side navigation cannot be
 * intercepted portably, so this only covers reload/close — which is where
 * most accidental loss happens on mobile.
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Legacy Safari/Chrome require a truthy returnValue.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}
