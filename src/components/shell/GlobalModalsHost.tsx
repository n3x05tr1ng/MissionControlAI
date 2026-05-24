"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { NewAutomationModal } from "@/components/automations/NewAutomationModal";
import { NewProjectModal } from "@/components/NewProjectModal";
import { NewTaskModal } from "@/components/board/NewTaskModal";
import { onOpenModal, type ModalName } from "@/lib/ui/modalBus";
import type { ProjectConfig } from "@/lib/contracts";

type ActiveModal = ModalName | null;

interface ProjectSnapshot {
  config: ProjectConfig;
}

export function GlobalModalsHost() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveModal>(null);
  const [projects, setProjects] = useState<ProjectConfig[]>([]);

  useEffect(() => {
    return onOpenModal((name) => {
      if (name === "newProfile") {
        router.push("/profiles?new=1");
        return;
      }
      if (name === "newReminder") {
        router.push("/reminders?new=1");
        return;
      }
      if (name === "newTask") {
        // Lazy-load projects for the task modal.
        fetch("/api/projects", { cache: "no-store" })
          .then((r) => r.json())
          .then((data: ProjectSnapshot[]) => {
            setProjects(data.map((s) => s.config));
            setActive("newTask");
          })
          .catch(() => {
            setProjects([]);
            setActive("newTask");
          });
        return;
      }
      setActive(name);
    });
  }, [router]);

  function close() {
    setActive(null);
  }

  if (active === "newProject") {
    return (
      <NewProjectModal
        onClose={close}
        onCreated={() => {
          close();
          router.refresh();
        }}
      />
    );
  }

  if (active === "newTask") {
    return (
      <NewTaskModal
        open={true}
        onClose={close}
        onCreated={() => {
          router.refresh();
        }}
        projects={projects}
      />
    );
  }

  if (active === "newAutomation") {
    return (
      <NewAutomationModal
        open={true}
        onClose={close}
        onCreated={() => {
          router.refresh();
        }}
      />
    );
  }

  return null;
}
