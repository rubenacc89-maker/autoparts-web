import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Package, TrendingUp, Plus, Minus, Trash2,
  ExternalLink, ShieldCheck, ArrowRight, Zap, LogOut, CheckCircle2,
  MessageSquare, Instagram, MapPin, BarChart2, Target, UserMinus,
  FileSpreadsheet, UploadCloud, Loader2, History, Eye, AlertTriangle,
  FileText, X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, increment, 
  onSnapshot, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBHFisfAJoX3dgIB97N4HRez8FIJkJokhA",
  authDomain: "autoparts-b4a5c.firebaseapp.com",
  projectId: "autoparts-b4a5c",
  storageBucket: "autoparts-b4a5c.firebasestorage.app",
  messagingSenderId: "131717003315",
  appId: "1:131717003315:web:c6f30ca327055cbae5cb46",
  measurementId: "G-EY5D63KTYX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "autoparts-b4a5c";

const INITIAL_PRODUCTS = [
  { code: 'BOS-778', name: 'Pastillas de Freno Cerámicas Low-Dust', brand: 'Bosch', model: 'Toyota Hilux / SW4', category: 'Frenos', price: 55.00 },
  { code: 'FIL-102', name: 'Filtro de Aceite Sintético Premium', brand: 'Fram', model: 'Ford Ranger / Raptor', category: 'Motor', price: 18.50 },
  { code: 'AM-991', name: 'Amortiguador Trasero Nitrógeno', brand: 'Monroe', model: 'Corolla / New Sensation', category: 'Suspensión', price: 92.00 }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ totalVisits: 0, totalOrdersClicked: 0, totalCartsStarted: 0 });
  const [searchLogs, setSearchLogs] = useState([]);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [showLegal, setShowLegal] = useState(false);

  const totalItemsCount = useMemo(() => cart.reduce((acc, item) => acc + (Number(item.qty) || 0), 0), [cart]);

  const filteredProducts = useMemo(() => {
    const validProducts = products.filter(p => p && typeof p === 'object');
    if (!searchTerm.trim()) return validProducts;
    const words = searchTerm.toLowerCase().split(' ').filter(w => w.length > 0);
    return validProducts.filter(p => {
      const text = `${p.name || ''} ${p.code || ''} ${p.brand || ''} ${p.category || ''} ${p.model || ''}`.toLowerCase();
      return words.every(w => text.includes(w));
    });
  }, [products, searchTerm]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { setDbError("Conexión segura en proceso..."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h === '#/admin') setView(isAdminAuthenticated ? 'admin-dashboard' : 'admin-login');
      else if (h === '#/cart') setView('cart');
      else if (h === '#/catalog') setView('catalog');
      else setView('landing');
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    const incrementVisits = async () => {
      try { await updateDoc(statsRef, { totalVisits: increment(1) }); } 
      catch (e) { await setDoc(statsRef, { totalVisits: 1, totalOrdersClicked: 0, totalCartsStarted: 0 }, { merge: true }); }
    };
    incrementVisits();
    const productsCol = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubProds = onSnapshot(productsCol, (snap) => {
      const dbProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (dbProds.length > 0) setProducts(dbProds);
      setDbError(null);
    }, () => setDbError("Sincronizando inventario..."));
    const unsubStats = onSnapshot(statsRef, (s) => { if (s.exists()) setStats(s.data()); });
    const logsCol = collection(db, 'artifacts', appId, 'public', 'data', 'search_logs');
    const unsubLogs = onSnapshot(logsCol, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSearchLogs(logs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 15));
    });
    return () => { unsubProds(); unsubStats(); unsubLogs(); };
  }, [user]);

  const trackProductClick = async (p) => {
    if (!user || !p) return;
    const prodRef = doc(db, 'artifacts', appId, 'public', 'data', 'products', String(p.code || p.id));
    try { await setDoc(prodRef, { searches: increment(1) }, { merge: true }); } catch (e) {}
  };

  const trackSearchQuery = async (query) => {
    if (!user || !query.trim()) return;
    const logsCol = collection(db, 'artifacts', appId, 'public', 'data', 'search_logs');
    try { await addDoc(logsCol, { term: query.trim(), timestamp: serverTimestamp() }); } catch (e) {}
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchTerm.trim()) { trackSearchQuery(searchTerm); window.location.hash = '#/catalog'; }
  };

  const addToCart = (p) => {
    if (!p) return;
    trackProductClick(p);
    if (cart.length === 0) {
      const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
      updateDoc(statsRef, { totalCartsStarted: increment(1) }).catch(()=>{});
    }
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 400);
    setCart(prev => {
      const id = p.id || p.code;
      const existing = prev.find(item => item.id === id);
      if (existing) return prev.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...p, id, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 400);
    setCart(prev => prev.map(item => (item.id === id) ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const totalPrice = cart.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);

  const handleWhatsApp = async () => {
    if (user) {
      const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
      await updateDoc(statsRef, { totalOrdersClicked: increment(1) });
    }
    const phone = "584120000000"; 
    let msg = `🚗 *NUEVO PEDIDO - AUTOPARTS PRECISION*\n\n`;
    cart.forEach(i => { msg += `• *${i.name || 'Repuesto'}*\n  Ref: ${i.code || 'N/A'}\n  Cant: ${i.qty} x $${(Number(i.price) || 0).toFixed(2)}\n\n`; });
    msg += `💰 *TOTAL ESTIMADO: $${totalPrice.toFixed(2)} USD*\n\n_Hola, vi estos repuestos en su catálogo. ¿Están disponibles?_`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f8faff] text-gray-900 font-sans selection:bg-indigo-100 overflow-x-hidden">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
      
      {dbError && (
        <div className="bg-indigo-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-[100] text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top">
          <Loader2 size={14} className="animate-spin" /> {dbError}
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-3 md:px-10 md:py-4 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer group" onClick={() => { setSearchTerm(''); window.location.hash = ''; }}>
          <div className="bg-indigo-600 p-1.5 md:p-2.5 rounded-lg md:rounded-xl shadow-xl shadow-indigo-100 transition-transform group-hover:rotate-6">
            <Package className="text-white w-4 h-4 md:w-6 md:h-6" />
          </div>
          <h1 className="text-base md:text-2xl font-black tracking-tighter italic leading-none uppercase text-gray-950">AUTO<span className="text-indigo-600">PARTS</span></h1>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`relative bg-white p-2.5 md:p-3.5 rounded-xl md:rounded-[1.4rem] border border-gray-100 shadow-sm transition-all ${isCartBouncing ? 'animate-cart-pop' : ''}`}>
          <ShoppingCart size={20} className="text-gray-800" />
          {totalItemsCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] md:text-[10px] font-black min-w-[18px] h-[18px] md:min-w-[22px] md:h-[22px] rounded-full flex items-center justify-center ring-2 md:ring-4 ring-white shadow-xl">{totalItemsCount}</span>}
        </button>
      </header>

      <main className="relative z-10">
        {view === 'landing' && <LandingView searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={handleSearchSubmit} />}
        {view === 'catalog' && <CatalogListView products={filteredProducts} onAddToCart={addToCart} onGoBack={() => window.location.hash = ''} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearchSubmit={handleSearchSubmit} />}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => { 
          // NUEVA CLAVE ROBUSTA
          if (u === 'admin' && p === 'AutoPrecision2024*') { 
            setIsAdminAuthenticated(true); 
            window.location.hash = '#/admin'; 
          } 
        }} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} searchLogs={searchLogs} onLogout={() => { setIsAdminAuthenticated(false); window.location.hash = ''; }} />}
        
        {view === 'cart' && (
           <div className="p-6 md:p-10 max-w-4xl mx-auto py-12 md:py-24 animate-in fade-in slide-in-from-bottom-12 duration-700 text-gray-900">
              <h2 className="text-4xl md:text-8xl font-black tracking-tighter italic mb-16 px-4 text-center md:text-left text-gray-950">Tu <span className="text-indigo-600 underline decoration-indigo-100">Cesta</span></h2>
              {cart.length === 0 ? (
                <div className="px-4">
                  <div className="bg-white border-4 border-dashed border-gray-100 rounded-[4rem] md:rounded-[6rem] p-12 md:p-24 text-center space-y-16">
                    <div className="space-y-4">
                      <p className="text-gray-300 font-black italic text-2xl uppercase tracking-widest text-center leading-none">Cesta Vacía</p>
                      <p className="text-gray-400 font-medium text-[11px] italic text-center uppercase tracking-widest">Guía para pedir tu repuesto:</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative max-w-2xl mx-auto">
                      <div className="space-y-4 text-center"><div className="w-16 h-16 bg-[#f8faff] rounded-[2rem] shadow-xl flex items-center justify-center mx-auto text-indigo-600"><Search size={32} /></div><h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-gray-900">1. Busca la pieza</h4></div>
                      <div className="space-y-4 text-center"><div className="w-16 h-16 bg-[#f8faff] rounded-[2rem] shadow-xl flex items-center justify-center mx-auto text-indigo-600"><Plus size={32} /></div><h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-gray-900">2. Agrégala al pedido</h4></div>
                      <div className="space-y-4 text-center"><div className="w-16 h-16 bg-emerald-50 rounded-[2rem] shadow-xl flex items-center justify-center mx-auto text-emerald-600"><MessageSquare size={32} /></div><h4 className="font-black text-[9px] uppercase tracking-[0.2em] text-emerald-600">3. Consulta WhatsApp</h4></div>
                    </div>
                    <button onClick={() => window.location.hash = ''} className="bg-indigo-600 text-white px-16 py-7 rounded-[2.5rem] font-black text-lg shadow-2xl shadow-indigo-200 hover:scale-105 transition-all uppercase tracking-widest">Empezar ahora</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                   {cart.map(item => (
                      <div key={item.id} className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-indigo-50/50 flex flex-col md:flex-row md:items-center justify-between group hover:border-indigo-100 transition-all text-gray-950 text-left">
                         <div className="flex-1 mb-8 md:mb-0"><h4 className="font-bold text-xl md:text-4xl tracking-tighter leading-tight italic">{item.name || 'Sin nombre'}</h4><p className="text-[10px] text-gray-500 mt-3 font-mono uppercase font-bold tracking-[0.2em]">Referencia: {item.code || 'N/A'}</p><div className="flex items-center gap-8 mt-8 md:mt-12"><span className="text-indigo-600 font-black text-2xl md:text-4xl italic">${(Number(item.price) || 0).toFixed(2)}</span><div className="flex items-center bg-gray-100 rounded-3xl px-5 py-3 border border-gray-100"><button onClick={() => updateQty(item.id, -1)} className="p-2 text-gray-400 hover:text-indigo-600 transition-transform active:scale-150"><Minus size={18}/></button><span className="w-12 text-center font-black text-xl">{item.qty}</span><button onClick={() => addToCart(item)} className="p-2 text-gray-400 hover:text-indigo-600 transition-transform active:scale-150"><Plus size={18}/></button></div></div></div>
                         <button onClick={() => removeFromCart(item.id)} className="w-full md:w-auto p-5 md:p-10 text-red-500 bg-red-50 md:bg-transparent rounded-3xl md:rounded-full border md:border-0 border-red-100 flex items-center justify-center gap-3 transition-all hover:bg-red-500 hover:text-white"><Trash2 size={28} /></button>
                      </div>
                   ))}
                   <div className="mt-14 bg-gray-950 p-10 md:p-16 rounded-[4rem] md:rounded-[5.5rem] text-center shadow-3xl relative overflow-hidden text-white">
                      <div className="relative z-10"><p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.6em] mb-6 text-center">Total Estimado</p><h3 className="text-5xl md:text-8xl font-black mb-12 tracking-tighter italic text-center leading-none">${totalPrice.toFixed(2)}</h3><div className="flex items-center justify-center gap-4 mb-14 max-w-sm mx-auto text-left"><MessageSquare size={32} className="text-indigo-400 flex-shrink-0" /><p className="text-[11px] md:text-[13px] text-gray-400 leading-relaxed text-left">Al confirmar, el pedido se derivará a un experto quien le responderá <strong>inmediatamente</strong>.</p></div><button onClick={handleWhatsApp} className="w-full bg-emerald-500 hover:bg-emerald-400 py-8 md:py-12 rounded-[2.5rem] md:rounded-[3rem] font-black text-2xl md:text-5xl flex items-center justify-center gap-5 transition-all active:scale-95 shadow-2xl">Confirmar Pedido <ExternalLink size={32} /></button></div><div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/10 blur-[90px] rounded-full"></div>
                   </div>
                </div>
              )}
           </div>
        )}
        {(view === 'landing' || view === 'catalog' || view === 'cart') && <Footer onLegalClick={() => setShowLegal(true)} />}
      </main>

      {/* MODAL LEGAL */}
      {showLegal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-gray-950/40 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 md:p-12 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-indigo-600">
                <FileText size={32} />
                <h3 className="text-2xl font-black uppercase italic">Privacidad & Cookies</h3>
              </div>
              <button onClick={() => setShowLegal(false)} className="p-3 bg-gray-50 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 md:p-12 max-h-[60vh] overflow-y-auto space-y-8 text-gray-600 leading-relaxed">
              <section>
                <h4 className="font-black text-gray-900 uppercase text-xs tracking-widest mb-4">1. Uso de Cookies Técnicas</h4>
                <p className="text-sm">En <strong>autoparts.lat</strong> utilizamos exclusivamente tecnologías locales para mejorar tu experiencia: recordar los repuestos en tu carrito y procesar tus búsquedas de forma rápida. No utilizamos cookies de rastreo publicitario de terceros.</p>
              </section>
              <section>
                <h4 className="font-black text-gray-900 uppercase text-xs tracking-widest mb-4">2. Protección de Datos</h4>
                <p className="text-sm">Tus búsquedas son anónimas. Solo recopilamos datos de interés técnico (qué piezas se buscan más en Valencia) para asegurar que siempre tengamos el stock que necesitas. No compartimos tu información con empresas externas.</p>
              </section>
              <section>
                <h4 className="font-black text-gray-900 uppercase text-xs tracking-widest mb-4">3. Gestión de Pedidos</h4>
                <p className="text-sm">Al hacer clic en "Confirmar Pedido", serás redirigido a WhatsApp para una asesoría técnica personalizada. La transacción y el intercambio de datos sensibles se realizan de forma segura en esa plataforma externa.</p>
              </section>
            </div>
            <div className="p-8 md:p-12 bg-gray-50 flex justify-end">
              <button onClick={() => setShowLegal(false)} className="bg-gray-950 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">Entendido</button>
            </div>
          </div>
        </div>
      )}

      <nav className={`fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-3xl border border-indigo-50/50 px-8 py-5 md:px-16 md:py-7 rounded-[2.5rem] md:rounded-[5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex items-center gap-12 md:gap-28 z-[100] opacity-90 hover:opacity-100 transition-all duration-300 animate-in slide-in-from-bottom-20`}>
        <button onClick={() => window.location.hash = ''} className={`relative transition-all ${view === 'landing' ? 'text-indigo-600 scale-125 md:scale-150' : 'text-gray-400 hover:text-indigo-600'}`}><Package size={28} strokeWidth={view === 'landing' ? 3 : 2} /></button>
        <button onClick={() => window.location.hash = '#/catalog'} className={`relative transition-all ${view === 'catalog' ? 'text-indigo-600 scale-125 md:scale-150' : 'text-gray-400 hover:text-indigo-600'}`}><Search size={28} strokeWidth={view === 'catalog' ? 3 : 2} /></button>
        <button onClick={() => window.location.hash = '#/cart'} className={`relative transition-all ${view === 'cart' ? 'text-indigo-600 scale-125 md:scale-150' : 'text-gray-400 hover:text-indigo-600'} ${isCartBouncing ? 'animate-cart-pop' : ''}`}><ShoppingCart size={28} strokeWidth={view === 'cart' ? 3 : 2} />{totalItemsCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] md:text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center ring-2 ring-white shadow-lg">{totalItemsCount}</span>}</button>
      </nav>
    </div>
  );
};

