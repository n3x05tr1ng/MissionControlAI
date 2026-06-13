import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex gap-10">
        <div className="hidden w-48 shrink-0 flex-col gap-1.5 lg:flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
