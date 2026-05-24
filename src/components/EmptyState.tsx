import type { ReactNode } from "react";
import Link from "next/link";

import { HexIcon } from "@/components/icons/HexIcon";

type CTA = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Secondary = {
  label: string;
  href: string;
};

type Props = {
  icon?: ReactNode;
  title: string;
  description: string;
  cta?: CTA;
  secondary?: Secondary;
};

const ctaClass =
  "inline-flex items-center border border-hive-amber bg-hive-amber/10 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-hive-amber hover:bg-hive-amber/20 transition-colors";

function CTAButton({ cta }: { cta: CTA }) {
  if (cta.href) {
    return (
      <Link href={cta.href} className={ctaClass}>
        {cta.label}
      </Link>
    );
  }
  // If neither href nor onClick is provided, render a non-interactive label.
  return (
    <button type="button" onClick={cta.onClick} className={ctaClass}>
      {cta.label}
    </button>
  );
}

export function EmptyState({ icon, title, description, cta, secondary }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-hive-border bg-hive-panel px-6 py-12 text-center">
      <div className="text-hive-amber/80">
        {icon ?? <HexIcon size={48} strokeWidth={1.25} />}
      </div>
      <h2 className="font-sans text-xl text-hive-text">{title}</h2>
      <p className="max-w-md text-sm text-hive-muted">{description}</p>
      {cta ? <CTAButton cta={cta} /> : null}
      {secondary ? (
        <Link
          href={secondary.href}
          className="font-mono text-[11px] uppercase tracking-widest text-hive-muted hover:text-hive-amber"
        >
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