const LandingView = ({ searchTerm, setSearchTerm, onSearch }) => (
  <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 animate-in fade-in duration-1000 text-center text-gray-900">
    <div className="max-w-4xl w-full">
      <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mt-12 md:mt-24 mb-10 md:mb-14 shadow-sm">
        <Zap size={14} className="animate-pulse" /> Stock & Asesoría Técnica
      </div>
      <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 md:mb-12 leading-[0.95] md:leading-[0.9]">El repuesto <br /> <span className="text-indigo-600 underline decoration-indigo-50 decoration-8 underline-offset-8 italic">que buscas.</span></h2>
      <p className="text-gray-400 font-medium text-lg md:text-xl mb-14 md:mb-20 max-w-2xl mx-auto px-4 leading-relaxed">Venta especializada de repuestos y accesorios multimarca. Expertos en tren delantero y motor.</p>
      <form onSubmit={onSearch} className="relative group max-w-2xl mx-auto px-2">
        <div className="absolute inset-0 bg-indigo-500/5 blur-[80px] md:blur-[120px] rounded-full group-focus-within:bg-indigo-500/15 transition-all duration-700"></div>
        <div className="relative bg-white p-3 md:p-5 rounded-[2.2rem] md:rounded-[3rem] shadow-[0_35px_80px_-25px_rgba(0,0,0,0.12)] border border-indigo-100/30 hover:border-indigo-200 focus-within:border-indigo-500/40 flex items-center px-6 md:px-12 transition-all duration-500">
          <Search className="text-indigo-300 w-7 h-7 md:w-9 md:h-9" />
          <input type="text" autoFocus placeholder="Ej: Amortiguador Hilux" className="w-full py-4 md:py-6 px-4 md:px-8 rounded-2xl border-none bg-transparent focus:ring-0 outline-none text-xl md:text-3xl font-bold placeholder:text-gray-200 text-gray-950" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button type="submit" className="bg-gray-950 text-white p-5 md:p-7 rounded-2xl md:rounded-[2.2rem] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 group-hover:shadow-indigo-200/30"><ArrowRight size={24} strokeWidth={3} /></button>
        </div>
      </form>
      <div className="mt-16 md:mt-28 flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-4 overflow-x-auto no-scrollbar px-4 pb-10">
        {['Frenos', 'Motor', 'Suspensión', 'Accesorios'].map(cat => (
          <button key={cat} onClick={() => { setSearchTerm(cat); window.location.hash = '#/catalog'; }} className="flex items-center gap-3 bg-white border border-indigo-50/50 px-8 py-4 md:px-10 md:py-5 rounded-2xl md:rounded-3xl text-[11px] md:text-xs font-black text-gray-400 hover:border-indigo-100 hover:text-indigo-600 transition-all shadow-sm uppercase tracking-widest whitespace-nowrap">{cat}</button>
        ))}
      </div>
    </div>
  </div>
);

