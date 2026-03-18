import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ShoppingCart, Package, TrendingUp, Plus, Minus, Trash2,
  ExternalLink, ArrowRight, Zap, LogOut, MessageSquare, MapPin, 
  BarChart2, Target, FileSpreadsheet, UploadCloud, Loader2, History, 
  Eye, FileText, X, Lock, AlertCircle, CheckCircle, Trash
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, increment, 
  onSnapshot, writeBatch, addDoc, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';

// --- CONFIGURACIÓN DE FIREBASE ---
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
  const [stats, setStats] = useState({ totalVisits: 0, totalOrdersClicked: 0 });
  const [searchLogs, setSearchLogs] = useState([]);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false);

  // Carga dinámica de la librería XLSX (SheetJS)
  useEffect(() => {
    if (window.XLSX) { setIsXLSXLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXLSXLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Navegación por Hash (Controlador de Vistas)
  const syncViewWithHash = () => {
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
    window.addEventListener('hashchange', syncViewWithHash);
    syncViewWithHash();
    return () => window.removeEventListener('hashchange', syncViewWithHash);
  }, [isAdminAuthenticated]);

  // Auth y Firebase Connect
  useEffect(() => {
    signInAnonymously(auth).catch(() => setStatusMsg({ text: 'Error de conexión con Google Cloud', type: 'error' }));
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    if (view === 'landing') {
      updateDoc(statsRef, { totalVisits: increment(1) }).catch(() => 
        setDoc(statsRef, { totalVisits: 1, totalOrdersClicked: 0 }, { merge: true })
      );
    }

    const unsubProds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStats = onSnapshot(statsRef, (s) => s.exists() && setStats(s.data()));

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'search_logs'), (snap) => {
      setSearchLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 15));
    });

    return () => { unsubProds(); unsubStats(); unsubLogs(); };
  }, [user, view]);

  const trackSearch = async (term) => {
    if (!term.trim() || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'search_logs'), {
        term: term.trim(),
        timestamp: serverTimestamp()
      });
    } catch (e) {}
  };

  const addToCart = (p) => {
    setIsCartBouncing(true); setTimeout(() => setIsCartBouncing(false), 300);
    setCart(prev => {
      const id = p.id || p.code;
      const exist = prev.find(i => i.id === id);
      if (exist) return prev.map(i => i.id === id ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, id, qty: 1}];
    });
  };

  const handleWhatsApp = () => {
    const statsRef = doc(db, 'artifacts', appId, 'public', 'data', 'stats', 'global');
    updateDoc(statsRef, { totalOrdersClicked: increment(1) }).catch(()=>{});
    const phone = "584120000000"; 
    let msg = `🚗 *CONSULTA DE REPUESTO - AUTOPARTS*\n\n`;
    cart.forEach(i => msg += `• *${i.name}* (Ref: ${i.code}) x${i.qty}\n`);
    msg += `\n💰 *Total Estimado: $${cart.reduce((a,b)=>a+(b.price*b.qty),0).toFixed(2)} USD*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans selection:bg-red-100 selection:text-red-900">
      {statusMsg.text && (
        <div className={`fixed top-0 left-0 right-0 z-[200] p-4 text-center font-bold text-white shadow-xl animate-in slide-in-from-top ${statusMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <div className="flex items-center justify-center gap-3">
            {statusMsg.text}
            <button onClick={() => setStatusMsg({text:'', type:''})} className="ml-4 font-black bg-white/20 p-1 rounded">X</button>
          </div>
        </div>
      )}

      <header className="bg-slate-950 border-b border-red-600/20 p-4 sticky top-0 z-50 flex justify-between items-center px-6 shadow-2xl">
        <div onClick={() => { setSearchTerm(''); window.location.hash = ''; }} className="flex items-center gap-2 cursor-pointer group">
          <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-900/40 group-hover:bg-red-500 transition-colors"><Package className="text-white w-5 h-5" /></div>
          <span className="font-black italic uppercase text-lg tracking-tighter text-white">AUTO<span className="text-red-600">PARTS</span></span>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`p-3 rounded-xl border border-white/10 bg-white/5 text-white relative transition-transform hover:bg-white/10 ${isCartBouncing ? 'scale-110' : ''}`}>
          <ShoppingCart size={20} />
          {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-slate-950 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black ring-2 ring-slate-950">{cart.reduce((a,b)=>a+b.qty, 0)}</span>}
        </button>
      </header>

      <main>
        {view === 'landing' && (
          <LandingView 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm} 
            onSearch={() => { trackSearch(searchTerm); window.location.hash = '#/catalog'; }} 
          />
        )}
        {view === 'catalog' && (
          <CatalogView 
            products={products.filter(p => `${p.name} ${p.code} ${p.model} ${p.category} ${p.brand}`.toLowerCase().includes(searchTerm.toLowerCase()))} 
            onAdd={addToCart} 
            onBack={() => { setSearchTerm(''); window.location.hash = ''; }} 
          />
        )}
        {view === 'admin-login' && (
          <AdminLogin 
            onLogin={(u, p) => {
              if (u === 'admin' && p === 'AutoPrecision2024*') {
                setIsAdminAuthenticated(true);
                return true;
              }
              return false;
            }} 
            setStatus={setStatusMsg}
          />
        )}
        {view === 'admin-dashboard' && (
          <AdminDashboard 
            products={products} 
            stats={stats} 
            logs={searchLogs} 
            onLogout={() => { setIsAdminAuthenticated(false); window.location.hash = ''; }} 
            setStatus={setStatusMsg} 
            isReady={isXLSXLoaded} 
          />
        )}
        {view === 'cart' && <CartView cart={cart} setCart={setCart} onConfirm={handleWhatsApp} />}
      </main>

      <footer className="py-20 text-center bg-slate-950">
        <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-500"><MapPin size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Valencia, Venezuela</span></div>
          </div>
          <button onClick={() => window.location.hash = '#/admin'} className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] hover:text-red-600 transition-colors">
            &copy; 2024 AUTOPARTS PRECISION
          </button>
        </div>
      </footer>
    </div>
  );
};

