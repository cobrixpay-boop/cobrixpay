import React from 'react';
import { ShieldCheck, Zap, Globe, Smartphone, CreditCard } from 'lucide-react';

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
          Contacto
        </a>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="px-6 pt-16 pb-24 max-w-7xl mx-auto text-center md:text-left md:flex items-center">
        <div className="md:w-1/2">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Cobrá a <span className="text-blue-600">turistas</span> como nunca antes.
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-xl">
            La solución premium para comercios en Buenos Aires. Aceptá Apple Pay y Google Pay con una tasa fija del 4%. Sin terminales, sin burocracia.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition">
              Obtener mi QR
            </button>
            <div className="flex items-center gap-3 px-4">
              <div className="flex -space-x-2">
                {/* Placeholder para logos de Apple/Google Pay */}
                <span className="w-10 h-10 bg-slate-100 border border-white rounded-full flex items-center justify-center text-[10px] font-bold">Pay</span>
                <span className="w-10 h-10 bg-slate-100 border border-white rounded-full flex items-center justify-center text-[10px] font-bold">GPay</span>
              </div>
              <span className="text-sm text-slate-500 font-medium">Compatible con billeteras globales</span>
            </div>
          </div>
        </div>
        <div className="hidden md:block md:w-1/2 mt-12 md:mt-0 pl-12">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
            <div className="relative bg-white border border-slate-100 p-8 rounded-3xl shadow-2xl max-w-sm mx-auto transform rotate-3">
               {/* Simulación de un QR en la landing */}
               <div className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200">
                  <span className="text-slate-300 text-sm italic font-mono text-center px-4">QR de Cobrix Pay para tu local</span>
               </div>
               <div className="mt-6 space-y-2">
                 <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                 <div className="h-4 bg-slate-50 rounded w-1/2"></div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- FEATURES --- */}
      <section id="beneficios" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center text-white">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold">Pagos Instantáneos</h3>
            <p className="text-slate-600">Tus clientes escanean y pagan en segundos. Sin demoras en la caja ni fricción en el ticket alto.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center text-white">
              <Globe size={24} />
            </div>
            <h3 className="text-xl font-bold">Alcance Global</h3>
            <p className="text-slate-600">Aceptamos tarjetas de todo el mundo. Ideal para el turismo internacional en CABA.</p>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center text-white">
              <CreditCard size={24} />
            </div>
            <h3 className="text-xl font-bold">Comisión Transparente</h3>
            <p className="text-slate-600">4% final por transacción. Sin costos fijos, sin mantenimiento, sin sorpresas.</p>
          </div>
        </div>
      </section>

      {/* --- TRUST / SECURITY --- */}
      <section id="seguridad" className="py-24 max-w-4xl mx-auto px-6 text-center">
        <ShieldCheck size={48} className="mx-auto text-green-500 mb-6" />
        <h2 className="text-3xl font-bold">Seguridad de Clase Mundial</h2>
        <p className="mt-4 text-slate-600 text-lg">
          Cobrix Pay utiliza la tecnología de <strong>Stripe</strong> para procesar cada pago. Tus datos y los de tus clientes están protegidos bajo los estándares de seguridad más altos de la industria (PCI-DSS).
        </p>
      </section>

      {/* --- FOOTER LEGAL --- */}
      <footer className="border-t border-slate-100 py-12 bg-white px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-slate-400 text-sm">
            © 2026 Cobrix Pay. Todos los derechos reservados.
          </div>
          <div className="text-slate-500 text-[11px] max-w-md text-center md:text-right leading-relaxed font-medium">
            Cobrix Pay es una marca comercial operada por <span className="text-slate-800">Digital Travel LLC</span>, una sociedad constituida en [Tu Estado], EE.UU. 
            Todas las transacciones son procesadas de forma segura.
          </div>
        </div>
      </footer>
    </div>
  );
}