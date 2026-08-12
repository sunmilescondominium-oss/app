"use server";

import { requireAuth } from "@/lib/auth/dal";
import { markNotificationRead, markAllNotificationsReadForUser } from "./queries";
import { revalidatePath } from "next/cache";

export async function markRead(id: string): Promise<void> {
  const user = await requireAuth();
  await markNotificationRead(id);
  revalidatePath("/notifications");
  void user; // auth required but id is sufficient; RLS enforced by role match at read time
}

export async function markAllRead(): Promise<void> {
  const user = await requireAuth();
  await markAllNotificationsReadForUser(user.userId, user.roleKeys);
  revalidatePath("/notifications");
}
