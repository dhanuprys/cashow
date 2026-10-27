/**
 * Shared shape for form actions. Kept outside the `"use server"` module: only
 * async functions may be exported from that boundary.
 */
export interface ActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const initialActionState: ActionState = { status: "idle" };
