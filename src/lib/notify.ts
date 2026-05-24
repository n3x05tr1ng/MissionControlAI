import "server-only";

import notifier from "node-notifier";
import type { NotificationRow, NotificationType } from "@/lib/contracts";

export interface SendNativeNotificationOpts {
  title: string;
  message: string;
  subtitle?: string;
  sound?: boolean;
}

export async function sendNativeNotification(
  opts: SendNativeNotificationOpts,
): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }
  try {
    await new Promise<void>((resolve) => {
      notifier.notify(
        {
          title: opts.title,
          message: opts.message,
          subtitle: opts.subtitle,
          sound: opts.sound ?? false,
        },
        () => resolve(),
      );
    });
  } catch (err) {
    process.stderr.write(
      `[notify] sendNativeNotification failed: ${(err as Error).message}\n`,
    );
  }
}

export interface NotificationRowOpts {
  type: NotificationType;
  title: string;
  body: string;
  project_id?: string | null;
}

export function notificationRow(opts: NotificationRowOpts): NotificationRow {
  return {
    id: crypto.randomUUID(),
    project_id: opts.project_id ?? null,
    type: opts.type,
    title: opts.title,
    body: opts.body,
    created_at: new Date().toISOString(),
  };
}
