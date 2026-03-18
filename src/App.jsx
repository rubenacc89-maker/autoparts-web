import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Package, TrendingUp, Plus, Minus, Trash2,
  ExternalLink, ArrowRight, Zap, LogOut, MessageSquare, MapPin, 
  BarChart2, Target, FileSpreadsheet, UploadCloud, Loader2, History, 
  Eye, FileText, X, Lock, AlertCircle, CheckCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, increment, 
  onSnapshot, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';

// --- CONFIGURACIÓN DE FIREBASE (ASEGÚRATE QUE SEAN TUS LLAVES) ---
const firebaseConfig = {
  apiKey: "AIzaSyBHFisfAJoX3dgIB97N4HRez8FIJkJokhA",
  authDomain: "autoparts-b4a5c.firebaseapp.com",
  projectId: "autoparts-b4a5c",
  storageBucket: "autoparts-b4a5c.firebasestorage.app",
  messagingSenderId: "131717003315",
  appId: "1:131717003315:web:c6f30ca327055cbae5cb46"
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
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Sincronización de Hash (Navegación)
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

  // Auth y Listeners
  useEffect(() => {
    signInAnonymously(auth).catch(() => setStatusMsg({ text: 'Error de conexión con Google', type: 'error' }));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    if (view === 'landing') updateDoc(statsRef, { totalVisits: increment(1) }).catch(() => setDoc(statsRef, { totalVisits: 1 }, { merge: true }));

    const unsubProds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubStats = onSnapshot(statsRef, (s) => s.exists() && setStats(s.data()));
    return () => { unsubProds(); unsubStats(); };
  }, [user, view]);

  // Lógica de Carrito
  const addToCart = (p) => {
    setIsCartBouncing(true); setTimeout(() => setIsCartBouncing(false), 300);
    setCart(prev => {
      const exist = prev.find(i => i.id === (p.id || p.code));
      if (exist) return prev.map(i => i.id === (p.id || p.code) ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, id: p.id || p.code, qty: 1}];
    });
  };

  const handleWhatsApp = () => {
    const phone = "584120000000"; 
    let msg = `🚗 *NUEVO PEDIDO - AUTOPARTS PRECISION*\n\n`;
    cart.forEach(i => msg += `• *${i.name}* (Ref: ${i.code}) x${i.qty}\n`);
    msg += `\n💰 *Total: $${cart.reduce((a,b)=>a+(b.price*b.qty),0).toFixed(2)}*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {statusMsg.text && (
        <div className={`fixed top-0 left-0 right-0 z-[200] p-4 text-center font-bold text-white shadow-lg animate-bounce ${statusMsg.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {statusMsg.text}
          <button onClick={() => setStatusMsg({text:'', type:''})} className="ml-4 underline">Cerrar</button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-50 flex justify-between items-center">
        <div onClick={() => window.location.hash = ''} className="flex items-center gap-2 cursor-pointer">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-200 shadow-lg"><Package className="text-white" /></div>
          <span className="font-black italic uppercase text-lg">AUTO<span className="text-indigo-600">PARTS</span></span>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`p-3 rounded-2xl border bg-white relative transition-transform ${isCartBouncing ? 'scale-125' : ''}`}>
          <ShoppingCart size={20} />
          {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{cart.reduce((a,b)=>a+b.qty, 0)}</span>}
        </button>
      </header>

      <main>
        {view === 'landing' && <LandingView onSearch={() => window.location.hash = '#/catalog'} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {view === 'catalog' && <CatalogView products={products.filter(p => `${p.name} ${p.code} ${p.model}`.toLowerCase().includes(searchTerm.toLowerCase()))} onAdd={addToCart} onBack={() => window.location.hash = ''} />}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => u === 'admin' && p === 'AutoPrecision2024*'} onAuthSuccess={() => setIsAdminAuthenticated(true)} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} onLogout={() => setIsAdminAuthenticated(false)} setStatus={setStatusMsg} />}
        {view === 'cart' && <CartView cart={cart} setCart={setCart} onConfirm={handleWhatsApp} />}
      </main>

      <Footer onAdmin={() => window.location.hash = '#/admin'} />
    </div>
  );
};

