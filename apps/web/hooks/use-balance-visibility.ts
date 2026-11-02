"use client";

import { useSyncExternalStore } from "react";

// Ephemeral in-memory state: always starts hidden (false) and resets on page refresh
let memoryState = false;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return memoryState;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useBalanceVisibility() {
  const showBalance = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    memoryState = !memoryState;
    for (const listener of listeners) {
      listener();
    }
  }

  return [showBalance, toggle] as const;
}
