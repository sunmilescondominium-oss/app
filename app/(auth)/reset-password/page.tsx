import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { SunMilesMark } from "@/components/brand-logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50" />
      <div className="animate-rise w-full max-w-md">
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 p-8 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-stone-200">
              <SunMilesMark className="h-9 w-9" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-stone-900">{APP_BRAND_SHORT}</p>
              <p className="text-xs text-stone-500">Reset password</p>
            </div>
          </div>

          {user ? (
            <>
              <h1 className="mt-6 text-2xl font-bold tracking-tight text-stone-900">Choose a new password</h1>
              <p className="mt-1 text-sm text-stone-500">Set the password you&rsquo;ll use to sign in.</p>
              <ResetPasswordForm />
            </>
          ) : (
            <>
              <h1 className="mt-6 text-xl font-semibold text-stone-900">Link expired or invalid</h1>
              <p className="mt-1 text-sm text-stone-500">Reset links are single-use and time-limited. Please request a new one from the sign-in page.</p>
              <Link href="/login" className="mt-5 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                Back to sign in
              </Link>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-stone-500">{APP_BRAND}</p>
      </div>
    </main>
  );
}
