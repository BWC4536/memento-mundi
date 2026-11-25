import { Fragment, useEffect } from "react";
import { ArrowLeft, Cookie } from "lucide-react";
import { Link } from "wouter";
import PageHero from "@/components/home/PageHero";
import { PAISAJES } from "@/lib/paisajes";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { LEGAL_DOCS, LEGAL_LIST, LEGAL_UPDATED, type LegalBlock, type LegalSlug } from "@/lib/legal";

/** Resalta los datos pendientes de rellenar ([...]) para que no pasen desapercibidos. */
function Text({ value }: { value: string }) {
  const parts = value.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={index} className="rounded bg-orange/35 px-1 text-ink">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p className="leading-relaxed text-ink/80"><Text value={block} /></p>;
  if ("list" in block) {
    return (
      <ul className="space-y-2">
        {block.list.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed text-ink/80">
            <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange ring-2 ring-ink" />
            <span><Text value={item} /></span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {/* Tabla en escritorio, tarjetas en móvil */}
      <div className="hidden overflow-hidden rounded-2xl border-2 border-ink sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-cream">
            <tr>{block.table.head.map((cell) => <th key={cell} className="px-4 py-3 text-[10px] font-black uppercase tracking-[.14em]">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.table.rows.map((row) => (
              <tr key={row[0]} className="border-t-2 border-ink/10 bg-white/50">
                {row.map((cell, index) => <td key={index} className={`px-4 py-3 align-top ${index === 0 ? "break-all font-black" : "font-medium text-ink/75"}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 sm:hidden">
        {block.table.rows.map((row) => (
          <dl key={row[0]} className="rounded-2xl border-2 border-ink bg-white/50 p-4 text-sm">
            <dt className="break-all font-black">{row[0]}</dt>
            {row.slice(1).map((cell, index) => (
              <dd key={index} className="mt-1 font-medium text-ink/70">
                <span className="font-black text-ink/45">{block.table.head[index + 1]}: </span>
                {cell}
              </dd>
            ))}
          </dl>
        ))}
      </div>
    </>
  );
}

export default function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCS[slug];

  useEffect(() => {
    document.title = `${doc.title} · Memento Mundi`;
    window.scrollTo({ top: 0 });
  }, [doc.title]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#EAE7DA] px-4 pb-36 pt-24 sm:px-8 sm:pt-28 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex justify-end">
          <Link href="/perfil#legal" className="flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <ArrowLeft size={16} /> Volver al perfil
          </Link>
        </div>

        <nav aria-label="Documentos legales" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {LEGAL_LIST.map((item) => (
            <Link
              key={item.slug}
              href={item.path}
              aria-current={item.slug === slug ? "page" : undefined}
              className={`shrink-0 rounded-full border-2 border-ink px-4 py-2 text-xs font-black ${item.slug === slug ? "bg-ink text-cream" : "bg-white/50"}`}
            >
              {item.short}
            </Link>
          ))}
        </nav>

        <PageHero compact className="mt-6" photo={PAISAJES.bratislavaIglesia} eyebrow={`Actualizada el ${LEGAL_UPDATED}`} title={doc.title} />

        <article className="mt-6 rounded-[2rem] border-2 border-ink bg-white/60 p-5 shadow-hard sm:p-10">
          <p className="text-lg font-semibold text-ink/65">{doc.summary}</p>

          {slug === "cookies" ? (
            <button type="button" onClick={openCookiePreferences} className="mt-6 flex min-h-12 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-5 text-sm font-black shadow-hard-sm">
              <Cookie size={17} /> Configurar cookies
            </button>
          ) : null}

          <div className="mt-8 space-y-8 text-base sm:text-[17px]">
            {doc.sections.map((section, index) => (
              <section key={section.heading} aria-labelledby={`legal-${index}`}>
                <h2 id={`legal-${index}`} className="flex items-baseline gap-3 !text-2xl sm:!text-3xl">
                  <span className="font-mono text-base text-orange">{String(index + 1).padStart(2, "0")}</span>
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
