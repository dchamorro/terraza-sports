import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely — resolves conflicts (e.g. p-2 + p-4 → p-4). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Cast a Supabase embedded relation (typed as `T[] | T`) to `T`.
 *  Supabase returns a single object for !inner joins but types it as any[].
 *  Usage: `rel<Member>(row.members)`  */
export function rel<T>(value: unknown): T {
  return value as T;
}