const Footer = ({ onLegalClick }) => (
  <footer className="mt-20 border-t border-gray-100 py-16 px-6 bg-white/50 text-gray-950 text-center">
    <div className="max-w-6xl mx-auto flex flex-col items-center gap-10">
      <div className="flex items-center gap-8">
        <button onClick={onLegalClick} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors">Privacidad & Cookies</button>
        <div className="flex items-center gap-2 text-gray-400"><MapPin size={16} className="text-indigo-300" /><p className="text-[11px] font-bold uppercase tracking-widest">Valencia, VE</p></div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-200">&copy; 2024 AutoParts Precision</p>
    </div>
  </footer>
);

const CatalogListView = ({ products, onAddToCart, onGoBack, searchTerm, setSearchTerm, onSearchSubmit }) => (
  <div className="pb-32 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 text-gray-950 text-left">
    <div className="mt-8 md:mt-12 mb-10 md:mb-16 flex items-center justify-between gap-6">
      <form onSubmit={onSearchSubmit} className="bg-white p-1.5 rounded-[2rem] md:rounded-[2.5rem] flex items-center px-6 md:px-10 flex-1 border border-indigo-50/50 focus-within:border-indigo-500/40 focus-within:bg-white transition-all shadow-sm">
        <Search className="text-indigo-400 w-6 h-6 md:w-7 md:h-7" />
        <input type="text" placeholder="¿Qué pieza buscas hoy?" className="w-full py-4 md:py-7 px-4 md:px-6 rounded-2xl border-none bg-transparent focus:ring-0 outline-none text-lg md:text-2xl font-bold text-gray-950 placeholder:text-gray-300" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </form>
      <button onClick={onGoBack} className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-300 hover:text-indigo-600 px-4 transition-colors">Cerrar</button>
    </div>
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="py-20 text-center"><p className="text-gray-400 font-bold italic text-center leading-relaxed">No se encontraron productos para "{searchTerm}"</p></div>
      ) : (
        products.map((p, idx) => (
          <div key={p.code || idx} className="flex flex-col md:grid md:grid-cols-12 gap-5 md:gap-8 items-start md:items-center px-7 py-7 md:px-12 md:py-10 bg-white border border-indigo-50/50 rounded-[3rem] md:rounded-[4rem] hover:border-indigo-100 hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)] transition-all group relative text-left">
            <div className="col-span-1 md:col-span-6 w-full text-left text-gray-950">
              <h3 className="font-bold group-hover:text-indigo-600 transition-colors leading-tight text-xl md:text-3xl italic tracking-tight mb-4">{p.name || 'Sin nombre'}</h3>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <span className="text-[10px] md:text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 md:px-4 md:py-2 rounded-xl uppercase tracking-widest shadow-sm">{p.category || 'Varios'}</span>
                <span className="text-[10px] md:text-[11px] font-bold text-gray-400 border border-gray-100 px-3 py-1.5 md:px-4 md:py-2 rounded-xl uppercase tracking-widest bg-[#fcfdff]">{p.model || 'Universal'}</span>
              </div>
            </div>
            <div className="col-span-1 md:col-span-3 w-full md:text-center flex items-center justify-between md:flex-col gap-3">
              <div className="flex flex-col items-start md:items-center text-gray-950">
                <code className="text-[11px] md:text-[13px] bg-[#f8faff] px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl font-mono text-gray-700 border border-indigo-50/50 mb-1">{p.code || 'S/N'}</code>
                <p className="text-[9px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest">Ref. Técnica</p>
              </div>
              <div className="text-right md:text-center text-gray-950">
                <p className="text-[10px] md:text-[12px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{p.brand || 'Genérico'}</p>
                <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] hidden md:block leading-none">Fabricante</p>
              </div>
            </div>
            <div className="col-span-1 md:col-span-3 w-full flex items-center justify-between md:justify-end gap-6 md:gap-8 border-t md:border-t-0 pt-5 md:pt-0 border-[#f8faff]">
              <div className="md:hidden text-gray-950">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Precio Final</p>
                <span className="text-3xl font-black text-gray-950 italic tracking-tighter">${(Number(p.price) || 0).toFixed(2)}</span>
              </div>
              <span className="hidden md:block text-4xl md:text-5xl font-black text-gray-950 tracking-tighter italic mr-4 leading-none">${(Number(p.price) || 0).toFixed(2)}</span>
              <button onClick={() => onAddToCart(p)} className="w-14 h-14 md:w-16 md:h-16 bg-gray-950 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 active:scale-90 transition-all shadow-xl flex-shrink-0 group-hover:shadow-indigo-100/50"><Plus size={32} strokeWidth={3} /></button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default App;