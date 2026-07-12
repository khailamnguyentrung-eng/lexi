import { getCurrentUser } from "@/lib/auth/session";
import { getLearnerLens } from "@/lib/services/lens/lensService";
import { LensPageContent } from "./LensPageContent";

/**
 * Learner Lens Page — Phase 6.4
 *
 * Server Component: fetches LensViewModel once and passes it to the client
 * wrapper. All intelligence is encapsulated inside getLearnerLens() — this
 * page imports nothing from intelligence engines directly.
 *
 * Data flow:
 *   getCurrentUser() → getLearnerLens(userId) → LensViewModel → LensPageContent
 */
export default async function LensPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const viewModel = await getLearnerLens(user.id);

  return <LensPageContent viewModel={viewModel} />;
}
