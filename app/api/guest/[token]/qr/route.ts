import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** PUBLIC QR of the guest bill portal URL (printed on the receipt). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = `${req.nextUrl.origin}/guest/${token}`;
  const png = await QRCode.toBuffer(url, { width: 260, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
