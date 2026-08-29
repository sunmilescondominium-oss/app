import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/dal";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { LoginForm } from "./login-form";
import { SunMilesMark } from "@/components/brand-logo";
import { ForgotPassword } from "@/components/auth/forgot-password";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; timeout?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const { reset, timeout } = await searchParams;

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

          {timeout && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session expired due to inactivity. Please sign in again.
            </p>
          )}
          {reset && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password updated. You can sign in with your new password.
            </p>
          )}

          <LoginForm />
          <ForgotPassword />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">
          {APP_BRAND}
        </p>
      </div>
    </main>
  );
}
