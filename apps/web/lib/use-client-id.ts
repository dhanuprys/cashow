"use client";

import { uuidv7 } from "@cashow/domain";
import { useCallback, useEffect, useState } from "react";

/**
 * A UUIDv7 generated on the client after hydration.
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost),
 * so it is `undefined` when the app is opened over a plain-HTTP LAN address.
 * Generating during render would also make the server and client markup
 * differ, so the id starts empty and is filled in once mounted.
 *
 * Returns the id and a function that generates a fresh one (for example after
 * a form submission succeeds).
 */
export function useClientId(): [id: string, regenerate: () => void] {
  const [id, setId] = useState("");
  const regenerate = useCallback(() => setId(uuidv7()), []);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  return [id, regenerate];
}
