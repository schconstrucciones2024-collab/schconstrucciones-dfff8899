import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/contactInquiry";

/**
 * Acceso directo a WhatsApp, siempre visible (en el celular el botón principal del inicio queda debajo de la primera pantalla).
 *
 * Es un enlace común y no un `<Button asChild>`: el Button le suma `h-auto` y ese `h-auto` le ganaba a `size-14`,
 * así que el botón se dibujaba como una barra de 56 × 18 px. Acá el tamaño es fijo (56 × 56 px, bien por encima de los 44 px
 * que pide un toque cómodo) y respeta el área segura de los celulares con barra de gestos.
 */
export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappUrl("Hola SCH, quiero consultar por mi proyecto.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 inline-flex size-14 items-center justify-center border border-primary bg-background text-primary shadow-xl transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:bottom-6 sm:right-6"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
    </a>
  );
}
