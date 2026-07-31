// Display label for AIProvider.name — shared by the admin content-import
// UI panels (SampleTestButton, DryRunButton) so the "which provider ran"
// message stays consistent and doesn't hardcode one specific env var name.
export function providerLabel(name: "claude" | "gemini" | "ollama" | "mock"): string {
  switch (name) {
    case "claude":
      return "Claude (thật)";
    case "gemini":
      return "Gemini (thật)";
    case "ollama":
      return "Ollama (local, thật)";
    case "mock":
      return "Mock (chưa cấu hình AI thật)";
  }
}
