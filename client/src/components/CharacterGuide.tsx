import { motion } from "framer-motion";

interface CharacterGuideProps {
  character: "miriam" | "arturo";
  speech: string;
  subtext?: string;
  position?: "left" | "right";
  className?: string;
}

export default function CharacterGuide({
  character,
  speech,
  subtext,
  position = "right",
  className = "",
}: CharacterGuideProps) {
  const isMiriam = character === "miriam";
  const name = isMiriam ? "Miriam" : "Arturo";
  const imgSrc = isMiriam ? "/miriam_pegatina.svg" : "/arturo_sinterminar.svg";

  return (
    <motion.aside
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`inline-flex max-w-full items-end gap-3 sm:gap-4 ${
        position === "left" ? "flex-row-reverse" : "flex-row"
      } ${className}`}
      aria-label={`${name} dice: ${speech}`}
    >
      {/* Bocadillo de diálogo con estilo cómic editorial y sombra brutalista */}
      <div className="relative min-w-0 max-w-[280px] sm:max-w-sm rounded-2xl border-2 border-ink bg-white/95 p-3 sm:p-4 shadow-hard-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-2 w-2 rounded-full bg-orange animate-pulse" />
          <span className="font-brand text-[11px] font-black uppercase tracking-wider text-orange">
            {name}
          </span>
        </div>
        <p className="font-sans text-xs sm:text-sm font-bold leading-snug text-ink">
          "{speech}"
        </p>
        {subtext && (
          <p className="mt-1 text-[10px] font-medium text-ink/60">
            {subtext}
          </p>
        )}
        {/* Pico del bocadillo */}
        <div
          className={`absolute -bottom-2 ${
            position === "left" ? "left-4" : "right-4"
          } h-3 w-3 rotate-45 border-r-2 border-b-2 border-ink bg-white`}
        />
      </div>

      {/* Ilustración del personaje con marco tipo pegatina brutalista */}
      <div className="relative shrink-0">
        <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 border-ink bg-cream shadow-hard-sm transition-transform hover:scale-105 active:scale-95">
          <img
            src={imgSrc}
            alt={name}
            className="h-full w-full object-cover object-top select-none"
          />
        </div>
      </div>
    </motion.aside>
  );
}

