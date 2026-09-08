export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="aspect-[4/5] animate-pulse bg-velvet-silk" />
      <div className="space-y-2 pt-3">
        <div className="h-2.5 w-1/3 animate-pulse bg-velvet-black/[0.06]" />
        <div className="h-3.5 w-3/4 animate-pulse bg-velvet-black/[0.06]" />
        <div className="h-3.5 w-1/2 animate-pulse bg-velvet-black/[0.06]" />
        <div className="mt-3 h-10 w-full animate-pulse bg-velvet-black/[0.06]" />
      </div>
    </div>
  );
}
