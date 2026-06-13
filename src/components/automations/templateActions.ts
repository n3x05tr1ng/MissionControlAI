import type { Automation, AutomationStep } from "@/lib/contracts";

// Crea una automatización real a partir de una plantilla (clonando sus pasos
// vía la API existente). La API de POST /api/automations no clona pasos, así
// que se hace aquí: crear base → insertar pasos en orden remapeando
// reviewsStepId de ids de plantilla a ids nuevos.

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

type CreateResponse = { ok?: boolean; automation?: Automation } & Partial<Automation>;
type StepResponse = { ok?: boolean; step?: AutomationStep } & Partial<AutomationStep>;

export async function createAutomation(input: {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
}): Promise<Automation> {
  const res = await fetch("/api/automations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const j = await parseJson<CreateResponse>(res);
  const automation = (j.automation ?? j) as Automation;
  if (!automation?.id) throw new Error("Malformed response from API");
  return automation;
}

export async function createAutomationFromTemplate(
  template: Automation,
  overrides?: {
    name?: string;
    description?: string | null;
    color?: string;
    icon?: string;
  },
): Promise<Automation> {
  const created = await createAutomation({
    name: overrides?.name?.trim() || template.name,
    description:
      overrides?.description !== undefined
        ? overrides.description
        : template.description,
    color: overrides?.color ?? template.color,
    icon: overrides?.icon ?? template.icon,
  });

  // Clonar pasos en orden; los review steps referencian pasos anteriores,
  // así que el remapeo secuencial siempre encuentra el id nuevo.
  const idMap = new Map<string, string>();
  const ordered = [...template.steps].sort((a, b) => a.order - b.order);
  for (const step of ordered) {
    const res = await fetch(`/api/automations/${created.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: step.type,
        profileId: step.profileId,
        prompt: step.prompt,
        reviewsStepId: step.reviewsStepId
          ? (idMap.get(step.reviewsStepId) ?? null)
          : null,
        maxRetries: step.maxRetries,
        waitForHuman: step.waitForHuman,
      }),
    });
    if (!res.ok) throw new Error(`Step clone failed: HTTP ${res.status}`);
    const j = await parseJson<StepResponse>(res);
    const newStep = (j.step ?? j) as AutomationStep;
    if (newStep?.id) idMap.set(step.id, newStep.id);
  }

  return created;
}
