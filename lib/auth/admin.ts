import { getCurrentUser } from "@/lib/auth/session";

// Defense-in-depth role check for API routes — the /admin/* layout also
// gates page access, but routes are checked independently since a client
// could call the API directly.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
