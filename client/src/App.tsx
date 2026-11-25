import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import SectionPage from "@/pages/SectionPage";
import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import BrandCorner from "./components/BrandCorner";
import CookieConsent from "./components/CookieConsent";
import LoginDialog from "./components/LoginDialog";
import MobileNav from "./components/MobileNav";
import NavigationDock from "./components/NavigationDock";
import { ScrapbookLibraryProvider } from "./contexts/ScrapbookLibraryContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAppPreferences } from "./lib/app-preferences";
import Home from "./pages/Home";
import LegalPage from "./pages/LegalPage";
import ProfilePage from "./pages/ProfilePage";
import ScrapbookEditorPage from "./pages/ScrapbookEditorPage";
import StorePage from "./pages/StorePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/store" component={StorePage} />
      <Route path="/scrapbooks/:id">{(params) => <ScrapbookEditorPage id={params.id} />}</Route>
      <Route path="/explore"><SectionPage section="Explorar" /></Route>
      <Route path="/perfil" component={ProfilePage} />
      <Route path="/profile"><Redirect to="/perfil" replace /></Route>
      <Route path="/privacidad"><LegalPage slug="privacidad" /></Route>
      <Route path="/terminos"><LegalPage slug="terminos" /></Route>
      <Route path="/cookies"><LegalPage slug="cookies" /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  // "Reducir animaciones" del perfil: fuerza el modo reducido aunque el sistema no lo pida.
  const { reduceMotion } = useAppPreferences();
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        {/* Respeta prefers-reduced-motion en todas las animaciones de Framer Motion */}
        <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <TooltipProvider>
          <Toaster />
          <BrandCorner />
          <MobileNav />
          <ScrapbookLibraryProvider>
            <Router />
          </ScrapbookLibraryProvider>
          <NavigationDock />
          <LoginDialog />
          <CookieConsent />
        </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
