import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/contactInquiry";



/** Acceso directo a WhatsApp: aparece al bajar la página y queda fuera del foco mientras está oculto. */
export function FloatingWhatsApp() {
  const visible = true;
  return (
    <Button asChild className="h-auto rounded-none p-0"><a
      href={whatsappUrl("Hola SCH, quiero consultar por mi proyecto.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-4 right-4 z-40 inline-flex size-14 items-center justify-center border border-primary bg-background text-primary shadow-xl transition-[opacity,transform,visibility,background-color,color] duration-500 hover:bg-primary hover:text-primary-foreground sm:bottom-6 sm:right-6 ${visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-3 opacity-0"}`}
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </a></Button>
  );
}
