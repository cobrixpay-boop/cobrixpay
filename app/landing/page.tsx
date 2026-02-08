import React from 'react';
import { ShieldCheck, Zap, Globe, Smartphone, CreditCard, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* --- NAV --- */}
      <nav className="flex justify-between items-center px-6 py-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tighter text-blue-600">
          COBRIX<span className="text-slate-400 font-light">PAY</span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
          <a href="#beneficios" className="hover:text-blue-600 transition">Beneficios</a>
          <a href="#seguridad" className="hover:text-blue-600 transition">Seguridad</a>
        </div>
        <a 
          href="https://wa.me/TU_NUMERO_AQUI" 
          className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-blue-600 transition"
        >
          Contacto Comercial
        </a>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="px-6 pt-16 pb-24 max-w-7xl mx-auto text-center md:text-left md:flex items-center">
        <div className="md:w-1/2">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Cobrá a <span className="text-blue-600">turistas</span> como nunca antes.
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-xl">
            La infraestructura de pagos premium para comercios exclusivos en Buenos Aires. Aceptá pagos globales sin terminales ni burocracia.
          </p>
          
          {/* LOGOS DE PAGO */}
          <div className="mt-8 flex items-center justify-center md:justify-start gap-6 opacity-70">
            <div className="flex flex-col items-center">
              <Smartphone className="mb-1" />
              <span className="text-[10px] font-bold">Apple Pay</span>
            </div>
            <div className="flex flex-col items-center">
              <CreditCard className="mb-1" />
              <span className="text-[10px] font-bold">Google Pay</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-widest text-slate-400">Powered by</span>
              <span className="text-lg font-black text-slate-400 tracking-tighter italic">stripe</span>
            </div>
          </div>

          <div className="mt-10">
            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition w-full md:w-auto">
              Solicitar Alta de Comercio
            </button>
          </div>
        </div>
        
        <div className="hidden md:block md:w-1/2 mt-12 md:mt-0 pl-12">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
            <div className="relative bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl max-w-sm mx-auto transform rotate-2">
               <div className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                  <div className="text-center">
                    <div className="bg-white p-4 shadow-sm rounded-lg mb-2">
                       {/* Simulación visual de QR */}
                       <div className="w-24 h-24 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-xs">QR</div>
                    </div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cobrix Pay Terminal</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- TRUST / SECURITY --- */}
      <section id="seguridad" className="bg-slate-50 py-20 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full mb-6 shadow-sm">
            <ShieldCheck size={20} className="text-blue-600" />
            <span className="text-sm font-bold text-slate-700 italic underline">stripe</span>
            <span className="text-sm font-medium text-slate-500">Official Partner</span>
          </div>
          <h2 className="text-3xl font-bold italic">Seguridad de Clase Mundial</h2>
          <p className="mt-4 text-slate-600 text-lg leading-relaxed">
            Todas nuestras transacciones están procesadas y encriptadas por <strong>Stripe</strong>, líder global en pagos digitales. Cumplimos con los estándares PCI-DSS para garantizar que cada centavo de tu comercio esté protegido.
          </p>
        </div>
      </section>

      {/* --- FOOTER LEGAL --- */}
      <footer className="py-12 bg-white px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-slate-400 text-xs">
            © 2026 Cobrix Pay. Todos los derechos reservados.
          </div>
          <div className="text-slate-500 text-[11px] max-w-lg text-center md:text-right leading-relaxed font-medium">
            Cobrix Pay es una marca comercial operada por <span className="text-slate-800 font-bold">Digital Travel LLC</span>, una sociedad legalmente constituida en <span className="text-slate-800 font-bold">Nuevo México, EE.UU.</span> 
            <br />La tecnología de procesamiento de pagos es provista por Stripe Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}