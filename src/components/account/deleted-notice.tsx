"use client";

import { useSearchParams } from "next/navigation";

/** Shown on the landing page after account deletion (/?deleted=1). Client-side so the page stays static. */
export function DeletedNotice() {
  const params = useSearchParams();
  if (params.get("deleted") !== "1") return null;
  return (
    <p role="status" className="rounded-lg border p-3 text-sm">
      Your account and data were deleted.
    </p>
  );
}
