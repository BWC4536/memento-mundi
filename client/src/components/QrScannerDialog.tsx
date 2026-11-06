import { useEffect, useRef, useState } from "react";
import { Camera, Check, Keyboard, QrCode, X } from "lucide-react";
import { motion } from "framer-motion";

export default function QrScannerDialog({ onClose, onDetected, onPhoto }: { onClose: () => void; onDetected?: (value: string) => void; onPhoto?: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("Apunta al QR de tu pegatina.");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [detected, setDetected] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const stop = () => streamRef.current?.getTracks().forEach((track) => track.stop());
    const start = async () => {
      const BarcodeDetectorCtor = (window as Window & { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
      if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) { setCameraAvailable(false); setMessage("Este navegador no ofrece lectura QR directa."); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled || !videoRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const result = await detector.detect(videoRef.current);
            const value = result[0]?.rawValue;
            if (value) { setDetected(true); setMessage("QR encontrado. Recuerdo listo."); stop(); onDetected?.(value); return; }
          } catch { /* El detector puede fallar mientras enfoca; seguimos intentando. */ }
          frame = window.requestAnimationFrame(scan);
        };
        scan();
      } catch { setCameraAvailable(false); setMessage("No se pudo abrir la cámara. Comprueba los permisos o usa el código manual."); }
    };
    void start();
    return () => { cancelled = true; window.cancelAnimationFrame(frame); stop(); };
  }, [onDetected]);

  const submitManual = () => { if (manual.trim().length < 3) { setMessage("Escribe un código válido para continuar."); return; } setDetected(true); setMessage("Código recibido. Recuerdo listo."); onDetected?.(manual.trim()); };

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/65 p-3 backdrop-blur-md sm:items-center sm:p-5"><motion.div initial={{ y: 24, scale: .98 }} animate={{ y: 0, scale: 1 }} className="relative w-full max-w-md overflow-hidden rounded-[2rem] border-2 border-ink bg-cream p-4 shadow-hard sm:p-6"><button type="button" onClick={onClose} aria-label="Cerrar escáner" className="absolute right-4 top-4 z-20 rounded-full border-2 border-ink bg-white/75 p-2"><X size={17} /></button><div className="flex items-center gap-3 pr-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-orange shadow-hard-sm"><QrCode size={25} /></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-orange">Escanear recuerdo</p><h2 className="font-display text-2xl font-black">Encuentra tu QR.</h2></div></div><div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-[1.5rem] border-2 border-ink bg-ink"><video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cameraAvailable ? "" : "hidden"}`} />{photoPreview && <img src={photoPreview} alt="Foto capturada" className="absolute inset-0 h-full w-full object-cover" />}<div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-orange shadow-[0_0_0_999px_rgba(11,33,48,.35)]" />{!cameraAvailable && !photoPreview && <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-cream"><Camera size={32} className="text-orange" /><p className="mt-3 text-sm font-black">Cámara no disponible</p><p className="mt-1 text-xs text-cream/65">Puedes introducir el token debajo o sacar una foto.</p></div>}{detected && <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/80 text-center text-cream"><div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-orange text-ink"><Check size={30} /></div><p className="mt-4 font-display text-2xl font-black">¡Listo!</p></div>}</div><p className="mt-3 text-center text-xs font-bold text-ink/65">{message}</p><input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); setPhotoPreview(url); setMessage("Foto capturada. Puedes añadirla a tu recuerdo."); onPhoto?.(url); }} /><button type="button" onClick={() => photoRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-orange px-4 py-3 text-sm font-black shadow-hard-sm"><Camera size={17} /> Sacar una foto</button><div className="mt-3 flex gap-2"><input value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitManual()} placeholder="Código manual" className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-white/75 px-3 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-orange/35" /><button type="button" onClick={submitManual} aria-label="Validar código" className="rounded-xl border-2 border-ink bg-orange px-4 shadow-hard-sm"><Keyboard size={18} /></button></div><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl border-2 border-ink bg-ink px-4 py-3 text-sm font-black text-cream">Cerrar</button></motion.div></motion.div>;
}
