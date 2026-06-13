import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-[40vh] rounded-lg" />
      <Skeleton className="h-[28vh] rounded-lg" />
    </div>
  );
}
