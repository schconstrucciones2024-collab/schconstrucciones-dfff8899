import { useEffect, useRef, useState } from "react";
import { Banknote, Check, CircleCheck, Clock3, HardHat, Instagram, Mail, MessageCircle, Minus, PackageMinus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FAQ_CATEGORIES, FAQ_WHATSAPP, faqs, type FaqBlock, type FaqCategory } from "@/data/faqs";
import "./faq.css";

const icons = { clock: Clock3, payment: Banknote, included: CircleCheck, excluded: PackageMinus, foundation: HardHat };

function AnswerBlock({ block }: { block: FaqBlock }) {
  if (block.type === "table") return (
    <div className="overflow-x-auto rounded-sm border border-border focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label={block.caption}>
      <table className="w-full min-w-[560px] table-fixed text-left text-sm leading-6">
        <caption className="sr-only">{block.caption}</caption>
        <thead className="bg-secondary text-primary"><tr>{block.headers.map((header) => <th key={header} scope="col" className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row) => <tr key={row[0]} className="border-t border-border">{row.map((cell, index) => index === 0 ? <th key={index} scope="row" className="px-4 py-4 font-medium text-foreground">{cell}</th> : <td key={index} className="px-4 py-4 text-foreground/80">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  if (block.type === "list") return <ul className="grid gap-3 sm:grid-cols-2">{block.items.map((item) => <li key={item} className="flex gap-3 leading-7">{block.checked ? <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary"/> : <Minus aria-hidden="true" className="mt-1 size-5 shrink-0 text-foreground/80"/>}<span>{item}</span></li>)}</ul>;
  if (block.type === "steps") return <ol className="grid gap-4 border-y border-border py-6 sm:grid-cols-4">{block.items.map((item, index) => <li key={item} className="flex items-center gap-3 sm:block"><span className="font-display text-2xl font-semibold text-primary">0{index + 1}</span><p className="text-sm leading-6 sm:mt-3">{item}</p></li>)}</ol>;
  if (block.type === "highlight") return <p className="border-l-2 border-primary bg-primary/5 px-5 py-4 font-medium leading-7 text-foreground">{block.text}</p>;
  if (block.type === "note") return <p className="text-xs leading-6 text-foreground/75">{block.text}</p>;
  return <div>{block.title && <h4 className="mb-2 font-display text-lg font-semibold text-primary">{block.title}</h4>}<p className="leading-7">{block.text}</p></div>;
}

export function FAQSection() {
  const [category, setCategory] = useState<FaqCategory>("Todas");
  const [openId, setOpenId] = useState(faqs[0]?.id ?? "");
  const [focusId, setFocusId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const visible = faqs.filter((faq) => category === "Todas" || faq.category === category);

  useEffect(() => {
    const followHash = () => {
      const id = window.location.hash.slice(1);
      if (!faqs.some((faq) => faq.id === id)) return;
      setCategory("Todas");
      setOpenId(id);
      setFocusId(id);
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  useEffect(() => {
    if (!focusId) return;
    const frame = requestAnimationFrame(() => {
      const trigger = sectionRef.current?.querySelector<HTMLButtonElement>(`[data-faq-id="${focusId}"]`);
      trigger?.focus({ preventScroll: true });
      trigger?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      setFocusId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, openId, category]);

  function filter(next: FaqCategory) {
    setCategory(next);
    if (!faqs.some((faq) => faq.id === openId && (next === "Todas" || faq.category === next))) {
      setOpenId(faqs.find((faq) => next === "Todas" || faq.category === next)?.id ?? "");
    }
  }

  return (
    <section ref={sectionRef} id="preguntas-frecuentes" aria-labelledby="faq-title" className="faq-section scroll-mt-28 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-36">
        <p className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs"><span aria-hidden="true" className="h-px w-10 bg-primary" />FAQ</p>
        <h2 id="faq-title" className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.01em] sm:text-5xl lg:text-6xl">Preguntas frecuentes</h2>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-foreground/80 sm:text-base">Lo que más nos consultan antes de construir, respondido con claridad y sin letra chica.</p>

        <div className="mt-9 flex flex-wrap gap-2" role="group" aria-label="Filtrar preguntas por categoría">
          {FAQ_CATEGORIES.map((filterCategory) => <Button key={filterCategory} variant={category === filterCategory ? "default" : "outline"} aria-pressed={category === filterCategory} onClick={() => filter(filterCategory)} className="min-h-11 rounded-none px-5 hover:bg-primary/90 hover:text-primary-foreground">{filterCategory}</Button>)}
        </div>

        <Accordion type="single" collapsible value={openId} onValueChange={setOpenId} className="mt-8 border-t border-border">
          {visible.map((faq) => {
            const Icon = icons[faq.icon];
            return <AccordionItem key={faq.id} value={faq.id} id={faq.id} className="scroll-mt-28">
              <AccordionTrigger data-faq-id={faq.id} className="gap-4 py-6 text-base font-semibold transition-none hover:no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-lg [&>svg]:text-primary [&>svg]:motion-reduce:transition-none">
                <span className="flex min-w-0 items-center gap-4"><Icon aria-hidden="true" className="size-5 shrink-0 text-primary"/><span>{faq.question}</span></span>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pb-8 text-sm text-foreground/85 sm:pl-9 sm:pr-8 sm:text-base">
                {faq.label && <p className="text-xs font-semibold uppercase text-primary">{faq.label}</p>}
                {faq.blocks.map((block, index) => <AnswerBlock key={index} block={block}/>)}
                {faq.image && <img src={faq.image.src} alt={faq.image.alt} width={faq.image.width} height={faq.image.height} loading="lazy" className="h-auto w-full rounded-sm object-cover"/>}
              </AccordionContent>
            </AccordionItem>;
          })}
        </Accordion>

        <div className="mt-12 rounded-sm border border-border bg-secondary p-6 sm:p-8">
          <p className="font-display text-2xl font-semibold">¿Te quedó alguna duda?</p>
          <p className="mt-3 text-sm leading-7 text-foreground/80">Contanos tu proyecto y te respondemos.</p>
          <Button asChild size="lg" className="mt-6 min-h-12 w-full whitespace-normal bg-whatsapp px-5 text-center text-background hover:bg-whatsapp/90 sm:w-auto"><a href={FAQ_WHATSAPP} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/> Consultar por WhatsApp</a></Button>
          <div className="mt-6 flex flex-col items-start gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <a href="https://instagram.com/sch_construcciones_" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"><Instagram aria-hidden="true" className="size-4 shrink-0 text-primary"/>@sch_construcciones_</a>
            <a href="mailto:sch.construcciones2024@gmail.com" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center gap-2 text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"><Mail aria-hidden="true" className="size-4 shrink-0 text-primary"/><span className="break-all">sch.construcciones2024@gmail.com</span></a>
            <span className="text-foreground/80">095 564 068</span>
          </div>
        </div>
      </div>
    </section>
  );
}