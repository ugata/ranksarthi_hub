import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Allow-lists protocols for externally rendered hrefs, blocking javascript:/data: injection. */
const SAFE_EXTERNAL_HREF = /^(https?:|mailto:|tel:)/i;
export function isSafeExternalHref(href: string): boolean {
  return SAFE_EXTERNAL_HREF.test(href);
}
