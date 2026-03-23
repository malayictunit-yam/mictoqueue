import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import KioskPage from "./pages/KioskPage.tsx";
import OperatorPage from "./pages/OperatorPage.tsx";
import DisplayPage from "./pages/DisplayPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import AdminDisplayPage from "./pages/AdminDisplayPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/operator/:windowId" element={<OperatorPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/display" element={<AdminDisplayPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
