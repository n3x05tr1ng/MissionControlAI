type Props = {
  className?: string;
};

// Placeholder con shimmer (clase .skeleton en globals.css).
// Dale forma con utilidades: <Skeleton className="h-4 w-32" />.
export function Skeleton({ className = "" }: Props) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
