import { notFound } from "next/navigation";
import { getGiftCardByToken } from "@/lib/gift-cards/queries";
import { GiftCardPortal } from "@/components/gift-card/portal";

export const metadata = { title: "Gift Card — Sun Miles" };

interface Props { params: Promise<{ token: string }> }

export default async function GiftCardPortalPage({ params }: Props) {
  const { token } = await params;
  const card = await getGiftCardByToken(token);
  if (!card || !card.is_active) notFound();
  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="mx-auto max-w-lg pt-6">
        <GiftCardPortal card={card} token={token} />
      </div>
    </div>
  );
}
