import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Virtualización ligera del feed: cada publicación solo se monta cuando está cerca de la vista.
 * Al alejarse más de `margin` px se desmonta y deja un hueco con su altura medida, así las
 * fotos y vídeos de lo ya visto se liberan de memoria y el scroll no da saltos.
 *
 * Funciona con el scroll de la página o de cualquier contenedor (IntersectionObserver sin root).
 */
type Props = {
  children: ReactNode;
  /** Altura estimada antes de medir (px). */
  estimate?: number;
  /** Distancia (px) por encima y por debajo de la vista en la que se mantiene montado. */
  margin?: number;
  /** Montar desde el principio (p. ej. las primeras publicaciones). */
  initiallyVisible?: boolean;
  className?: string;
};

export default function FeedWindow({ children, estimate = 640, margin = 1600, initiallyVisible = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initiallyVisible);
  const height = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => entry && setVisible(entry.isIntersecting), { rootMargin: `${margin}px 0px` });
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin]);

  // Mientras está montado, recordamos su altura real para que el hueco mida lo mismo al desmontar.
  useEffect(() => {
    const element = ref.current;
    if (!element || !visible || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry?.contentRect.height;
      if (measured) height.current = measured;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { height: height.current ?? estimate }}>
      {visible ? children : null}
    </div>
  );
}
