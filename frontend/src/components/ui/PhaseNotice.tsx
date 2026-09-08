/**
 * Marcador temporal y visible para páginas que aún no se han construido en
 * esta fase del proyecto. Nunca se usa en una página que se presente como
 * terminada — solo mientras esa ruta espera su fase correspondiente.
 */
export function PhaseNotice({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl text-velvet-black">{title}</h1>
      <p className="mt-3 text-velvet-ash">
        Esta sección se construye en <span className="text-velvet-black">{phase}</span> del proyecto.
        Consulta <code className="bg-velvet-black/10 px-1.5 py-0.5 text-sm text-velvet-black">docs/01-arquitectura.md</code> para el
        plan completo de fases.
      </p>
    </div>
  );
}
