import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MenuEditor } from "@/components/learn/menu-editor";
import { fetchMenuItems } from "@/lib/learn/queries";

export const metadata: Metadata = { title: "Your menu" };

export default async function MenuPage() {
  const items = await fetchMenuItems();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/learn" aria-label="Back to Learn" className="-ml-2 flex size-11 items-center justify-center">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Your menu</h1>
      </div>
      <MenuEditor items={items} />
    </div>
  );
}
