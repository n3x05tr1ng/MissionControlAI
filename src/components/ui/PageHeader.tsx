import type { ReactNode } from "react";

type Props = {
  /** Texto del overline mono "[ LABEL ]" — pásalo SIN corchetes. */
  overline?: string;
  title: string;
  description?: string;
  /** Botones/acciones alineados a la derecha. */
  actions?: ReactNode;
  className?: string;
};

// Cabecera estándar de página: overline mono de marca + H1 real (28px/600)
// + descripción + slot de acciones. TODAS las páginas deben usarla.
export function PageHeader({
  overline,
  title,
  description,
  actions,
  className = "",
}: Props) {
  return (
    <header
      className={`animate-enter mb-6 flex flex-wrap items-end justify-between gap-4 ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {overline ? (
          <p className="hive-overline">[ {overline} ]</p>
        ) : null}
        <h1 className="hive-h1">{title}</h1>
        {description ? (
          <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
