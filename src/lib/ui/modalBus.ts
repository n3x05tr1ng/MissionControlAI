export type ModalName =
  | "newProject"
  | "newTask"
  | "newProfile"
  | "newReminder"
  | "newAutomation";

export interface ModalEventDetail {
  name: ModalName;
}

const EVENT_NAME = "hive:openModal";

export function openModal(name: ModalName): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ModalEventDetail>(EVENT_NAME, { detail: { name } }),
  );
}

export function onOpenModal(
  cb: (name: ModalName) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event): void => {
    const ce = e as CustomEvent<ModalEventDetail>;
    if (ce.detail?.name) cb(ce.detail.name);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
