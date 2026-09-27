import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-44 w-full rounded-3xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}
