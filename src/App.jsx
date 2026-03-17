import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Package, TrendingUp, Plus, Minus, Trash2,
  ExternalLink, ShieldCheck, ArrowRight, Zap, LogOut, CheckCircle2,
  MessageSquare, Instagram, MapPin, BarChart2, Target, UserMinus,
  FileSpreadsheet, UploadCloud, Loader2, History, Eye, AlertTriangle,
  FileText, X, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, increment, 
  onSnapshot, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';

// --- 1. CONFIGURACIÓN DE FIREBASE (TUS DATOS REALES) ---
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
      } catch (error) { setDbError("Conexión limitada con el servidor."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleHashNavigation = () => {
    const h = window.location.hash;
    if (h === '#/admin') {
      setView(isAdminAuthenticated ? 'admin-dashboard' : 'admin-login');
    } else if (h === '#/cart') {
      setView('cart');
    } else if (h === '#/catalog') {
      setView('catalog');
    } else {
      setView('landing');
    }
  };

  useEffect(() => {
    window.addEventListener('hashchange', handleHashNavigation);
    handleHashNavigation();
    return () => window.removeEventListener('hashchange', handleHashNavigation);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    
    const incrementVisits = async () => {
      try { await updateDoc(statsRef, { totalVisits: increment(1) }); } 
      catch (e) { await setDoc(statsRef, { totalVisits: 1, totalOrdersClicked: 0, totalCartsStarted: 0 }, { merge: true }); }
    };
    if (view === 'landing') incrementVisits();
    
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

  const addToCart = (p) => {
    if (!p) return;
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

  const handleWhatsApp = async () => {
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    await updateDoc(statsRef, { totalOrdersClicked: increment(1) }).catch(()=>{});
    const phone = "584120000000"; 
    let msg = `🚗 *NUEVO PEDIDO - AUTOPARTS PRECISION*\n\n`;
    cart.forEach(i => { msg += `• *${i.name}*\n  Ref: ${i.code}\n  Cant: ${i.qty} x $${(Number(i.price) || 0).toFixed(2)}\n\n`; });
    msg += `💰 *TOTAL ESTIMADO: $${cart.reduce((a,b)=>a+(Number(b.price)*b.qty),0).toFixed(2)} USD*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f8faff] text-gray-900 font-sans selection:bg-indigo-100 overflow-x-hidden">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

      {dbError && (
        <div className="bg-indigo-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 sticky top-0 z-[100] text-[10px] font-black uppercase tracking-widest">
          <Loader2 size={14} className="animate-spin" /> {dbError}
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-3 md:px-10 md:py-4 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer group" onClick={() => window.location.hash = ''}>
          <div className="bg-indigo-600 p-1.5 md:p-2.5 rounded-lg md:rounded-xl shadow-xl shadow-indigo-100 transition-transform group-hover:rotate-6">
            <Package className="text-white w-4 h-4 md:w-6 md:h-6" />
          </div>
          <h1 className="text-base md:text-2xl font-black tracking-tighter italic leading-none uppercase text-gray-950">AUTO<span className="text-indigo-600">PARTS</span></h1>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`relative bg-white p-2.5 md:p-3.5 rounded-xl md:rounded-[1.4rem] border border-gray-100 shadow-sm transition-all ${isCartBouncing ? 'animate-cart-pop' : ''}`}>
          <ShoppingCart size={20} className="text-gray-800" />
          {totalItemsCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] md:text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white">{totalItemsCount}</span>}
        </button>
      </header>

      <main className="relative z-10">
        {view === 'landing' && <LandingView searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={(e) => { e.preventDefault(); window.location.hash = '#/catalog'; }} />}
        {view === 'catalog' && <CatalogListView products={filteredProducts} onAddToCart={addToCart} onGoBack={() => window.location.hash = ''} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => { 
          if (u === 'admin' && p === 'AutoPrecision2024*') { 
            setIsAdminAuthenticated(true); 
            window.location.hash = '#/admin';
          } else { alert("Credenciales incorrectas"); }
        }} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} searchLogs={searchLogs} onLogout={() => { setIsAdminAuthenticated(false); window.location.hash = ''; }} />}
        
        {view === 'cart' && <CartView cart={cart} updateQty={(id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + d)} : i))} removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))} onConfirm={handleWhatsApp} />}
        
        {(view === 'landing' || view === 'catalog' || view === 'cart') && (
          <Footer 
            onLegalClick={() => setShowLegal(true)} 
            onAdminClick={() => window.location.hash = '#/admin'} 
          />
        )}
      </main>

      {showLegal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-gray-950/40 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden">
            <div className="p-8 border-b flex items-center justify-between">
              <div className="flex items-center gap-4 text-indigo-600 font-black uppercase italic"><FileText size={28} /> Privacidad</div>
              <button onClick={() => setShowLegal(false)} className="p-2 bg-gray-50 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 md:p-12 space-y-6 text-sm text-gray-600">
              <p>En <strong>autoparts.lat</strong> usamos cookies técnicas para recordar tu pedido y mejorar el inventario en Valencia.</p>
              <p>No compartimos tus datos con terceros.</p>
            </div>
            <div className="p-8 bg-gray-50 flex justify-end">
              <button onClick={() => setShowLegal(false)} className="bg-gray-950 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-3xl border border-indigo-50/50 px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-12 z-[100]">
        <button onClick={() => window.location.hash = ''} className={`transition-all ${view === 'landing' ? 'text-indigo-600 scale-125' : 'text-gray-400'}`}><Package size={28} /></button>
        <button onClick={() => window.location.hash = '#/catalog'} className={`transition-all ${view === 'catalog' ? 'text-indigo-600 scale-125' : 'text-gray-400'}`}><Search size={28} /></button>
        <button onClick={() => window.location.hash = '#/cart'} className={`transition-all ${view === 'cart' ? 'text-indigo-600 scale-125' : 'text-gray-400'}`}><ShoppingCart size={28} /></button>
      </nav>
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---

const Footer = ({ onLegalClick, onAdminClick }) => (
  <footer className="mt-20 border-t border-gray-100 py-16 px-6 bg-white/50 text-gray-950 text-center">
    <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
      <div className="flex items-center gap-8">
        <button onClick={onLegalClick} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors">Privacidad</button>
        <div className="flex items-center gap-2 text-gray-400"><MapPin size={16} /><p className="text-[11px] font-bold uppercase tracking-widest">Valencia, VE</p></div>
      </div>
      {/* LINK OCULTO EN EL TEXTO DEL COPYRIGHT */}
      <button onClick={onAdminClick} className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-200 hover:text-gray-400 transition-colors cursor-default">
        &copy; 2024 AutoParts Precision
      </button>
    </div>
  </footer>
);

const AdminLogin = ({ onLogin }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="bg-white p-10 md:p-14 rounded-[3.5rem] shadow-2xl border w-full max-w-md text-center">
        <div className="bg-indigo-600 w-20 h-20 rounded-[2rem] flex items-center justify-center mb-10 mx-auto text-white shadow-xl"><Lock size={40} /></div>
        <h2 className="text-3xl font-black mb-10 uppercase italic">Admin Login</h2>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(u, p); }} className="space-y-5 text-left text-gray-950">
          <input type="text" placeholder="Usuario" className="w-full bg-[#f8faff] border-none rounded-2xl py-5 px-8 outline-none font-bold" value={u} onChange={(e) => setU(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-[#f8faff] border-none rounded-2xl py-5 px-8 outline-none font-bold" value={p} onChange={(e) => setP(e.target.value)} />
          <button className="w-full bg-gray-950 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-indigo-600 transition-all shadow-xl">Acceder</button>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = ({ products, stats, searchLogs, onLogout }) => {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const convRate = stats.totalVisits > 0 ? ((stats.totalOrdersClicked / stats.totalVisits) * 100).toFixed(1) : "0.0";

  const handleExcel = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true); setImportProgress(0);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = window.XLSX;
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = writeBatch(db);
          data.slice(i, i + batchSize).forEach((row) => {
            const cleanProd = {
              code: String(row.code || row.codigo || '').trim(),
              name: String(row.name || row.nombre || '').trim(),
              brand: String(row.brand || row.marca || '').trim(),
              model: String(row.model || row.modelo || '').trim(),
              category: String(row.category || row.categoria || 'Otros').trim(),
              price: parseFloat(row.price || row.precio || 0),
              searches: 0
            };
            if (cleanProd.code && cleanProd.name) {
              const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', cleanProd.code);
              batch.set(ref, cleanProd, { merge: true });
            }
          });
          await batch.commit();
          setImportProgress(Math.round(((i + batchSize) / data.length) * 100));
        }
        alert("¡Inventario actualizado!"); setShowImport(false);
      } catch (err) { alert("Error procesando Excel."); } finally { setImporting(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto py-12 text-gray-950 text-left animate-in fade-in slide-in-from-bottom-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <h2 className="text-4xl font-black tracking-tighter uppercase italic leading-none">Panel de <span className="text-indigo-600">Control</span></h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl"><FileSpreadsheet size={18} /> Importar Lista</button>
          <button onClick={onLogout} className="p-4 bg-white border border-red-100 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={24} /></button>
        </div>
      </div>

      {showImport && (
        <div className="mb-12 bg-white border-4 border-dashed border-indigo-100 rounded-[3rem] p-12 text-center animate-in zoom-in">
           {!importing ? (
             <div>
               <UploadCloud size={48} className="mx-auto text-indigo-600 mb-6" />
               <h3 className="text-2xl font-black uppercase italic mb-4">Cargar Inventario</h3>
               <label className="bg-gray-950 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest cursor-pointer hover:bg-indigo-600 transition-all inline-block mt-4">Seleccionar Excel<input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcel} /></label>
             </div>
           ) : (
             <div className="py-10">
               <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-6" />
               <p className="font-black text-indigo-600">{importProgress}%</p>
             </div>
           )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {[ {icon: TrendingUp, label: 'Visitas', val: stats.totalVisits},
           {icon: ShoppingCart, label: 'Interés', val: stats.totalCartsStarted},
           {icon: Target, label: 'WhatsApp', val: stats.totalOrdersClicked},
           {icon: BarChart2, label: 'Conversión', val: `${convRate}%`}
        ].map((m, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-indigo-50/50 shadow-sm">
            <div className="flex items-center gap-3 text-indigo-600 mb-2 font-black uppercase tracking-widest text-[10px]"><m.icon size={18}/><span>{m.label}</span></div>
            <p className="text-4xl font-black">{m.val || 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
        <div className="bg-white p-10 rounded-[3.5rem] border border-indigo-50 shadow-sm">
          <div className="flex items-center gap-3 mb-10"><Target className="text-emerald-500" size={24}/><h3 className="text-2xl font-black italic uppercase leading-none">Top Interés</h3></div>
          <div className="space-y-4">
            {[...products].sort((a,b) => (b.searches||0)-(a.searches||0)).slice(0, 5).map((p, idx) => (
              <div key={p.code + idx} className="flex items-center justify-between p-6 bg-[#f8faff] rounded-[2rem] border transition-all text-left">
                <div className="flex items-center gap-6 text-left"><span className="font-black text-gray-400">{idx+1}</span><div><p className="font-bold text-lg">{p.name}</p><p className="text-[10px] text-gray-400 font-black uppercase">{p.brand}</p></div></div>
                <div className="text-indigo-600 font-black text-2xl">{p.searches || 0}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] border border-indigo-50 shadow-sm text-left">
          <div className="flex items-center gap-3 mb-10 leading-none"><Eye className="text-indigo-600" size={24}/><h3 className="text-2xl font-black italic uppercase leading-none text-left">Radar de Búsquedas</h3></div>
          <div className="space-y-3">
            {searchLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 bg-[#f8faff] rounded-2xl border border-indigo-50/50">
                <div className="flex items-center gap-3 font-bold text-gray-700 text-left"><History size={14} className="text-indigo-300" /> "{log.term}"</div>
                <span className="text-[9px] font-black uppercase text-gray-300">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const LandingView = ({ searchTerm, setSearchTerm, onSearch }) => (
  <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center animate-in fade-in duration-1000">
    <div className="max-w-4xl w-full">
      <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-10 shadow-sm"><Zap size={14} className="animate-pulse" /> Valencia, Venezuela</div>
      <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 leading-none">Tu repuesto <br /> <span className="text-indigo-600 italic">ideal hoy.</span></h2>
      <p className="text-gray-400 font-medium text-lg mb-14 max-w-2xl mx-auto">Venta especializada multimarca. Tren delantero, motor y asesoría técnica experta.</p>
      <form onSubmit={onSearch} className="relative group max-w-2xl mx-auto px-2">
        <div className="relative bg-white p-3 md:p-5 rounded-[2.2rem] md:rounded-[3rem] shadow-2xl border flex items-center px-6 md:px-12">
          <Search className="text-indigo-300 w-7 h-7" />
          <input type="text" autoFocus placeholder="Ej: Amortiguador Hilux" className="w-full py-4 md:py-6 px-4 md:px-8 border-none bg-transparent focus:ring-0 outline-none text-xl md:text-3xl font-bold text-gray-950" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button type="submit" className="bg-gray-950 text-white p-5 md:p-7 rounded-2xl hover:bg-indigo-600 transition-all active:scale-95"><ArrowRight size={24} /></button>
        </div>
      </form>
    </div>
  </div>
);

const CatalogListView = ({ products, onAddToCart, onGoBack, searchTerm, setSearchTerm }) => (
  <div className="pb-32 max-w-6xl mx-auto px-4 text-left animate-in fade-in slide-in-from-bottom-4">
    <div className="mt-8 mb-10 flex items-center justify-between gap-6">
      <div className="bg-white p-1 rounded-[2.5rem] flex items-center px-6 flex-1 border shadow-sm">
        <Search className="text-indigo-400 w-6 h-6" />
        <input type="text" placeholder="Búsqueda rápida..." className="w-full py-4 px-6 border-none bg-transparent focus:ring-0 outline-none text-lg font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <button onClick={onGoBack} className="text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-indigo-600 px-4">Volver</button>
    </div>
    <div className="space-y-6">
      {products.map((p, idx) => (
        <div key={p.code || idx} className="flex flex-col md:grid md:grid-cols-12 gap-5 items-center px-7 py-7 md:px-12 md:py-10 bg-white border border-indigo-50/50 rounded-[3rem] hover:border-indigo-100 hover:shadow-xl transition-all group text-left">
          <div className="col-span-1 md:col-span-6 w-full text-left">
            <h3 className="font-bold group-hover:text-indigo-600 transition-colors text-xl md:text-3xl italic tracking-tight mb-4">{p.name}</h3>
            <div className="flex gap-3"><span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl uppercase tracking-widest">{p.category}</span><span className="text-[10px] font-bold text-gray-400 border px-4 py-2 rounded-xl uppercase tracking-widest">{p.model}</span></div>
          </div>
          <div className="col-span-1 md:col-span-3 w-full flex items-center justify-between md:flex-col gap-3">
            <code className="text-[11px] bg-[#f8faff] px-4 py-2 rounded-xl font-mono text-gray-700 border">{p.code || 'S/N'}</code>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{p.brand}</p>
          </div>
          <div className="col-span-1 md:col-span-3 w-full flex items-center justify-end gap-6 border-t md:border-t-0 pt-5 md:pt-0">
            <span className="text-4xl md:text-5xl font-black text-gray-950 tracking-tighter italic mr-4">${(Number(p.price) || 0).toFixed(2)}</span>
            <button onClick={() => onAddToCart(p)} className="w-14 h-14 md:w-16 md:h-16 bg-gray-950 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 active:scale-90 transition-all shadow-xl"><Plus size={32} /></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CartView = ({ cart, updateQty, removeFromCart, onConfirm }) => (
  <div className="p-6 md:p-10 max-w-4xl mx-auto py-12 md:py-24 text-gray-900 text-left animate-in fade-in slide-in-from-bottom-12">
    <h2 className="text-4xl md:text-8xl font-black tracking-tighter italic mb-16 px-4 text-center md:text-left text-gray-950">Tu <span className="text-indigo-600 underline decoration-indigo-100">Cesta</span></h2>
    {cart.length === 0 ? (
      <div className="bg-white border-4 border-dashed border-gray-100 rounded-[4rem] p-12 text-center space-y-12">
        <p className="text-gray-300 font-black italic text-2xl uppercase tracking-widest">Pedido Vacío</p>
        <button onClick={() => window.location.hash = ''} className="bg-indigo-600 text-white px-16 py-7 rounded-[2.5rem] font-black text-lg shadow-2xl hover:scale-105 transition-all uppercase tracking-widest">Ver Catálogo</button>
      </div>
    ) : (
      <div className="space-y-8">
         {cart.map(item => (
            <div key={item.id} className="bg-white p-8 rounded-[3rem] border border-indigo-50/50 flex flex-col md:flex-row md:items-center justify-between group text-left">
               <div className="flex-1">
                 <h4 className="font-bold text-xl md:text-3xl tracking-tighter italic">{item.name}</h4>
                 <div className="flex items-center gap-8 mt-6">
                   <span className="text-indigo-600 font-black text-2xl md:text-4xl italic">${(Number(item.price) || 0).toFixed(2)}</span>
                   <div className="flex items-center bg-gray-100 rounded-3xl px-4 py-2 border">
                     <button onClick={() => updateQty(item.id, -1)} className="p-2 text-gray-400 hover:text-indigo-600"><Minus size={18}/></button>
                     <span className="w-12 text-center font-black text-xl">{item.qty}</span>
                     <button onClick={() => updateQty(item.id, 1)} className="p-2 text-gray-400 hover:text-indigo-600"><Plus size={18}/></button>
                   </div>
                 </div>
               </div>
               <button onClick={() => removeFromCart(item.id)} className="w-full md:w-auto p-5 text-red-500 flex items-center justify-center"><Trash2 size={24} /></button>
            </div>
         ))}
         <div className="mt-14 bg-gray-950 p-10 rounded-[4rem] text-center text-white">
            <h3 className="text-5xl md:text-8xl font-black mb-12 tracking-tighter italic">${cart.reduce((a,b)=>a+(Number(b.price)*b.qty),0).toFixed(2)}</h3>
            <button onClick={onConfirm} className="w-full bg-emerald-500 hover:bg-emerald-400 py-8 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-5 transition-all shadow-2xl">Confirmar Pedido <ExternalLink size={24} /></button>
         </div>
      </div>
    )}
  </div>
);

export default App;