// --- COMPONENTE ADMIN REFORZADO ---
const AdminDashboard = ({ products, stats, onLogout, setStatus }) => {
  const [loading, setLoading] = useState(false);

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) throw new Error("Librería de Excel no cargada. Recarga la página.");
        
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet);
        
        if (rawData.length === 0) throw new Error("El archivo está vacío.");

        const batch = writeBatch(db);
        let count = 0;

        rawData.forEach((row) => {
          // BUSCADOR DE COLUMNAS INTELIGENTE (No importa si es Mayúscula o Minúscula)
          const findKey = (names) => {
            const key = Object.keys(row).find(k => names.includes(k.toLowerCase().trim()));
            return key ? row[key] : null;
          };

          const code = String(findKey(['code', 'codigo', 'cod']) || '').trim();
          const name = String(findKey(['name', 'nombre', 'descripcion']) || '').trim();
          const priceRaw = String(findKey(['price', 'precio', 'monto']) || '0').replace(',', '.');

          if (code && name) {
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', code);
            batch.set(ref, {
              code,
              name,
              brand: findKey(['brand', 'marca']) || 'Genérico',
              model: findKey(['model', 'modelo', 'carro']) || 'Universal',
              category: findKey(['category', 'categoria', 'tipo']) || 'Repuestos',
              price: parseFloat(priceRaw) || 0,
              searches: 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
            count++;
          }
        });

        await batch.commit();
        setStatus({ text: `¡Éxito! Se cargaron ${count} productos.`, type: 'success' });
      } catch (err) {
        setStatus({ text: `Error: ${err.message}`, type: 'error' });
      } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-black italic">PANEL <span className="text-indigo-600">ADMIN</span></h2>
        <button onClick={onLogout} className="p-3 bg-red-50 text-red-500 rounded-xl"><LogOut /></button>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border-4 border-dashed border-indigo-100 text-center mb-10">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <p className="font-black text-indigo-600 uppercase tracking-widest">Procesando Inventario...</p>
          </div>
        ) : (
          <div>
            <UploadCloud size={48} className="mx-auto text-indigo-600 mb-4" />
            <h3 className="text-xl font-bold mb-2 uppercase">Cargar Excel de Repuestos</h3>
            <p className="text-slate-400 text-sm mb-6">El sistema detectará automáticamente tus columnas aunque estén en español.</p>
            <label className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black cursor-pointer hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              Seleccionar Archivo
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} />
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2"><Eye size={16}/> VISITAS</div>
          <p className="text-4xl font-black">{stats.totalVisits || 0}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 font-bold mb-2"><MessageSquare size={16}/> WHATSAPP</div>
          <p className="text-4xl font-black">{stats.totalOrdersClicked || 0}</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 font-bold mb-2"><Package size={16}/> PRODUCTOS</div>
          <p className="text-4xl font-black">{products.length}</p>
        </div>
      </div>
    </div>
  );
};

// Vistas secundarias
const LandingView = ({ onSearch, searchTerm, setSearchTerm }) => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
    <h1 className="text-6xl md:text-8xl font-black tracking-tighter italic mb-6">Tu pieza, <br/><span className="text-indigo-600">al momento.</span></h1>
    <p className="text-slate-400 font-medium mb-12 max-w-xl">Catálogo especializado de repuestos en Valencia. Busca, elige y consulta por WhatsApp.</p>
    <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="w-full max-w-2xl bg-white p-2 rounded-[2.5rem] shadow-2xl flex items-center border border-indigo-50">
      <Search className="ml-6 text-indigo-300" />
      <input type="text" placeholder="Ej: Filtro de aceite Aceite..." className="w-full p-6 bg-transparent outline-none font-bold text-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      <button className="bg-indigo-600 text-white p-6 rounded-[2rem] hover:bg-indigo-700 transition-all"><ArrowRight/></button>
    </form>
  </div>
);

