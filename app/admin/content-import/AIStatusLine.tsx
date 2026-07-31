import { providerLabel } from "@/lib/ai/providerLabel";

export interface AIStatus {
  name: "claude" | "gemini" | "ollama" | "mock";
  model: string | null;
  requestedProvider: string | null;
  isFallback: boolean;
  fallbackReason: string | null;
}

// Shared by SampleTestButton and DryRunButton — every AI run in the admin
// content-import UI shows the same four things: which provider actually
// ran, which model, whether that's a fallback from what was requested,
// and why (if so). Never silently shows mock output as if it were real.
export function AIStatusLine({ status }: { status: AIStatus }) {
  return (
    <p className="font-medium text-zinc-600">
      Nhà cung cấp AI đã dùng:{" "}
      <span className={status.name !== "mock" ? "text-emerald-700" : "text-amber-700"}>
        {providerLabel(status.name)}
        {status.model ? ` (model: ${status.model})` : ""}
      </span>
      {status.requestedProvider && (
        <span className="ml-1 text-zinc-400">— yêu cầu: AI_PROVIDER={status.requestedProvider}</span>
      )}
      {status.isFallback && status.fallbackReason && (
        <span className="mt-1 block text-amber-700">⚠ {status.fallbackReason}</span>
      )}
    </p>
  );
}
