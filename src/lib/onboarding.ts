import "server-only";

import { countProjects } from "@/lib/repos/projects";
import { getSettingRow, upsertSettingRow } from "@/lib/repos/settings";

const ONBOARDING_KEY = "onboarding_done";

export function isOnboardingDone(): boolean {
  const row = getSettingRow(ONBOARDING_KEY);
  return row?.value === "true";
}

export function markOnboardingDone(): void {
  upsertSettingRow(ONBOARDING_KEY, "true");
}

export function shouldShowWelcome(): boolean {
  if (isOnboardingDone()) return false;
  return countProjects() === 0;
}
