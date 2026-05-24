"use client";

type Props = {
  className?: string;
};

export function Skeleton({ className = "" }: Props) {
  return (
    <div
      className={`relative overflow-hidden border border-hive-border bg-hive-panel/60 ${className}`}
      aria-hidden="true"
    >
      <div className="hive-skeleton-shimmer absolute inset-0" />
      <style>{`
        .hive-skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(35, 40, 46, 0) 0%,
            rgba(35, 40, 46, 0.6) 50%,
            rgba(35, 40, 46, 0) 100%
          );
          animation: hiveSkeleton 1.4s ease-in-out infinite;
          transform: translateX(-100%);
        }
        @keyframes hiveSkeleton {
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
