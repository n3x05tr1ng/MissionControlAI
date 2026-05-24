import { redirect } from "next/navigation";

import { WelcomeWizard } from "@/components/welcome/WelcomeWizard";
import { shouldShowWelcome } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export default function WelcomePage() {
  if (!shouldShowWelcome()) {
    redirect("/");
  }
  return <WelcomeWizard />;
}
