import { useEffect } from 'react';

type EventDetails = { section: string; item?: string; destination?: string };
/** No PII, message content, form values, or URL query parameters are recorded. */
export function conversionEvent(name: string, details: EventDetails) {
  if (typeof window === 'undefined') return;
  const safe = { section: details.section.slice(0, 80), ...(details.item ? { item: details.item.slice(0, 100) } : {}), ...(details.destination ? { destination: details.destination.split(/[?#]/)[0].slice(0, 180) } : {}) };
  window.dispatchEvent(new CustomEvent('sch:conversion', { detail: { name, ...safe } }));
  const client = window as Window & { gtag?: (...args: unknown[]) => void };
  if (typeof client.gtag === 'function') client.gtag('event', name, safe);
}

export function ConversionEvents() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLAnchorElement>('a[href]');
      if (el?.dataset.share) return; // compartir una obra no es una consulta: lo registra ShareButtons
      const section = el?.closest('section')?.id || (el?.closest('header') ? 'header' : 'footer');
      if (el?.href.startsWith('https://wa.me/')) conversionEvent('whatsapp_click', { section, destination: el.href });
      else if (el && /instagram\.com|facebook\.com|tiktok\.com|pin\.it/.test(el.href)) conversionEvent('social_click', { section, destination: el.href });
      else if (el?.pathname.startsWith('/proyectos/')) conversionEvent('project_click', { section, item: el.pathname });
    };
    const system = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('#sistemas')) conversionEvent('system_interaction', { section: 'sistemas', item: event.type });
    };
    document.addEventListener('click', click);
    document.querySelector('#sistemas')?.addEventListener('click', system);
    document.querySelector('#sistemas')?.addEventListener('change', system);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        conversionEvent('service_view', { section: entry.target.id }); observer.unobserve(entry.target);
      }
    }, { threshold: .25 });
    document.querySelectorAll('#servicios, #sistemas').forEach(el => observer.observe(el));
    return () => {
      document.removeEventListener('click', click);
      document.querySelector('#sistemas')?.removeEventListener('click', system);
      document.querySelector('#sistemas')?.removeEventListener('change', system);
      observer.disconnect();
    };
  }, []);
  return null;
}