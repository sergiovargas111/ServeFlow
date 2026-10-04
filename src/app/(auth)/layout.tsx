import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-primary">
        ServeFlow
      </Link>
      {children}
    </main>
  );
}
