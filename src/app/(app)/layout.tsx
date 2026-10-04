import { BottomNav } from "@/components/nav/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
