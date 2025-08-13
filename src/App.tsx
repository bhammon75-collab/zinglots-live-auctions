import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Shows from "./pages/Shows";
import Category from "./pages/Category";
import SellerProfile from "./pages/SellerProfile";
import ProductDetail from "./pages/ProductDetail";
import CartInvoice from "./pages/CartInvoice";
import DashboardBuyer from "./pages/DashboardBuyer";
import DashboardSeller from "./pages/DashboardSeller";
import Admin from "./pages/Admin";
import Discover from "./pages/Discover";
import QA from "./pages/QA";
import Login from "./pages/Login";
import AuctionRoom from "./pages/AuctionRoom";
import GoLive from "./pages/seller/GoLive";
import Live from "./pages/Live";
import SellerApply from "./pages/sellers/Apply";
import Help from "./pages/Help";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/shows" element={<Shows />} />
              <Route path="/live" element={<Live />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/category/:slug" element={<Category />} />
              <Route path="/seller/:id" element={<SellerProfile />} />
              <Route path="/seller/apply" element={<SellerApply />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<CartInvoice />} />
              <Route path="/dashboard/buyer" element={<DashboardBuyer />} />
              <Route path="/dashboard/seller" element={<DashboardSeller />} />
              <Route path="/seller/live" element={<GoLive />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/qa" element={<QA />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auction/:lotId" element={<AuctionRoom />} />
              <Route path="/help" element={<Help />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
