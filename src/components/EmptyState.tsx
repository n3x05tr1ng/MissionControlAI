"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { openModal, type ModalName } from "@/lib/ui/modalBus";

type CTA = {
  label: string;
  /** Navegación real (Link). */
  href?: string;
  /** Handler directo (solo desde client components). */
  onClick?: () => void;
  /** Abre un modal global vía modalBus — serializable, úsalo desde server pages. */
  modal?: ModalName;
};

type Secondary = {
  label: string;
  href: string;
};

export type EmptyStateIllustration =
  | "hex"
  | "folder"
  | "chat"
  | "spark"
  | "board"
  | "clock";

type Props = {
  /** Override manual (legacy). Si no se pasa, usa `illustration`. */
  icon?: ReactNode;
  illustration?: EmptyStateIllustration;
  title: string;
  description: string;
  cta?: CTA;
  secondary?: Secondary;
};

/* ----------------------- ilustraciones mono-línea ------------------------ */
/* Estilo design language §6e: stroke faint 1.5, sin fill, círculo de fondo
   surface-2 con borde dasheado, un único detalle en --primary (la chispa). */

function Scene({ children }: { children: ReactNode }) {
  return (
    <svg
      width="168"
      height="132"
      viewBox="0 0 168 132"
      fill="none"
      aria-hidden="true"
      className="text-faint"
    >
      <circle
        cx="84"
        cy="66"
        r="56"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
        strokeDasharray="4 6"
      />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

function SparkDetail({ x, y }: { x: number; y: number }) {
  return (
    <g
      stroke="var(--primary)"
      strokeWidth="1.5"
      strokeLinecap="round"
      transform={`translate(${x} ${y})`}
    >
      <path d="M0 -6V-2M0 2V6M-6 0H-2M2 0H6" />
    </g>
  );
}

const ILLUSTRATIONS: Record<EmptyStateIllustration, ReactNode> = {
  hex: (
    <Scene>
      <path d="M84 36 108 50v28L84 92 60 78V50z" />
      <path d="M84 50.5 96.5 58v15L84 80.5 71.5 73V58z" opacity="0.6" />
      <circle cx="84" cy="65.5" r="2" fill="currentColor" stroke="none" />
      <SparkDetail x={114} y={42} />
    </Scene>
  ),
  folder: (
    <Scene>
      <path d="M58 50h18l6 7h28a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H58a4 4 0 0 1-4-4V54a4 4 0 0 1 4-4z" />
      <path d="M54 64h60" opacity="0.6" />
      <SparkDetail x={118} y={46} />
    </Scene>
  ),
  chat: (
    <Scene>
      <path d="M58 46h52a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H78l-12 10v-10h-8a6 6 0 0 1-6-6V52a6 6 0 0 1 6-6z" />
      <path d="M66 59h36M66 68h24" opacity="0.6" />
      <SparkDetail x={120} y={42} />
    </Scene>
  ),
  spark: (
    <Scene>
      <circle cx="62" cy="52" r="7" />
      <circle cx="106" cy="52" r="7" />
      <circle cx="84" cy="84" r="7" />
      <path d="M69 52h30M65 58.5 80 78M103 58.5 88 78" opacity="0.6" />
      <SparkDetail x={120} y={78} />
    </Scene>
  ),
  board: (
    <Scene>
      <rect x="54" y="42" width="18" height="46" rx="3" />
      <rect x="76" y="42" width="18" height="32" rx="3" />
      <rect x="98" y="42" width="18" height="40" rx="3" />
      <path d="M58 50h10M58 58h10M80 50h10M102 50h10M102 58h10" opacity="0.6" />
      <SparkDetail x={122} y={86} />
    </Scene>
  ),
  clock: (
    <Scene>
      <circle cx="84" cy="66" r="22" />
      <path d="M84 54v12l9 6" />
      <path d="M62 40l-6 5M106 40l6 5" opacity="0.6" />
      <SparkDetail x={118} y={86} />
    </Scene>
  ),
};

/* --------------------------------- CTA ----------------------------------- */

const ctaClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover hover:shadow-glow";

function CTAButton({ cta }: { cta: CTA }) {
  if (cta.href) {
    return (
      <Link href={cta.href} className={ctaClass}>
        {cta.label}
      </Link>
    );
  }
  function handleClick() {
    if (cta.modal) {
      openModal(cta.modal);
      return;
    }
    cta.onClick?.();
  }
  return (
    <button type="button" onClick={handleClick} className={ctaClass}>
      {cta.label}
    </button>
  );
}

export function EmptyState({
  icon,
  illustration = "hex",
  title,
  description,
  cta,
  secondary,
}: Props) {
  return (
    <div className="animate-enter flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-1 px-6 py-12 text-center shadow-bevel">
      {icon ? (
        <div className="mb-2 text-primary/80">{icon}</div>
      ) : (
        ILLUSTRATIONS[illustration]
      )}
      <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
      <p className="max-w-[44ch] text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {cta ? (
        <div className="mt-3">
          <CTAButton cta={cta} />
        </div>
      ) : null}
      {secondary ? (
        <Link
          href={secondary.href}
          className="mt-1 text-[12px] text-faint underline-offset-2 hover:text-primary hover:underline"
        >
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
