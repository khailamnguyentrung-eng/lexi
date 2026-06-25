// Standalone smoke test for the Lexi chat pipeline — exercises the exact
// same path as /api/chat/[sessionId]/messages (persona + Teacher Mode +
// contextAssembler + AIProvider) without needing a logged-in browser
// session. Picks whichever provider getAIProvider() resolves to (see
// AI_PROVIDER in .env) — Gemini, Claude, or Mock if neither key is set —
// so this also doubles as a check that the fallback path is wired correctly.
// Usage: npm run test:chat  (or: npm run test:chat -- "custom question")
import { prisma } from "@/lib/db/prisma";
import { assembleContext } from "@/lib/ai/contextAssembler";
import { modeRegistry } from "@/lib/ai/modes";
import { LEXI_PERSONA_BASE } from "@/lib/ai/persona";
import { getAIProvider } from "@/lib/ai/providers";

async function main() {
  const question = process.argv[2] ?? "Giải thích thì hiện tại hoàn thành cho em";

  const user = await prisma.user.findFirst({ where: { profile: { isNot: null } } });
  if (!user) {
    console.error("No seeded student found — run `npm run db:seed` first.");
    process.exit(1);
  }

  const context = await assembleContext(user.id);
  const handler = modeRegistry.TEACHER;
  const systemPrompt = `${LEXI_PERSONA_BASE}\n\n${handler.buildSystemPrompt(context)}`;

  const provider = getAIProvider();
  console.log(`Asking Lexi (as ${user.email}, provider: ${provider.name}): "${question}"\n`);

  const reply = await provider.chat({ system: systemPrompt, messages: [{ role: "user", content: question }] });
  console.log("Lexi:", reply || "(no text reply)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("test-chat failed:", err);
  process.exit(1);
});
