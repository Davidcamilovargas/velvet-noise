export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center border border-velvet-black/10 bg-velvet-silk/30 px-4 py-16 text-center">
      <img src="/brand/logo-simbolo.png" alt="" aria-hidden className="mb-4 h-8 w-auto opacity-20" />
      <h3 className="font-display text-lg text-velvet-black">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-velvet-ash">{description}</p>}
    </div>
  );
}