const CatalogView = ({ products, onAdd, onBack }) => (
  <div className="p-6 max-w-6xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 text-left">
    <div className="flex justify-between items-center mb-8">
      <h2 className="text-3xl font-black italic uppercase">Catálogo</h2>
      <button onClick={onBack} className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Volver</button>
    </div>
    <div className="space-y-4">
      {products.length === 0 ? <p className="text-center py-20 text-slate-300 font-bold">No hay repuestos que coincidan con tu búsqueda.</p> : products.map(p => (
        <div key={p.code} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-indigo-600 transition-all shadow-sm">
          <div className="flex-1">
            <h4 className="text-2xl font-black italic">{p.name}</h4>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg uppercase tracking-widest">{p.category}</span>
              <span className="text-[10px] font-bold text-slate-400 border px-3 py-1 rounded-lg uppercase tracking-widest">{p.model}</span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-4xl font-black italic tracking-tighter">${(p.price || 0).toFixed(2)}</span>
            <button onClick={() => onAdd(p)} className="bg-slate-900 text-white p-5 rounded-full hover:bg-indigo-600 transition-all shadow-xl"><Plus size={28}/></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CartView = ({ cart, setCart, onConfirm }) => (
  <div className="p-8 max-w-4xl mx-auto py-20 animate-in slide-in-from-bottom-8 text-left">
    <h2 className="text-6xl font-black italic mb-12">Tu <span className="text-indigo-600">Cesta</span></h2>
    {cart.length === 0 ? (
      <div className="text-center py-20">
        <p className="text-slate-300 font-bold mb-8">Aún no has agregado repuestos.</p>
        <button onClick={() => window.location.hash = '#/catalog'} className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black">IR AL CATÁLOGO</button>
      </div>
    ) : (
      <div className="space-y-6">
        {cart.map(item => (
          <div key={item.id} className="bg-white p-8 rounded-[3rem] border flex items-center justify-between shadow-sm">
            <div><h4 className="font-bold text-xl italic">{item.name}</h4><p className="text-indigo-600 font-black text-2xl">${item.price.toFixed(2)}</p></div>
            <div className="flex items-center bg-slate-100 rounded-2xl px-4 py-2 gap-4">
              <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty-1)} : i))}><Minus size={16}/></button>
              <span className="font-black text-xl">{item.qty}</span>
              <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i))}><Plus size={16}/></button>
            </div>
          </div>
        ))}
        <div className="bg-slate-950 p-12 rounded-[4rem] text-center text-white mt-10 shadow-2xl">
          <p className="text-slate-500 uppercase font-black text-xs tracking-widest mb-4">Total Pedido</p>
          <h3 className="text-7xl font-black italic mb-12 tracking-tighter">${cart.reduce((a,b)=>a+(b.price*b.qty),0).toFixed(2)}</h3>
          <button onClick={onConfirm} className="w-full bg-emerald-500 py-8 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all">CONSULTAR WHATSAPP <ExternalLink/></button>
        </div>
      </div>
    )}
  </div>
);

const AdminLogin = ({ onLogin, onAuthSuccess }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="bg-white p-12 rounded-[4rem] shadow-2xl border w-full max-w-md text-center">
        <Lock className="mx-auto mb-8 text-indigo-600" size={48} />
        <h2 className="text-2xl font-black uppercase mb-8 italic">Acceso Admin</h2>
        <form onSubmit={(e) => { e.preventDefault(); if(onLogin(u,p)) onAuthSuccess(); else alert("Error"); }} className="space-y-4 text-left">
          <input type="text" placeholder="Usuario" className="w-full bg-slate-50 p-5 rounded-2xl outline-none border focus:border-indigo-600 font-bold" value={u} onChange={(e) => setU(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-50 p-5 rounded-2xl outline-none border focus:border-indigo-600 font-bold" value={p} onChange={(e) => setP(e.target.value)} />
          <button className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-xl mt-4">ENTRAR</button>
        </form>
      </div>
    </div>
  );
};

const Footer = ({ onAdmin }) => (
  <footer className="py-20 text-center">
    <div className="flex justify-center gap-8 mb-4">
      <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">Valencia, Venezuela</span>
    </div>
    <button onClick={onAdmin} className="text-[10px] font-black text-slate-200 uppercase tracking-[0.5em] hover:text-slate-400">&copy; 2024 AUTOPARTS PRECISION</button>
  </footer>
);

export default App;