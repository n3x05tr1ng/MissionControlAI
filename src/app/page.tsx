import { Dashboard } from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

// The dashboard is the permanent landing page. First-run guidance lives
// inside the Hero card (see HeroFirstRunActions); we no longer redirect to
// /welcome — users can still reach the guided wizard from the hero link.
export default async function Home() {
  return <Dashboard />;
}
