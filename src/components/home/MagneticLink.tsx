import { useRef, type AnchorHTMLAttributes } from "react";
import { useMagnetic } from "@/lib/motion";

/** Enlace que se acerca apenas al puntero (solo con mouse) y muestra un brillo al pasar. Es un `<a>` común. */
export function MagneticLink({ className = "", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const ref = useRef<HTMLAnchorElement>(null);
  useMagnetic(ref, 0.22, 8);
  return (
    <a ref={ref} className={`magnetic btn-sheen ${className}`} {...rest}>
      {children}
    </a>
  );
}
