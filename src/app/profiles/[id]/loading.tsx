import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-52 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
