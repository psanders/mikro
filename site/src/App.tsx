/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FAQPage } from "./pages/FAQPage";
import { SolicitudPage } from "./pages/SolicitudPage";
import { SolicitudV0Page } from "./pages/SolicitudV0Page";
import { BrandPage } from "./pages/BrandPage";
import { ScrollToTop } from "./components/ScrollToTop";
import { MetaPixelPageViews } from "./components/MetaPixelPageViews";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <MetaPixelPageViews />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/solicitud" element={<SolicitudPage />} />
        {/* The previous accordion form, kept for comparison or a quick revert. */}
        <Route path="/solicitud-v0" element={<SolicitudV0Page />} />
        <Route path="/marca" element={<BrandPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
