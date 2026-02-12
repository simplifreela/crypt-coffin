"use client";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <div className="pl-6 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <div className="pl-6 space-y-2">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
