import { useState } from "react";
import { Link2, MessageCircle, Share2 } from "lucide-react";
import { conversionEvent } from "./ConversionEvents";
import { FacebookIcon } from "./socialLinks";

type Props = { url: string; title: string; text: string; item: string };

const button = "inline-flex min-h-12 items-center justify-center gap-2.5 border border-foreground/25 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Enlaces para compartir una obra: WhatsApp, Facebook, copiar el enlace y (si el dispositivo lo ofrece) el menú del sistema. */
export function ShareButtons({ url, title, text, item }: Props) {
  const [status, setStatus] = useState("");
  const track = (network: string) => conversionEvent("project_share", { section: "proyecto", item, destination: network });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Enlace copiado.");
    } catch {
      setStatus(`Copiá este enlace: ${url}`);
    }
    track("copiar");
  };
  const system = async () => {
    try {
      await navigator.share({ title, text, url });
      track("sistema");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("No se pudo abrir el menú de compartir. Probá copiar el enlace.");
    }
  };

  return (
    <div>
      <ul className="flex flex-wrap gap-3" aria-label="Compartir esta obra">
        <li>
          {/* api.whatsapp.com (y no wa.me) para que compartir no se cuente como una consulta comercial. */}
          <a data-share="whatsapp" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp")} className={button}>
            <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
          </a>
        </li>
        <li>
          <a data-share="facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => track("facebook")} className={button}>
            <FacebookIcon size={16} /> Facebook
          </a>
        </li>
        <li>
          <button type="button" onClick={copy} className={button}><Link2 aria-hidden="true" className="size-4" /> Copiar enlace</button>
        </li>
        {canShare && (
          <li>
            <button type="button" onClick={system} className={button}><Share2 aria-hidden="true" className="size-4" /> Más opciones</button>
          </li>
        )}
      </ul>
      <p role="status" className="mt-3 min-h-5 text-sm text-primary">{status}</p>
    </div>
  );
}
