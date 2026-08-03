import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** PUBLIC QR of the Airbnb guest booking portal URL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const png = await QRCode.toBuffer(`${req.nextUrl.origin}/airbnb/${token}`, { width: 260, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
