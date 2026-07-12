import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createTextSelectionCapture, createImageCapture } from "@/lib/services/lens-ai/capture";
import { assistFromCapture } from "@/lib/services/lens-ai/assistance/assistant";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  try {
    let payload;

    if (body.image && typeof body.image === "object") {
      const { base64, widthPx, heightPx } = body.image;
      if (typeof base64 !== "string" || !base64) {
        return NextResponse.json({ error: "image.base64 is required" }, { status: 400 });
      }
      if (typeof widthPx !== "number" || widthPx <= 0 || typeof heightPx !== "number" || heightPx <= 0) {
        return NextResponse.json({ error: "image.widthPx and heightPx must be positive numbers" }, { status: 400 });
      }
      const mimeType =
        body.mimeType === "image/jpeg" || body.mimeType === "image/webp"
          ? (body.mimeType as "image/jpeg" | "image/webp")
          : ("image/png" as const);
      payload = createImageCapture("SCREENSHOT_REGION", { base64, widthPx, heightPx }, mimeType);
    } else if (typeof body.text === "string") {
      const text = body.text.trim();
      if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
      payload = createTextSelectionCapture(text);
    } else {
      return NextResponse.json({ error: "Provide either image or text" }, { status: 400 });
    }

    const response = await assistFromCapture(payload, user.id);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
