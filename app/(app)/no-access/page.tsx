import { requireAuth } from "@/lib/auth/dal";
import { Card } from "@/components/ui";

export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  const user = await requireAuth();
  return (
    <Card>
      <h1 className="text-xl font-semibold text-stone-900">
        No dashboard modules yet
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        You&apos;re signed in as{" "}
        <span className="font-medium">{user.displayLabel}</span>, but your current
        role(s) don&apos;t grant access to any module in this milestone. If you
        expect access, ask an administrator to review your role assignment.
      </p>
    </Card>
  );
}
