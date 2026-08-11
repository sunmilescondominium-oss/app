import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getGiftCard } from "@/lib/gift-cards/queries";
import { PageHeader, Badge } from "@/components/ui";
import { GiftCardDetail as GCDetailView } from "@/components/hotel/gift-cards/gift-card-detail";

export const metadata = { title: "Gift Card Detail" };

interface Props { params: Promise<{ id: string }> }

export default async function GiftCardDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireModule("hotel");
  const canManageConfig = user.roleKeys.some((r) => ["admin", "consultant"].includes(r));
  const canWrite = canWriteModule(user.roleKeys, "hotel");

  const card = await getGiftCard(id);
  if (!card) notFound();

  return (
    <>
      <PageHeader
        backHref="/hotel/gift-cards"
        title={card.card_code}
        subtitle={`${card.owner_label}${card.owner_contact ? ` · ${card.owner_contact}` : ""}`}
        badge={
          card.is_active
            ? <Badge tone="amber">{card.balance_hours}h remaining</Badge>
            : <Badge tone="slate">Inactive</Badge>
        }
      />
      <GCDetailView card={card} canManageConfig={canManageConfig} canWrite={canWrite} />
    </>
  );
}
