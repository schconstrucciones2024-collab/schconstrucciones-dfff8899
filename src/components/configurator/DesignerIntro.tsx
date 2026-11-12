import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const STORAGE_KEY = "sch-guia-disenador-v1";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Elegí cómo querés construir",
    text: "Woodframe (paneles de madera curada, sobre pilotes, obra seca y rápida) o Tradicional (mampostería con revoque, sobre platea de hormigón).",
  },
  {
    title: "Definí la casa en el panel de la derecha",
    text: "Metros cuadrados, cantidad de plantas (de 1 a 3), fundación, terminación, techo, aberturas y, si querés, un deck con o sin techo, en línea Esencial o Premium. Todo se actualiza en el momento.",
  },
  {
    title: "Armá la distribución",
    text: "Elegí una de las distribuciones ya armadas, o dibujá vos la forma exterior, las paredes interiores, las puertas y ventanas, la escalera y los muebles. Con «Dibujar plano» lo hacés sobre un plano en medidas reales.",
  },
  {
    title: "Recorrela y consultá",
    text: "Miralá desde afuera, por dentro, en corte, en planta o en recorrido. Guardá una imagen en 4K o un video, compartí tu diseño con un link y mandale el resumen a SCH por WhatsApp.",
  },
];

const CAN: string[] = [
  "Diseñar casas de hasta 500 m² y 3 plantas",
  "Elegir entre distribuciones ya armadas",
  "Dibujar tu propio plano en medidas reales y verlo en 3D",
  "Cambiar el día y la noche, la hora del sol y el entorno",
  "Ver los materiales y terminaciones de cada sistema",
  "Elegir el deck en línea Esencial (accesible) o Premium y ver en 3D la diferencia de calidad",
  "Probar el render en calidad Económico, Alto o Ultra",
  "Ver los metros cuadrados y la inversión estimada mientras diseñás",
];

/**
 * Descripción del diseñador para quien lo ve por primera vez: qué es, cómo se usa y qué se puede hacer.
 * El párrafo de arriba queda siempre a la vista; la guía se puede plegar (se recuerda en el navegador).
 */
export function DesignerIntro() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "cerrada") setOpen(false);
    } catch { /* sin almacenamiento: queda abierta */ }
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(STORAGE_KEY, next ? "abierta" : "cerrada"); } catch { /* idem */ }
  };
  return (
    <section aria-labelledby="config-intro-title" className="mb-6 border border-border bg-background p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h3 id="config-intro-title" className="font-display text-2xl font-medium sm:text-3xl">¿Qué es el diseñador 3D?</h3>
          <p className="mt-2 text-sm leading-6 text-foreground/80">
            Es una herramienta para armar tu casa en pantalla antes de construirla. Elegís cómo construir, definís el tamaño y la
            distribución, ponés puertas y ventanas, y la recorrés en 3D por fuera y por dentro. Mientras diseñás ves los metros
            cuadrados y una inversión estimada; cuando te guste, se la mandás a SCH por WhatsApp y te hacemos el presupuesto final a
            medida y sin cargo.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="config-intro-body"
          className="inline-flex min-h-11 items-center gap-2 border border-border px-3 text-xs font-medium hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {open ? "Ocultar la guía" : "Ver cómo se usa"}
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div id="config-intro-body" className="mt-6 grid gap-8 border-t border-border pt-6 md:grid-cols-[1.35fr_1fr]">
          <div>
            <h4 className="text-[10px] font-semibold uppercase text-primary">Cómo se usa, paso a paso</h4>
            <ol className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center border border-primary text-xs font-semibold text-primary">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/75">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="text-[10px] font-semibold uppercase text-primary">Lo que podés hacer</h4>
            <ul className="mt-4 space-y-2.5">
              {CAN.map((t) => (
                <li key={t} className="flex gap-2 text-sm leading-6 text-foreground/80">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[11px] leading-5 text-foreground/60">Los valores son estimativos. Para cualquier duda, escribinos y lo vemos juntos.</p>
          </div>
        </div>
      )}
    </section>
  );
}
