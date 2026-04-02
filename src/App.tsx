import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import KioskPage from "./pages/KioskPage.tsx";
import OperatorPage from "./pages/OperatorPage.tsx";
import OperatorSelectPage from "./pages/OperatorSelectPage.tsx";
import DisplayPage from "./pages/DisplayPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import AdminDisplayPage from "./pages/AdminDisplayPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route
            path="/operator"
            element={
              <ProtectedRoute>
                <OperatorSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/:windowId"
            element={
              <ProtectedRoute>
                <OperatorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/display"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDisplayPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
