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

// --- CONFIGURACIÓN DE FIREBASE (TUS DATOS) ---
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

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [products, setProducts] = useState([]);
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
      } catch (error) { setDbError("Conexión limitada..."); }
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
    if (view === 'landing') {
      updateDoc(statsRef, { totalVisits: increment(1) }).catch(() => 
        setDoc(statsRef, { totalVisits: 1, totalOrdersClicked: 0, totalCartsStarted: 0 }, { merge: true })
      );
    }
    const unsubProds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubStats = onSnapshot(statsRef, (s) => { if (s.exists()) setStats(s.data()); });
    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'search_logs'), (snap) => {
      setSearchLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds||0) - (a.timestamp?.seconds||0)).slice(0, 15));
    });
    return () => { unsubProds(); unsubStats(); unsubLogs(); };
  }, [user]);

  const addToCart = (p) => {
    if (!p) return;
    setIsCartBouncing(true); setTimeout(() => setIsCartBouncing(false), 400);
    setCart(prev => {
      const id = p.id || p.code;
      const exist = prev.find(i => i.id === id);
      if (exist) return prev.map(i => i.id === id ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, id, qty: 1}];
    });
  };

  const handleWhatsApp = async () => {
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    updateDoc(statsRef, { totalOrdersClicked: increment(1) }).catch(()=>{});
    const phone = "584120000000"; 
    let msg = `🚗 *NUEVO PEDIDO - AUTOPARTS PRECISION*\n\n`;
    cart.forEach(i => { msg += `• *${i.name}*\n  Ref: ${i.code}\n  Cant: ${i.qty} x $${(Number(i.price) || 0).toFixed(2)}\n\n`; });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f8faff] text-gray-900 font-sans overflow-x-hidden selection:bg-indigo-100">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

      <header className="bg-white/80 backdrop-blur-xl border-b px-6 py-4 flex items-center justify-between sticky top-0 z-[60]">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.location.hash = ''}>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg"><Package className="text-white w-6 h-6" /></div>
          <h1 className="text-xl font-black italic uppercase">AUTO<span className="text-indigo-600">PARTS</span></h1>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`relative bg-white p-3 rounded-2xl border transition-all ${isCartBouncing ? 'scale-125' : ''}`}>
          <ShoppingCart size={20} />
          {totalItemsCount > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{totalItemsCount}</span>}
        </button>
      </header>

      <main>
        {view === 'landing' && <LandingView searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={() => window.location.hash = '#/catalog'} />}
        {view === 'catalog' && <CatalogListView products={filteredProducts} onAddToCart={addToCart} onGoBack={() => window.location.hash = ''} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => { if (u === 'admin' && p === 'AutoPrecision2024*') setIsAdminAuthenticated(true); }} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} searchLogs={searchLogs} onLogout={() => { setIsAdminAuthenticated(false); window.location.hash = ''; }} />}
        {view === 'cart' && <CartView cart={cart} updateQty={(id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: Math.max(1, i.qty + d)} : i))} removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))} onConfirm={handleWhatsApp} />}
        {(view === 'landing' || view === 'catalog' || view === 'cart') && <Footer onLegalClick={() => setShowLegal(true)} onAdminClick={() => window.location.hash = '#/admin'} />}
      </main>

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-3xl border px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-12 z-[100]">
        <button onClick={() => window.location.hash = ''} className={`${view === 'landing' ? 'text-indigo-600' : 'text-gray-400'}`}><Package size={28} /></button>
        <button onClick={() => window.location.hash = '#/catalog'} className={`${view === 'catalog' ? 'text-indigo-600' : 'text-gray-400'}`}><Search size={28} /></button>
        <button onClick={() => window.location.hash = '#/cart'} className={`${view === 'cart' ? 'text-indigo-600' : 'text-gray-400'}`}><ShoppingCart size={28} /></button>
      </nav>
    </div>
  );
};

