import { Instagram, MessageCircle } from "lucide-react";
import type { ComponentType } from "react";
import { CONTACT } from "@/data/projects";

type IconProps = { size?: number; className?: string };

export function FacebookIcon({ size = 24, className }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.6-.1-1.4-.2-2.2-.2-2.2 0-3.7 1.3-3.7 3.8V11H8v3h2.5v7h3z" /></svg>;
}

export function TikTokIcon({ size = 24, className }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M16.6 3c.4 2.1 1.7 3.4 3.9 3.6v3c-1.5 0-2.8-.5-3.9-1.3v6.2c0 3.6-2.5 6-5.9 6-3.2 0-5.7-2.3-5.7-5.6 0-3.4 2.8-5.9 6.3-5.6v3.1c-1.7-.3-3.2.7-3.2 2.5 0 1.5 1.1 2.5 2.6 2.5 1.7 0 2.8-1.2 2.8-3.2V3h3.1z" /></svg>;
}

export function PinterestIcon({ size = 24, className }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M12 3C7 3 3.5 6.6 3.5 11c0 2.4 1.3 4.5 3.3 5.3.2.1.3 0 .3-.2l.4-1.5c.1-.2 0-.3-.1-.4-.6-.8-1-1.8-1-3.1 0-2.9 2.2-5.6 5.8-5.6 3.2 0 5.3 1.9 5.3 4.6 0 3.4-1.5 6.2-3.7 6.2-1.2 0-2.1-1-1.8-2.2.3-1.3 1-2.7 1-3.7 0-.9-.5-1.6-1.4-1.6-1.1 0-2 1.2-2 2.7 0 1 .3 1.7.3 1.7l-1.4 5.7c-.4 1.7-.1 3.8 0 4 .1.1.2.2.3.1.1-.1 1.6-2 2.1-3.8l.8-3c.5.9 1.8 1.6 3.2 1.6 4.2 0 7-3.8 7-8.8C20.5 6.5 16.8 3 12 3z" /></svg>;
}

export function GoogleIcon({ size = 24, className }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M21.4 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.3c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.8 2.9-4.4 2.9-7.4z" /><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6C4.7 19.7 8.1 22 12 22z" /><path d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.5l3.3-2.6z" /><path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9z" /></svg>;
}

export type Social = { Icon: ComponentType<IconProps>; label: string; handle: string; href: string };

/** Redes y canales oficiales de SCH, en el orden del sitio original. */
export const SOCIALS: Social[] = [
  { Icon: Instagram, label: "Instagram", handle: "@sch_construcciones_", href: CONTACT.instagram },
  { Icon: FacebookIcon, label: "Facebook", handle: "SCH Construcciones", href: CONTACT.facebook },
  { Icon: TikTokIcon, label: "TikTok", handle: "@sch_construcciones_", href: CONTACT.tiktok },
  { Icon: PinterestIcon, label: "Pinterest", handle: "SCH Construcciones", href: CONTACT.pinterest },
  { Icon: GoogleIcon, label: "Google", handle: "SCH Construcciones", href: CONTACT.google },
  { Icon: MessageCircle, label: "WhatsApp", handle: CONTACT.whatsappLabel, href: CONTACT.whatsapp },
];
