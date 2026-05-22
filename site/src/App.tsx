/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FAQPage } from "./pages/FAQPage";
import { SolicitudPage } from "./pages/SolicitudPage";
import { ScrollToTop } from "./components/ScrollToTop";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/solicitud" element={<SolicitudPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
