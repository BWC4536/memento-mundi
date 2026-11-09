import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import SectionPage from "@/pages/SectionPage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import BrandCorner from "./components/BrandCorner";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StorePage from "./pages/StorePage";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/store" component={StorePage} /><Route path="/explore"><SectionPage section="Explorar" /></Route><Route path="/profile"><SectionPage section="Perfil" /></Route><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><BrandCorner /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
