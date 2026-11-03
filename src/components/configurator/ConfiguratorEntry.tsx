import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ClientOnly } from '@tanstack/react-router';
const Configurator = lazy(() => import('./Configurator'));
export function ConfiguratorEntry() {
  const ref = useRef<HTMLDivElement>(null), [near, setNear] = useState(false);
  useEffect(() => { const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: '400px' }); if (ref.current) observer.observe(ref.current); return () => observer.disconnect(); }, []);
  return <div ref={ref} id="disenar" className="scroll-mt-20"><ClientOnly fallback={<div className="min-h-24" />}>{near ? <Suspense fallback={<div className="min-h-24" />}><Configurator /></Suspense> : <div className="min-h-24" />}</ClientOnly></div>;
}
