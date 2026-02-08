import React from 'react';
import { ShieldCheck, Smartphone, CreditCard, ExternalLink } from 'lucide-react';

export default function LandingPage() {
  const whatsappLink = "https://wa.me/5491158809679?text=Hola!%20Vengo%20de%20la%20web%20y%20quiero%20solicitar%20el%20alta%20de%20mi%20comercio%20en%20Cobrix%20Pay.";

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
      {/* --- NAV --- */}
      <nav className="flex justify-between items-center px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center text-white font-bold">✓</div>
          <div className="text-2xl font-black tracking-tighter italic">
            Cobrix<span className="text-[#00D18E]">Pay</span>
          </div>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-semibold text-slate-500">
          <a href="#beneficios" className="hover:text-slate-900 transition"># Beneficios</a>
          <a href="#seguridad" className="hover:text-slate-900 transition"># Seguridad</a>
        </div>
        <a 
          href={whatsappLink}
          className="bg-[#1A1F2B] text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition shadow-lg"
        >
          Contacto Comercial
        </a>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="px-6 pt-12 pb-24 max-w-7xl mx-auto md:flex items-center">
        <div className="md:w-1/2 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[#1A1F2B]">
            Cobrá a <span className="text-[#007AFF]">turistas</span> <br />como nunca antes.
          </h1>
          <p className="mt-6 text-lg text-slate-500 max-w-md leading-relaxed">
            La infraestructura de pagos premium para comercios. Aceptá pagos globales en terminales sin burocracia.
          </p>
          
          {/* LOGOS DE PAGO */}
          <div className="mt-10 flex items-center justify-center md:justify-start gap-6 border-t border-slate-200 pt-8">
            <div className="flex flex-col items-center opacity-60">
              <Smartphone size={20} />
              <span className="text-[10px] font-bold mt-1 uppercase">Apple Pay</span>
            </div>
            <div className="flex flex-col items-center opacity-60">
              <CreditCard size={20} />
              <span className="text-[10px] font-bold mt-1 uppercase">Google Pay</span>
            </div>
            <div className="h-10 w-[1px] bg-slate-200"></div>
            <div className="flex flex-col items-start">
              <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400 font-bold leading-none mb-1">Powered by</span>
              <span className="text-2xl font-black text-slate-900 tracking-tighter italic leading-none">stripe</span>
            </div>
          </div>

          <div className="mt-10">
            <a 
              href={whatsappLink}
              className="bg-[#1A1F2B] text-white px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:scale-105 transition-transform inline-block"
            >
              Solicitar Alta de Comercio
            </a>
          </div>
        </div>
        
        {/* IMAGEN QR (Asegurate de tener qr-ejemplo.png en public/) */}
        <div className="md:w-1/2 mt-16 md:mt-0 flex justify-center relative">
          <div className="w-72 h-[500px] bg-white rounded-[3rem] shadow-2xl border-[8px] border-white overflow-hidden relative z-10">
            <div className="bg-[#007AFF] h-24 flex items-center justify-center">
               <span className="text-white font-bold tracking-widest text-xs uppercase">Cobrix Pay Terminal</span>
            </div>
            <div className="p-8 flex flex-col items-center justify-center h-full -mt-24">
               <img src="/qr-ejemplo.png" alt="QR de ejemplo" className="w-full h-auto mb-6" />
               <div className="bg-[#00D18E] text-white px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Escaneá y Pagá
               </div>
            </div>
          </div>
          {/* Círculo de fondo igual a tu imagen */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-40"></div>
        </div>
      </header>

      {/* --- SECCIÓN SEGURIDAD --- */}
      <section id="seguridad" className="bg-white py-24 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 px-6 py-3 rounded-full mb-8">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
            <span className="text-xl font-black text-slate-900 tracking-tighter italic">stripe</span>
            <span className="text-xs font-bold text-[#00D18E] ml-2">Official Partner</span>
          </div>
          <h2 className="text-4xl font-extrabold text-[#1A1F2B]">Seguridad de Clase Mundial</h2>
          <p className="mt-6 text-slate-500 text-lg leading-relaxed">
            Todas nuestras transacciones están procesadas y encriptadas por <strong>Stripe</strong>. Cumplimos con los estándares internacionales <strong>PCI-DSS</strong> para garantizar que cada centavo de tu comercio esté protegido.
          </p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-16 bg-white px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-t border-slate-100 pt-12">
          <div>
            <div className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-widest">© 2026 Cobrix Pay. Todos los derechos reservados.</div>
            <p className="text-slate-500 text-[11px] leading-relaxed max-w-md italic">
              Cobrix Pay es una marca comercial operada por <span className="text-slate-900 font-bold">Digital Travel LLC</span>, una sociedad legalmente constituida en <span className="text-slate-900 font-bold">Nuevo México, EE.UU.</span>
            </p>
          </div>
          <div className="flex gap-4">
             <a href={whatsappLink} className="text-slate-400 hover:text-blue-600 transition flex items-center gap-1 text-xs font-bold uppercase">
               Soporte <ExternalLink size={12} />
             </a>
          </div>
        </div>
      </footer>
    </div>
  );
}