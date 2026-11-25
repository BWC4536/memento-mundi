import { RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import Mascot from "@/components/ui/Mascot";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-cream p-4 text-ink">
          <section className="w-full max-w-xl rounded-[2rem] border-2 border-ink bg-white/70 p-6 text-center shadow-hard sm:p-10">
            <Mascot name="21-error-404-perdido" size="md" mobileSize="sm" className="mx-auto" decorative={false} alt="La mascota de Memento Mundi, desorientada" />
            <h1 className="mt-4 font-display !text-4xl sm:!text-5xl">Algo ha salido mal.</h1>
            <p className="mx-auto mt-3 max-w-sm text-base font-medium leading-relaxed text-ink/65">
              Ha ocurrido un error inesperado. Recarga la página para seguir con tu viaje.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="sticker-button mx-auto mt-7 flex min-h-12 items-center gap-2 rounded-xl border-2 border-ink bg-orange px-6 text-sm font-black shadow-hard-sm"
            >
              <RotateCcw size={16} />
              Recargar página
            </button>

            {this.state.error?.stack ? (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-ink/55">Detalles técnicos</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl border-2 border-ink/15 bg-cream p-3 text-xs text-ink/70 whitespace-break-spaces">
                  {this.state.error.stack}
                </pre>
              </details>
            ) : null}
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
