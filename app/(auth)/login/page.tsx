import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/dal";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { LoginForm } from "./login-form";
import { SunMilesMark } from "@/components/brand-logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Warm ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50" />
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 -z-10 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />

      <div className="animate-rise w-full max-w-md">
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-8 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-stone-200"
            >
              <SunMilesMark className="h-11 w-11" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-stone-900">
                {APP_BRAND_SHORT}
              </p>
              <p className="text-xs text-stone-500">Staff sign in</p>
            </div>
          </div>

          <h1 className="mt-7 text-2xl font-bold tracking-tight text-stone-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Sign in with your staff account to continue.
          </p>

          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
          {APP_BRAND}
        </p>
      </div>
    </main>
  );
}
