import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/dal";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-2xl"
            >
              ☀️
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">
                {APP_BRAND_SHORT}
              </p>
              <p className="text-xs text-slate-500">Staff sign in</p>
            </div>
          </div>

          <h1 className="mt-6 text-xl font-semibold text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your staff account to continue.
          </p>

          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          {APP_BRAND}
        </p>
      </div>
    </main>
  );
}