// --- COMPONENTES DE VISTA ---

const LandingView = ({ searchTerm, setSearchTerm, onSearch }) => {
  const categories = ["Frenos", "Aceite", "Motor", "Suspensión", "Filtros"];
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 text-center bg-white animate-in fade-in duration-1000">
      <div className="bg-yellow-400 text-slate-950 px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-12 shadow-xl shadow-yellow-100 flex items-center gap-2">
        <Zap size={14} fill="currentColor" className="animate-pulse" /> El repuesto que necesitas hoy
      </div>
      <h2 className="text-7xl md:text-[10rem] font-black tracking-tighter italic mb-10 leading-[0.8] text-slate-950">
        CALIDAD Y <br/><span className="text-red-600">POTENCIA.</span>
      </h2>
      
      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="w-full max-w-2xl bg-slate-50 p-2.5 rounded-[2.5rem] shadow-2xl flex items-center border border-slate-100 mb-8 hover:border-red-600/20 transition-all group">
        <Search className="ml-6 text-slate-300 group-focus-within:text-red-600 transition-colors" size={26} />
        <input type="text" placeholder="Busca por pieza o carro..." className="w-full p-5 bg-transparent outline-none font-bold text-xl md:text-3xl placeholder:text-slate-200 text-slate-950" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <button type="submit" className="bg-red-600 text-white p-6 rounded-[2rem] hover:bg-red-700 transition-all shadow-xl active:scale-95"><ArrowRight strokeWidth={4} size={28}/></button>
      </form>

      <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl">
        {categories.map(cat => (
          <button key={cat} onClick={() => { setSearchTerm(cat); window.location.hash = '#/catalog'; }} className="px-6 py-3 bg-white border border-slate-200 hover:border-red-600 hover:text-red-600 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-slate-400 shadow-sm">
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

const CatalogView = ({ products, onAdd, onBack }) => (
  <div className="p-6 max-w-6xl mx-auto pb-40 animate-in fade-in slide-in-from-bottom-8 duration-500 text-left">
    <div className="flex justify-between items-center mb-14 border-b border-slate-100 pb-8">
      <h2 className="text-5xl font-black italic uppercase tracking-tighter">Resultados</h2>
      <button onClick={onBack} className="bg-slate-950 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors">Cerrar</button>
    </div>
    <div className="grid grid-cols-1 gap-6">
      {products.length === 0 ? (
        <div className="text-center py-32 text-slate-200 italic font-black text-3xl uppercase tracking-widest">Sin resultados</div>
      ) : products.map(p => (
        <div key={p.id} className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 flex flex-col md:row items-center justify-between gap-8 hover:border-red-600 transition-all shadow-sm group relative overflow-hidden">
          <div className="w-full text-left relative z-10">
            <h4 className="text-2xl md:text-4xl font-black italic tracking-tight group-hover:text-red-600 transition-colors mb-5 leading-none">{p.name}</h4>
            <div className="flex flex-wrap gap-3">
              <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-2 rounded-xl uppercase tracking-widest shadow-sm">{p.brand}</span>
              <span className="text-[10px] font-bold text-slate-400 border border-slate-100 px-4 py-2 rounded-xl uppercase tracking-widest bg-slate-50">{p.model}</span>
              <span className="text-[10px] font-mono font-bold text-slate-300 py-2">REF: {p.code}</span>
            </div>
          </div>
          <div className="w-full flex items-center justify-between md:justify-end gap-10 relative z-10">
            <span className="text-5xl md:text-7xl font-black italic tracking-tighter text-slate-950 leading-none">${(p.price || 0).toFixed(2)}</span>
            <button onClick={() => onAdd(p)} className="bg-red-600 text-white p-6 md:p-8 rounded-full hover:bg-slate-950 transition-all shadow-2xl active:scale-90"><Plus size={36} strokeWidth={4}/></button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100%] -mr-16 -mt-16 group-hover:bg-red-50 transition-colors"></div>
        </div>
      ))}
    </div>
  </div>
);

const AdminDashboard = ({ products, stats, logs, onLogout, setStatus, isReady }) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Confirmas que deseas eliminar este producto permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
      setStatus({ text: 'Producto eliminado correctamente', type: 'success' });
    } catch (e) { setStatus({ text: 'Error al eliminar de la base de datos', type: 'error' }); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file || !isReady) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = window.XLSX;
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet);
        const batch = writeBatch(db);
        let count = 0;
        rawData.forEach((row) => {
          const findKey = (names) => {
            const key = Object.keys(row).find(k => names.includes(k.toLowerCase().trim()));
            return key ? row[key] : null;
          };
          const code = String(findKey(['code', 'codigo', 'cod', 'ref']) || '').trim();
          const name = String(findKey(['name', 'nombre', 'descripcion']) || '').trim();
          const priceRaw = String(findKey(['price', 'precio', 'costo']) || '0').replace(',', '.');
          if (code && name) {
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', code);
            batch.set(ref, {
              code, name, 
              brand: findKey(['brand', 'marca', 'fabricante']) || 'Genérico',
              model: findKey(['model', 'modelo', 'carro']) || 'Universal',
              category: findKey(['category', 'categoria', 'tipo']) || 'Varios',
              price: parseFloat(priceRaw) || 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
            count++;
          }
        });
        await batch.commit();
        setStatus({ text: `¡Éxito! Se sincronizaron ${count} productos.`, type: 'success' });
      } catch (err) { setStatus({ text: `Error de formato: ${err.message}`, type: 'error' }); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto text-left animate-in fade-in duration-700 pb-40">
      <div className="flex justify-between items-center mb-10 bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl border-b-8 border-red-600">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter">Panel de <span className="text-red-600">Gestión</span></h2>
        <button onClick={onLogout} className="bg-red-600 p-5 rounded-2xl hover:bg-white hover:text-red-600 transition-all shadow-xl active:scale-95"><LogOut size={24} /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* CARGA MASIVA */}
        <div className="bg-white p-12 rounded-[3.5rem] border-4 border-dashed border-slate-100 shadow-sm text-center flex flex-col justify-center hover:border-red-600/30 transition-colors">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="animate-spin text-red-600" size={48} />
              <p className="font-black text-red-600 uppercase text-xs">Actualizando Cloud DB...</p>
            </div>
          ) : (
            <>
              <UploadCloud size={64} className="mx-auto text-red-600 mb-6" />
              <h3 className="text-xl font-black uppercase italic mb-2 leading-none">Importación de Stock</h3>
              <p className="text-slate-400 text-sm mb-8 font-medium">Arrastra tu archivo Excel con columnas de nombre, código y precio.</p>
              <label className="bg-slate-950 text-white px-12 py-5 rounded-2xl font-black cursor-pointer hover:bg-red-600 transition-all text-sm tracking-widest uppercase shadow-xl">
                Seleccionar Archivo<input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} />
              </label>
            </>
          )}
        </div>

        {/* RADAR DE BUSQUEDAS */}
        <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-sm">
          <div className="flex items-center gap-3 mb-8 px-2"><Eye className="text-red-600" size={24}/><h3 className="text-xl font-black uppercase italic leading-none">Radar de Clientes</h3></div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
            {logs.length === 0 ? <p className="text-slate-300 text-center py-10 italic">Aún no hay registros</p> : logs.map(log => (
              <div key={log.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-red-600/20 transition-all">
                <span className="font-bold text-slate-800 uppercase text-sm italic">"{log.term}"</span>
                <span className="text-[10px] text-slate-400 font-mono">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recién'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex items-center justify-between">
           <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Visitas del Mes</p><p className="text-5xl font-black text-slate-950">{stats.totalVisits || 0}</p></div>
           <TrendingUp size={40} className="text-red-600 opacity-20" />
        </div>
        <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex items-center justify-between">
           <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Clics WhatsApp</p><p className="text-5xl font-black text-slate-950">{stats.totalOrdersClicked || 0}</p></div>
           <MessageSquare size={40} className="text-emerald-500 opacity-20" />
        </div>
      </div>

      {/* TABLA DE BORRADO */}
      <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
        <h3 className="font-black uppercase italic mb-10 text-2xl tracking-tighter">Limpieza de Inventario ({products.length})</h3>
        <div className="max-h-[600px] overflow-y-auto no-scrollbar pr-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">
                <th className="pb-4">Pieza / Carro</th>
                <th className="pb-4">Ref.</th>
                <th className="pb-4 text-right">Precio</th>
                <th className="pb-4 text-right">Borrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map(p => (
                <tr key={p.id} className="group hover:bg-slate-50 transition-all">
                  <td className="py-6 pr-4">
                    <p className="font-bold text-base text-slate-950 leading-tight group-hover:text-red-600 transition-colors">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.brand} • {p.model}</p>
                  </td>
                  <td className="py-6 font-mono text-xs text-slate-400 font-black tracking-widest uppercase">{p.code}</td>
                  <td className="py-6 font-black text-slate-950 text-right text-xl italic">${(p.price||0).toFixed(2)}</td>
                  <td className="py-6 text-right">
                    <button onClick={() => handleDelete(p.id)} className="p-4 bg-slate-100 text-slate-300 hover:bg-red-600 hover:text-white rounded-2xl transition-all active:scale-90"><Trash size={20} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CartView = ({ cart, setCart, onConfirm }) => {
  const total = cart.reduce((a,b)=>a+(b.price*b.qty), 0);
  return (
    <div className="p-8 max-w-4xl mx-auto py-24 text-left animate-in slide-in-from-bottom-12">
      <h2 className="text-7xl md:text-[10rem] font-black italic mb-20 tracking-tighter italic leading-none">Tu <span className="text-red-600 underline decoration-yellow-400 decoration-8 underline-offset-[1.5rem]">Cesta</span></h2>
      {cart.length === 0 ? (
        <div className="bg-white border-4 border-dashed border-slate-100 rounded-[4rem] p-20 text-center">
          <p className="text-slate-300 font-black italic text-4xl uppercase tracking-widest mb-12">Carrito Vacío</p>
          <button onClick={() => window.location.hash = '#/catalog'} className="bg-red-600 text-white px-16 py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-slate-950 transition-all active:scale-95">IR AL CATÁLOGO</button>
        </div>
      ) : (
        <div className="space-y-8">
          {cart.map(item => (
            <div key={item.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between shadow-xl group hover:border-red-600 transition-all">
              <div className="text-left w-full">
                <h4 className="font-black text-2xl md:text-3xl italic tracking-tight mb-4 group-hover:text-red-600 transition-colors leading-none">{item.name}</h4>
                <div className="flex items-center gap-10">
                  <p className="text-slate-950 font-black text-4xl italic leading-none">${item.price.toFixed(2)}</p>
                  <div className="flex items-center bg-slate-950 text-white rounded-[2rem] px-8 py-4 gap-8 shadow-xl">
                    <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty-1)} : i))} className="hover:text-red-600 transition-colors"><Minus size={20} strokeWidth={4}/></button>
                    <span className="font-black text-2xl w-8 text-center">{item.qty}</span>
                    <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i))} className="hover:text-red-600 transition-colors"><Plus size={20} strokeWidth={4}/></button>
                  </div>
                </div>
              </div>
              <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="mt-10 md:mt-0 p-6 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-full transition-all active:scale-90"><Trash2 size={28} /></button>
            </div>
          ))}
          <div className="bg-slate-950 p-16 rounded-[4rem] text-center text-white mt-20 shadow-3xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-600 uppercase font-black text-xs tracking-[0.5em] mb-6">Monto Total a Consultar</p>
              <h3 className="text-8xl md:text-[10rem] font-black italic mb-16 tracking-tighter leading-none">${total.toFixed(2)}</h3>
              <button onClick={onConfirm} className="w-full bg-red-600 py-12 rounded-[3rem] font-black text-4xl flex items-center justify-center gap-6 hover:bg-red-500 transition-all shadow-2xl shadow-red-900/40 active:scale-95">PEDIR POR WHATSAPP <ExternalLink size={40} strokeWidth={4}/></button>
            </div>
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-red-600/10 blur-[100px] rounded-full group-hover:bg-red-600/20 transition-all"></div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLogin = ({ onLogin, setStatus }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin(u, p)) {
      setIsError(false);
      // La navegación se maneja automáticamente por el cambio de estado isAdminAuthenticated en el padre
    } else {
      setIsError(true);
      setStatus({ text: "Credenciales de acceso incorrectas", type: "error" });
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6 bg-slate-950 animate-in fade-in zoom-in duration-500">
      <div className={`bg-white p-14 rounded-[4.5rem] shadow-2xl border-8 w-full max-w-md text-center transition-all ${isError ? 'border-red-600 animate-shake' : 'border-slate-100'}`}>
        <div className="bg-red-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-12 mx-auto text-white shadow-xl shadow-red-900/40"><Lock size={48} strokeWidth={3} /></div>
        <h2 className="text-4xl font-black uppercase mb-12 italic tracking-tighter text-slate-950">Acceso <span className="text-red-600">Admin</span></h2>
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-5">Usuario Maestro</label>
            <input type="text" placeholder="Ej: admin" className="w-full bg-slate-50 p-7 rounded-[2rem] outline-none border-2 border-transparent focus:border-red-600 transition-all font-bold text-xl placeholder:text-slate-200" value={u} onChange={(e) => setU(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-5">Clave de Seguridad</label>
            <input type="password" placeholder="••••••••" className="w-full bg-slate-50 p-7 rounded-[2rem] outline-none border-2 border-transparent focus:border-red-600 transition-all font-bold text-xl placeholder:text-slate-200" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
          <button type="submit" className="w-full bg-slate-950 text-white py-8 rounded-[2.5rem] font-black text-2xl mt-6 hover:bg-red-600 transition-all shadow-xl active:scale-95 shadow-slate-200">DESBLOQUEAR</button>
        </form>
      </div>
    </div>
  );
};

export default App;