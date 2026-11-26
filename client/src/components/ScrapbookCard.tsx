import { useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { motion, type Variants } from "framer-motion";
import { Ellipsis, Layers, Lock, MapPin, UserRound } from "lucide-react";
import type { Scrapbook, ScrapbookMember } from "@/lib/scrapbooks";

/** Entrada escalonada del grid: el contenedor reparte el retardo entre las tarjetas. */
export const scrapbookGridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 26 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

const AVATAR_COLORS = ["bg-[#f2c5a0]", "bg-[#d8e2dc]", "bg-[#e7d8c2]", "bg-[#d7dfd6]", "bg-orange"];
const MAX_AVATARS = 4;

/** Inicial del avatar: la del @usuario si lo tiene; si no, la del nombre. */
export function memberInitial(member: Pick<ScrapbookMember, "name" | "username"> | undefined) {
  const source = member?.username?.replace(/^@+/, "").trim() || member?.name?.trim() || "";
  const first = Array.from(source)[0];
  return first ? first.toLocaleUpperCase("es") : "";
}

function MemberAvatar({ member }: { member: ScrapbookMember | undefined }) {
  const [broken, setBroken] = useState(false);
  if (member?.avatarUrl && !broken) {
    return <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />;
  }
  const initial = memberInitial(member);
  return initial ? <>{initial}</> : <UserRound size={13} aria-hidden />;
}

/**
 * Tamaño del título: la Brasika es ancha (~.74 em por letra), así que se calcula para que quepa en UNA línea
 * dentro de la tarjeta (unidades de contenedor). Si ni así cabe (título muy largo), baja a un mínimo legible y pasa a 2 líneas.
 */
const titleSize = (title: string) => {
  const length = Math.max(title.trim().length, 1);
  return `clamp(1.05rem, calc(74cqi / ${(length * 0.74).toFixed(2)}), 1.9rem)`;
};

/** Número de elementos del lienzo (fotos, pegatinas, textos…); si aún no hay composición, el contador del servidor. */
export function countScrapbookItems(book: Scrapbook) {
  return Math.max(book.photos, book.composition?.elements.length ?? 0);
}

function AvatarStack({ members, total }: { members: ScrapbookMember[]; total: number }) {
  const shown = Math.min(total, MAX_AVATARS);
  const extra = total - shown;
  return (
    <div className="flex items-center -space-x-2" aria-label={`${total} ${total === 1 ? "persona" : "personas"}`} role="img">
      {Array.from({ length: shown }, (_, index) => {
        const member = members[index];
        return (
          <span
            key={index}
            title={member?.username ? `@${member.username}` : member?.name || undefined}
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink text-[11px] font-black ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
            style={{ zIndex: shown - index }}
          >
            <MemberAvatar member={member} />
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="relative flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-ink px-1.5 text-[10px] font-black text-cream">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

type ScrapbookCardProps = {
  book: Scrapbook;
  menuOpen: boolean;
  onOpen: () => void;
  onToggleMenu: () => void;
  /** Menú contextual (se pinta dentro de la tarjeta, posicionado en absoluto). */
  menu?: ReactNode;
  /** React 19: `ref` llega como prop; AnimatePresence (popLayout) lo necesita para medir la tarjeta al salir. */
  ref?: Ref<HTMLElement>;
};

export default function ScrapbookCard({ book, menuOpen, onOpen, onToggleMenu, menu, ref }: ScrapbookCardProps) {
  const items = countScrapbookItems(book);
  // El propietario cuenta como una persona más, igual que antes en la tarjeta.
  const people = book.members?.length ? book.members.length : book.invited + 1;
  const isPrivate = book.isPublic === false;

  return (
    <motion.article
      ref={ref}
      layout
      variants={cardVariants}
      exit="exit"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${book.title}`}
      className={`@container group relative flex h-full cursor-pointer flex-col rounded-[1.5rem] border-2 border-ink ${book.palette} p-2.5 shadow-hard-sm transition-shadow duration-200 hover:shadow-hard focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 sm:p-3 ${menuOpen ? "z-30" : "z-0"}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.1rem] border-2 border-ink bg-cream">
        <img
          src={book.cover}
          alt={`Portada de ${book.title}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>

      <button
        type="button"
        aria-label={`Más opciones para ${book.title}`}
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu();
        }}
        className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-cream transition-transform hover:scale-105 sm:right-5 sm:top-5"
      >
        <Ellipsis size={18} />
      </button>
      {menu}

      <div className="flex min-w-0 flex-1 flex-col px-1 pb-0.5 pt-3.5">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 line-clamp-2 break-words font-display font-black !leading-[1] tracking-[-.01em] ![font-size:var(--title-size)]" style={{ "--title-size": titleSize(book.title) } as CSSProperties} title={book.title}>
            {book.title}
          </h2>
          {isPrivate ? (
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-cream" title="Privado" aria-label="Privado">
              <Lock size={13} aria-hidden />
            </span>
          ) : null}
        </div>

        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[.16em] text-ink/60">
          <MapPin size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{book.location}</span>
        </p>

        <p className="mt-2 line-clamp-1 text-sm font-medium text-ink/60" title={book.description}>
          {book.description || " "}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t-2 border-ink/15 pt-3">
          <AvatarStack members={book.members ?? []} total={people} />
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-cream/70 px-2.5 py-1 text-[11px] font-black">
            <Layers size={13} aria-hidden />
            {items} {items === 1 ? "elemento" : "elementos"}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
