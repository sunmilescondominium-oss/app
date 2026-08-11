import { redirect } from "next/navigation";
import { hashGiftCardPin } from "@/lib/gift-cards/pin";
import { lookupGiftCardToken } from "@/lib/gift-cards/queries";

export const metadata = { title: "Gift Card Portal — Sun Miles" };

async function loginAction(_prev: unknown, formData: FormData) {
  "use server";
  const cardCode = String(formData.get("card_code") ?? "").trim().toUpperCase();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!cardCode || !pin) return { error: "Enter your card number and PIN." };
  const pinHash = hashGiftCardPin(cardCode, pin);
  const token = await lookupGiftCardToken(cardCode, pinHash);
  if (!token) return { error: "Card not found, wrong PIN, or card is inactive." };
  redirect(`/gift-card/${token}`);
}

import { GiftCardLoginForm } from "@/components/gift-card/login-form";

export default function GiftCardLoginPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-stone-800">Gift Card Portal</h1>
          <p className="mt-1 text-sm text-stone-500">Check your balance, schedule a visit, or request a reload.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <GiftCardLoginForm action={loginAction} />
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          Purchased a card? Your card code and PIN were given to you at purchase.
        </p>
      </div>
    </div>
  );
}
