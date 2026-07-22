/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FAQPage } from "./pages/FAQPage";
import { SolicitudPage } from "./pages/SolicitudPage";
import { BrandPage } from "./pages/BrandPage";
import { ScrollToTop } from "./components/ScrollToTop";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/solicitud" element={<SolicitudPage />} />
        <Route path="/marca" element={<BrandPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
