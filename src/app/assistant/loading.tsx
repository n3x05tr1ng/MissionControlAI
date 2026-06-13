import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}
