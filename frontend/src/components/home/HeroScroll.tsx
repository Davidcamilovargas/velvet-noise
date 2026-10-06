import { useEffect, useRef } from "react";

// Video de campaña. Se cambia sin tocar código con VITE_HERO_VIDEO_URL /
// VITE_HERO_POSTER_URL (Render → velvetnoise-frontend → Environment).
// El de /public/hero es un clip de MUESTRA (dominio público) hasta tener uno propio:
// MP4 H.264, 8-12 s en loop, sin audio, ~2 MB, más un JPG del primer cuadro.
const VIDEO = import.meta.env.VITE_HERO_VIDEO_URL || "/hero/hero.mp4";
const POSTER = import.meta.env.VITE_HERO_POSTER_URL || "/hero/hero-poster.jpg";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Hero "Ruido por fuera. Terciopelo por dentro.": el video ocupa la pantalla;
 * al bajar se encoge dentro de un marco y detrás queda el mismo video
 * difuminado, donde aparece "terciopelo por dentro". La animación sigue al
 * scroll con inercia (no pegada a él) y solo usa clip-path/transform/opacity.
 */
export function HeroScroll() {
  const stageRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurRef = useRef<HTMLCanvasElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);
  const velvetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current!, frame = frameRef.current!, video = videoRef.current!;
    const noise = noiseRef.current!, velvet = velvetRef.current!, canvas = blurRef.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Los elementos fijos se ubican debajo del header real (su alto varía con la barra de anuncios).
    const home = stage.closest<HTMLElement>(".vn-home");
    const header = document.querySelector("header");
    const setHdr = () => home?.style.setProperty("--hdr", `${header?.offsetHeight ?? 0}px`);
    setHdr();
    const ro = header ? new ResizeObserver(setHdr) : null;
    if (header) ro!.observe(header);

    const enter = window.setTimeout(() => noise.classList.add("is-in"), 60);

    if (reduce) {
      video.pause();
      return () => { window.clearTimeout(enter); ro?.disconnect(); };
    }

    let target = 0, current = 0, last = performance.now(), running = false, raf = 0;
    const readTarget = () => {
      const r = stage.getBoundingClientRect();
      target = clamp(-r.top / Math.max(1, r.height - innerHeight));
    };
    const render = (p: number) => {
      const e = easeOut(p);
      const mobile = innerWidth < 768;
      const side = (mobile ? 5 : 12) * e, top = (mobile ? 7 : 8) * e, bottom = (mobile ? 26 : 28) * e;
      frame.style.clipPath = `inset(${top}% ${side}% ${bottom}% ${side}%)`;
      video.style.transform = `scale(${1.08 - 0.08 * e})`;
      noise.style.opacity = String(1 - clamp((p - 0.1) / 0.4));
      noise.style.transform = `translateY(${-48 * e}px)`;
      const v = clamp((p - 0.45) / 0.45);
      velvet.style.opacity = String(v);
      velvet.style.transform = `translateY(${28 * (1 - easeOut(v))}px)`;
    };
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      // Suavizado independiente de los fps: se siente igual a 60 y a 120 Hz.
      current += (target - current) * (1 - Math.pow(1 - 0.16, dt / 16.7));
      if (Math.abs(target - current) < 0.0005) current = target;
      render(current);
      if (current !== target) raf = requestAnimationFrame(loop);
      else running = false;
    };
    const kick = () => {
      readTarget();
      if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    };
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", kick);
    readTarget(); current = target; render(current);

    // Fondo difuminado: el video copiado a un lienzo de 64×36 px ~15 veces por
    // segundo; el CSS lo agranda y desenfoca. Mucho más liviano que otro video.
    const ctx = canvas.getContext("2d");
    let visible = true, lastDraw = 0, blurRaf = 0;
    const paint = (now: number) => {
      if (visible && ctx && video.readyState >= 2 && now - lastDraw > 66) {
        ctx.drawImage(video, 0, 0, 64, 36);
        lastDraw = now;
      }
      blurRaf = requestAnimationFrame(paint);
    };
    blurRaf = requestAnimationFrame(paint);

    // El video solo corre mientras se ve (ahorra batería y datos en celular).
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (en.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(stage);

    return () => {
      window.clearTimeout(enter);
      removeEventListener("scroll", kick);
      removeEventListener("resize", kick);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(blurRaf);
      io.disconnect();
      ro?.disconnect();
    };
  }, []);

  const title = "Ruido por fuera.";
  let i = 0;

  return (
    <section ref={stageRef} className="vn-stage" aria-label="Ruido por fuera. Terciopelo por dentro.">
      <div className="vn-pin">
        <canvas ref={blurRef} className="vn-blur" width={64} height={36} aria-hidden />
        <div ref={frameRef} className="vn-frame">
          <video ref={videoRef} src={VIDEO} poster={POSTER} autoPlay muted loop playsInline preload="metadata" aria-hidden />
        </div>
        <div ref={noiseRef} className="vn-h-noise">
          <h1 className="vn-wide" aria-label={title}>
            {title.split(" ").map((word, w) => (
              <span key={w}>
                <span className="vn-word" aria-hidden>
                  {word.split("").map((c) => (
                    <span key={i} className="vn-ch" style={{ ["--i" as string]: i++ }}>{c}</span>
                  ))}
                </span>
                {w < title.split(" ").length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <div className="vn-meta">
            <span className="vn-tag" style={{ color: "rgba(237,234,228,.8)" }}>Nueva entrega</span>
            <a className="vn-ghost" href="#entrega">Ver la entrega</a>
          </div>
        </div>
        <div ref={velvetRef} className="vn-h-velvet" aria-hidden>
          <p className="vn-velvet">terciopelo por dentro.</p>
        </div>
      </div>
    </section>
  );
}