// --- PANEL ADMIN CON LIMPIADOR DE DATOS ---
const AdminDashboard = ({ products, stats, searchLogs, onLogout }) => {
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleExcel = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = window.XLSX;
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const batch = writeBatch(db);
        
        data.forEach((row) => {
          // LÓGICA DE LIMPIEZA: Convierte comas a puntos y quita espacios
          const rawPrice = String(row.price || row.precio || "0").replace(',', '.').trim();
          const cleanPrice = parseFloat(rawPrice) || 0;

          const cleanProd = {
            code: String(row.code || row.codigo || '').trim(),
            name: String(row.name || row.nombre || '').trim(),
            brand: String(row.brand || row.marca || '').trim(),
            model: String(row.model || row.modelo || '').trim(),
            category: String(row.category || row.categoria || 'Repuestos').trim(),
            price: cleanPrice,
            searches: 0
          };

          if (cleanProd.code && cleanProd.name) {
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', cleanProd.code);
            batch.set(ref, cleanProd, { merge: true });
          }
        });
        await batch.commit();
        alert("¡Inventario actualizado con éxito!"); setShowImport(false);
      } catch (err) { alert("Error al leer el archivo. Revisa los encabezados."); } finally { setImporting(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto text-left">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-3xl font-black uppercase italic leading-none">Admin <span className="text-indigo-600">Panel</span></h2>
        <div className="flex gap-4">
          <button onClick={() => setShowImport(!showImport)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><FileSpreadsheet size={18} /> Importar Excel</button>
          <button onClick={onLogout} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={20} /></button>
        </div>
      </div>
      {showImport && (
        <div className="mb-12 bg-white border-4 border-dashed border-indigo-100 rounded-[3rem] p-12 text-center">
           {!importing ? (
             <div>
               <UploadCloud size={48} className="mx-auto text-indigo-600 mb-4" />
               <p className="font-bold text-gray-500 mb-6">Asegúrate que los encabezados sean: code, name, brand, model, category, price</p>
               <label className="bg-gray-950 text-white px-10 py-4 rounded-xl font-black cursor-pointer inline-block">Seleccionar Archivo<input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcel} /></label>
             </div>
           ) : ( <div className="py-10 text-indigo-600 font-black animate-pulse text-2xl">CARGANDO...</div> )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center">
          <p className="text-[10px] font-black uppercase text-indigo-600 mb-2">Visitas</p>
          <p className="text-4xl font-black">{stats.totalVisits || 0}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center">
          <p className="text-[10px] font-black uppercase text-emerald-600 mb-2">WhatsApp</p>
          <p className="text-4xl font-black">{stats.totalOrdersClicked || 0}</p>
        </div>
      </div>
    </div>
  );
};

// Componentes básicos para que no falte nada
const LandingView = ({ searchTerm, setSearchTerm, onSearch }) => (
  <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
    <h2 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-none italic">AutoParts <span className="text-indigo-600">Precision</span></h2>
    <p className="text-gray-400 font-medium text-lg mb-12 max-w-2xl">Busca tu repuesto en el catálogo real de Valencia.</p>
    <form onSubmit={onSearch} className="relative w-full max-w-2xl bg-white p-4 rounded-[2.5rem] shadow-2xl flex items-center border">
      <Search className="text-indigo-300 ml-4" />
      <input type="text" placeholder="Ej: Amortiguador Hilux" className="w-full py-4 px-6 border-none bg-transparent focus:ring-0 outline-none text-xl font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      <button type="submit" className="bg-gray-950 text-white p-5 rounded-2xl hover:bg-indigo-600 transition-all"><ArrowRight size={24} /></button>
    </form>
  </div>
);

const CatalogListView = ({ products, onAddToCart, onGoBack, searchTerm, setSearchTerm }) => (
  <div className="pb-32 max-w-6xl mx-auto px-4 text-left">
    <div className="mt-8 mb-10 flex items-center gap-6">
      <div className="bg-white p-1 rounded-full flex items-center px-6 flex-1 border shadow-sm">
        <Search className="text-indigo-400" />
        <input type="text" placeholder="Buscando..." className="w-full py-4 px-4 border-none bg-transparent focus:ring-0 outline-none font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      <button onClick={onGoBack} className="text-[10px] font-black uppercase text-gray-400">Cerrar</button>
    </div>
    <div className="space-y-4">
      {products.map((p, idx) => (
        <div key={p.code || idx} className="bg-white p-8 rounded-[2.5rem] border flex flex-col md:flex-row items-center justify-between gap-6 hover:border-indigo-600 transition-all">
          <div className="flex-1">
            <h3 className="text-2xl font-black italic mb-2">{p.name}</h3>
            <div className="flex gap-2"><span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg uppercase">{p.category}</span><span className="text-[10px] font-bold text-gray-400 border px-3 py-1 rounded-lg uppercase">{p.model}</span></div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-4xl font-black italic tracking-tighter">${(Number(p.price) || 0).toFixed(2)}</span>
            <button onClick={() => onAddToCart(p)} className="bg-gray-950 text-white p-5 rounded-full hover:bg-indigo-600"><Plus size={28} /></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CartView = ({ cart, updateQty, removeFromCart, onConfirm }) => (
  <div className="p-8 max-w-4xl mx-auto py-24 text-left">
    <h2 className="text-6xl font-black italic mb-16">Tu <span className="text-indigo-600">Cesta</span></h2>
    {cart.length === 0 ? <p className="text-center py-20 text-gray-300 font-bold">Vuelve al catálogo para agregar piezas.</p> : (
      <div className="space-y-6">
        {cart.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[3rem] border flex items-center justify-between">
            <div className="flex-1"><h4 className="font-bold text-xl italic">{item.name}</h4><p className="text-indigo-600 font-black text-2xl mt-2">${(Number(item.price)||0).toFixed(2)}</p></div>
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-2 gap-4">
              <button onClick={() => updateQty(item.id, -1)} className="p-2"><Minus size={16}/></button>
              <span className="font-black text-xl">{item.qty}</span>
              <button onClick={() => updateQty(item.id, 1)} className="p-2"><Plus size={16}/></button>
            </div>
            <button onClick={() => removeFromCart(item.id)} className="ml-6 text-red-400 hover:text-red-600"><Trash2 size={24} /></button>
          </div>
        ))}
        <div className="mt-12 bg-gray-950 p-12 rounded-[4rem] text-center text-white shadow-2xl">
          <p className="text-gray-500 uppercase font-black text-xs tracking-widest mb-4">Total Pedido</p>
          <h3 className="text-7xl font-black italic mb-12">${cart.reduce((a,b)=>a+(Number(b.price)*b.qty),0).toFixed(2)}</h3>
          <button onClick={onConfirm} className="w-full bg-emerald-500 py-8 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4">Confirmar Pedido <ExternalLink /></button>
        </div>
      </div>
    )}
  </div>
);

const AdminLogin = ({ onLogin }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="bg-white p-12 rounded-[4rem] shadow-2xl border w-full max-w-md text-center">
        <Lock className="mx-auto mb-8 text-indigo-600" size={48} />
        <h2 className="text-2xl font-black uppercase mb-8">Admin Access</h2>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(u, p); }} className="space-y-4 text-left">
          <input type="text" placeholder="Usuario" className="w-full bg-gray-50 p-5 rounded-2xl outline-none border focus:border-indigo-600 font-bold" value={u} onChange={(e) => setU(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-gray-50 p-5 rounded-2xl outline-none border focus:border-indigo-600 font-bold" value={p} onChange={(e) => setP(e.target.value)} />
          <button className="w-full bg-gray-950 text-white py-5 rounded-2xl font-black text-xl mt-4">Acceder</button>
        </form>
      </div>
    </div>
  );
};

const Footer = ({ onLegalClick, onAdminClick }) => (
  <footer className="mt-20 border-t py-16 px-6 text-center text-gray-400">
    <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
      <div className="flex gap-8">
        <button onClick={onLegalClick} className="text-[10px] font-black uppercase tracking-widest hover:text-indigo-600">Privacidad</button>
        <div className="flex items-center gap-2"><MapPin size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Valencia, VE</span></div>
      </div>
      <button onClick={onAdminClick} className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-200">&copy; 2024 AutoParts Precision</button>
    </div>
  </footer>
);

export default App;