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

  useEffect(() => {
    if (window.XLSX) { setIsXLSXLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXLSXLoaded(true);
    document.head.appendChild(script);
  }, []);

  const syncViewWithHash = () => {
    const h = window.location.hash;
    if (h === '#/admin') setView(isAdminAuthenticated ? 'admin-dashboard' : 'admin-login');
    else if (h === '#/cart') setView('cart');
    else if (h === '#/catalog') setView('catalog');
    else setView('landing');
  };

  useEffect(() => {
    window.addEventListener('hashchange', syncViewWithHash);
    syncViewWithHash();
    return () => window.removeEventListener('hashchange', syncViewWithHash);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    signInAnonymously(auth).catch(() => setStatusMsg({ text: 'Error de conexión', type: 'error' }));
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

  // --- LÓGICA DE BÚSQUEDA ROBUSTA (Smart Search) ---
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    
    // Palabras a ignorar (conectores comunes en español)
    const stopWords = ['de', 'para', 'con', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'por'];
    
    // Limpiamos y separamos la búsqueda en palabras clave (tokens)
    const keywords = searchTerm.toLowerCase()
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.includes(word));

    if (keywords.length === 0) return products;

    return products.filter(p => {
      // Combinamos todos los campos buscables en un solo texto plano
      const productText = `
        ${p.name || ''} 
        ${p.code || ''} 
        ${p.model || ''} 
        ${p.category || ''} 
        ${p.brand || ''} 
        ${p.carBrand || ''} 
        ${p.measure || ''} 
        ${p.year || ''}
      `.toLowerCase();
      
      // Verificamos que CADA palabra clave de la búsqueda esté presente en alguna parte del producto
      // Esto permite que "Filtro de Aceite" coincida con "Filtro Aceite" porque ignora el "de"
      return keywords.every(key => productText.includes(key));
    });
  }, [products, searchTerm]);

  const trackSearch = async (term) => {
    if (!term.trim() || !user) return;
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'search_logs'), { term: term.trim(), timestamp: serverTimestamp() }); } catch (e) {}
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
    let msg = `🚗 *CONSULTA - AUTOPARTS*\n\n`;
    cart.forEach(i => msg += `• *${i.name}* (Ref: ${i.code}) x${i.qty}\n`);
    msg += `\n💰 *Total Estimado: $${cart.reduce((a,b)=>a+(b.price*b.qty),0).toFixed(2)} USD*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans selection:bg-red-100 overflow-x-hidden">
      {statusMsg.text && (
        <div className={`fixed top-0 left-0 right-0 z-[200] p-4 text-center font-bold text-white shadow-xl ${statusMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <div className="flex items-center justify-center gap-3">
            {statusMsg.text}
            <button onClick={() => setStatusMsg({text:'', type:''})} className="ml-4 font-black bg-white/20 p-1 rounded">X</button>
          </div>
        </div>
      )}

      <header className="bg-slate-950 border-b border-red-600/20 p-4 sticky top-0 z-50 flex justify-between items-center px-4 md:px-10 shadow-2xl">
        <div onClick={() => { setSearchTerm(''); window.location.hash = ''; }} className="flex items-center gap-2 cursor-pointer group">
          <div className="bg-red-600 p-2 rounded-lg shadow-lg group-hover:bg-red-500 transition-colors"><Package className="text-white w-5 h-5" /></div>
          <span className="font-black italic uppercase text-lg tracking-tighter text-white">AUTO<span className="text-red-600">PARTS</span></span>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`p-3 rounded-xl border border-white/10 bg-white/5 text-white relative transition-transform ${isCartBouncing ? 'scale-110' : ''}`}>
          <ShoppingCart size={20} />
          {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-slate-950 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black ring-2 ring-slate-950">{cart.reduce((a,b)=>a+b.qty, 0)}</span>}
        </button>
      </header>

      <main className="overflow-x-hidden">
        {view === 'landing' && (
          <LandingView 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm} 
            onSearch={() => { trackSearch(searchTerm); window.location.hash = '#/catalog'; }} 
          />
        )}
        {view === 'catalog' && (
          <CatalogView 
            products={filteredProducts} 
            onAdd={addToCart} 
            onBack={() => { setSearchTerm(''); window.location.hash = ''; }} 
          />
        )}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => { if (u === 'admin' && p === 'AutoPrecision2024*') { setIsAdminAuthenticated(true); return true; } return false; }} setStatus={setStatusMsg} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} logs={searchLogs} onLogout={() => { setIsAdminAuthenticated(false); window.location.hash = ''; }} setStatus={setStatusMsg} isReady={isXLSXLoaded} user={user} />}
        {view === 'cart' && <CartView cart={cart} setCart={setCart} onConfirm={handleWhatsApp} />}
      </main>

      <footer className="py-20 text-center bg-slate-950 px-6">
        <button onClick={() => window.location.hash = '#/admin'} className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] hover:text-red-600 transition-colors cursor-default">
          &copy; 2024 AUTOPARTS PRECISION
        </button>
      </footer>
    </div>
  );
};

const LandingView = ({ searchTerm, setSearchTerm, onSearch }) => {
  const categories = ["Frenos", "Aceite", "Motor", "Suspensión", "Filtros"];
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-white">
      <div className="bg-yellow-400 text-slate-950 px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-12 shadow-xl shadow-yellow-100 flex items-center gap-2">
        <Zap size={14} fill="currentColor" /> El repuesto que necesitas hoy
      </div>
      <h2 className="text-5xl md:text-9xl font-black tracking-tighter italic mb-10 leading-[0.9] text-slate-950 px-2 uppercase">
        Calidad y <br/><span className="text-red-600">Potencia.</span>
      </h2>
      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="w-full max-w-2xl bg-slate-50 p-2 rounded-[2rem] shadow-2xl flex items-center border border-slate-100 mb-8 transition-all group">
        <Search className="ml-4 text-slate-300" size={24} />
        <input type="text" placeholder="Busca por pieza, marca o carro..." className="w-full p-4 bg-transparent outline-none font-bold text-lg md:text-2xl placeholder:text-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <button type="submit" className="bg-red-600 text-white p-4 rounded-[1.5rem] hover:bg-red-700 active:scale-95"><ArrowRight size={24}/></button>
      </form>
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => { setSearchTerm(cat); window.location.hash = '#/catalog'; }} className="px-4 py-2 bg-white border border-slate-200 hover:border-red-600 hover:text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400">
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

const CatalogView = ({ products, onAdd, onBack }) => (
  <div className="p-4 md:p-10 max-w-6xl mx-auto pb-40 text-left">
    <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6 px-2">
      <h2 className="text-3xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900">Resultados</h2>
      <button onClick={onBack} className="bg-slate-950 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Cerrar</button>
    </div>
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="text-center py-20 text-slate-200 italic font-black text-xl uppercase">Sin coincidencias</div>
      ) : products.map(p => (
        <div key={p.id} className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-red-600 transition-all shadow-sm group relative overflow-hidden">
          <div className="w-full">
            <h4 className="text-2xl md:text-4xl font-black italic tracking-tight group-hover:text-red-600 transition-colors mb-5 leading-tight text-slate-950 uppercase">{p.name}</h4>
            <div className="flex flex-wrap gap-2 md:gap-3">
              {p.brand && <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg uppercase shadow-sm border border-yellow-500/20">{p.brand}</span>}
              {p.measure && <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg uppercase shadow-sm border border-yellow-500/20">{p.measure}</span>}
              {p.carBrand && <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg uppercase shadow-sm border border-yellow-500/20">{p.carBrand}</span>}
              {p.model && <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg uppercase shadow-sm border border-yellow-500/20">{p.model}</span>}
              {p.year && <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-4 py-1.5 rounded-lg uppercase shadow-sm border border-yellow-500/20">{p.year}</span>}
              <span className="text-[10px] font-mono font-bold text-slate-300 py-1.5 ml-1">REF: {p.code}</span>
            </div>
          </div>
          <div className="w-full flex items-center justify-between md:justify-end gap-6 md:gap-14 border-t md:border-t-0 pt-6 md:pt-0">
            <div className="flex flex-col items-start md:items-end">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Precio Final</span>
               <span className="text-5xl md:text-7xl font-black italic tracking-tighter text-slate-950 leading-none">${(p.price || 0).toFixed(2)}</span>
            </div>
            <button onClick={() => onAdd(p)} className="bg-red-600 text-white p-6 md:p-8 rounded-full hover:bg-slate-950 transition-all shadow-xl active:scale-90"><Plus size={36} strokeWidth={4}/></button>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50/50 rounded-bl-full -mr-12 -mt-12 group-hover:bg-red-50 transition-colors -z-10"></div>
        </div>
      ))}
    </div>
  </div>
);

const CartView = ({ cart, setCart, onConfirm }) => {
  const total = cart.reduce((a,b)=>a+(b.price*b.qty), 0);
  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto py-12 md:py-24 text-left">
      <h2 className="text-5xl md:text-9xl font-black italic mb-16 tracking-tighter leading-none px-2 text-slate-900 uppercase">Tu <span className="text-red-600 underline decoration-yellow-400 decoration-4 md:decoration-8 underline-offset-4 md:underline-offset-8 italic">Cesta</span></h2>
      {cart.length === 0 ? (
        <div className="bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-16 text-center">
          <p className="text-slate-300 font-black italic text-4xl uppercase mb-10 tracking-widest">Vacío</p>
          <button onClick={() => window.location.hash = '#/catalog'} className="bg-red-600 text-white px-12 py-6 rounded-2xl font-black shadow-lg hover:bg-slate-950 transition-all">CATÁLOGO</button>
        </div>
      ) : (
        <div className="space-y-5">
          {cart.map(item => (
            <div key={item.id} className="bg-white p-8 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-xl group hover:border-red-600 transition-all relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <h4 className="font-black text-2xl md:text-3xl italic tracking-tight mb-4 pr-16 text-slate-950 leading-none uppercase">{item.name}</h4>
                  <div className="flex items-center gap-8">
                    <p className="text-red-600 font-black text-3xl md:text-4xl italic leading-none">${item.price.toFixed(2)}</p>
                    <div className="flex items-center bg-slate-950 text-white rounded-2xl px-6 py-3 gap-6 shadow-lg">
                      <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty-1)} : i))}><Minus size={20} strokeWidth={3}/></button>
                      <span className="font-black text-2xl w-6 text-center">{item.qty}</span>
                      <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i))}><Plus size={20} strokeWidth={3}/></button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="absolute top-6 right-6 p-4 bg-red-50 text-red-500 rounded-full hover:bg-red-600 hover:text-white transition-all shadow-sm"><Trash2 size={24}/></button>
              </div>
            </div>
          ))}
          <div className="bg-slate-950 p-10 md:p-20 rounded-[3.5rem] md:rounded-[5rem] text-center text-white mt-12 shadow-3xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-600 uppercase font-black text-xs tracking-widest mb-6">Monto Total Estimado</p>
              <h3 className="text-6xl md:text-[11rem] font-black italic mb-14 tracking-tighter leading-none">${total.toFixed(2)}</h3>
              <button onClick={onConfirm} className="w-full bg-red-600 py-8 md:py-12 rounded-[2.5rem] md:rounded-[3.5rem] font-black text-2xl md:text-5xl flex items-center justify-center gap-6 hover:bg-red-500 transition-all shadow-2xl active:scale-95 shadow-red-900/40">PEDIR POR WHATSAPP <ExternalLink size={32} strokeWidth={4}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ products, stats, logs, onLogout, setStatus, isReady, user }) => {
  const [loading, setLoading] = useState(false);
  const handleDelete = async (id) => {
    if (!window.confirm("¿Confirmas eliminar este producto?")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); setStatus({ text: 'Eliminado', type: 'success' }); } catch (e) { setStatus({text: 'Error al borrar', type:'error'}); }
  };
  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file || !isReady || !user) return;
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
              code, name, brand: findKey(['brand', 'marca', 'fabricante']) || '',
              measure: findKey(['measure', 'medida', 'medidas', 'peso', 'litros']) || '',
              carBrand: findKey(['carbrand', 'marcacarro', 'vehiculo', 'marca_auto']) || '',
              model: findKey(['model', 'modelo']) || '',
              year: findKey(['year', 'año', 'fecha']) || '',
              category: findKey(['category', 'categoria', 'tipo']) || 'Varios', 
              price: parseFloat(priceRaw) || 0, updatedAt: serverTimestamp() 
            }, { merge: true });
            count++;
          }
        });
        await batch.commit(); setStatus({ text: `¡Éxito! ${count} productos sincronizados.`, type: 'success' });
      } catch (err) { setStatus({ text: `Error de Permisos: Revisa la consola de Firebase`, type: 'error' }); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4 md:p-12 max-w-7xl mx-auto text-left animate-in fade-in duration-700 pb-40">
      <div className="flex justify-between items-center mb-10 bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl border-b-8 border-red-600">
        <h2 className="text-2xl md:text-5xl font-black italic uppercase italic tracking-tighter">Panel de <span className="text-red-600">Control</span></h2>
        <button onClick={onLogout} className="bg-red-600 p-4 rounded-xl hover:bg-white hover:text-red-600 transition-all shadow-lg active:scale-90"><LogOut size={24} /></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-white p-10 rounded-[3.5rem] border-4 border-dashed border-slate-100 text-center flex flex-col justify-center items-center group hover:border-red-600/30 transition-colors">
          {!user && <div className="text-red-500 font-bold mb-4 flex items-center gap-2"><AlertCircle size={16}/> ERROR DE CONEXIÓN CON GOOGLE</div>}
          {loading ? <Loader2 className="animate-spin text-red-600" size={48} /> : (
            <>
              <UploadCloud size={64} className="text-red-600 mb-6" />
              <h3 className="font-black uppercase italic mb-2 text-xl text-slate-950">Importar Inventario</h3>
              <p className="text-slate-400 text-sm mb-10 max-w-xs">Usa columnas: code, name, brand, measure, carBrand, model, year, price</p>
              <label className={`px-10 py-5 rounded-2xl font-black cursor-pointer text-xs tracking-widest uppercase transition-all shadow-xl ${!user ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-slate-950 text-white hover:bg-red-600'}`}>
                Seleccionar Archivo<input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleImport} disabled={!user} />
              </label>
            </>
          )}
        </div>
        <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 mb-8"><Eye className="text-red-600" size={28}/><h3 className="font-black uppercase text-lg italic text-slate-950">Radar de Clientes</h3></div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto no-scrollbar flex-1">
            {logs.length === 0 ? <p className="text-slate-200 text-center py-10 italic">Sin actividad reciente</p> : logs.map(log => (
              <div key={log.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-red-600/20 transition-all">
                <span className="font-bold text-slate-800 uppercase text-xs italic">"{log.term}"</span>
                <span className="text-[10px] text-slate-400 font-mono">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recién'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white p-8 md:p-12 rounded-[4rem] border border-slate-100 shadow-3xl overflow-hidden">
        <h3 className="font-black uppercase italic mb-8 text-2xl tracking-tighter text-slate-950">Limpieza de Stock ({products.length})</h3>
        <div className="max-h-[600px] overflow-y-auto no-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase border-b-2 border-slate-50 pb-4">
                <th className="pb-4 px-2">Pieza Detallada</th>
                <th className="pb-4 text-right">Precio</th>
                <th className="pb-4 text-right">Eliminar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map(p => (
                <tr key={p.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-6 px-2">
                    <p className="font-bold text-base text-slate-900 group-hover:text-red-600 transition-colors leading-tight mb-1 uppercase">{p.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{p.brand} {p.carBrand} {p.model} {p.year}</p>
                  </td>
                  <td className="py-6 font-black text-right text-xl italic text-slate-950">${(p.price||0).toFixed(2)}</td>
                  <td className="py-6 text-right"><button onClick={() => handleDelete(p.id)} className="p-4 bg-slate-100 text-slate-300 hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-sm"><Trash size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminLogin = ({ onLogin, setStatus }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6 bg-slate-950 animate-in zoom-in duration-500">
      <div className="bg-white p-14 rounded-[4.5rem] shadow-2xl border-8 border-red-600 w-full max-w-md text-center">
        <Lock className="mx-auto mb-10 text-red-600" size={56} strokeWidth={3} />
        <h2 className="text-3xl font-black uppercase mb-12 italic tracking-tighter text-slate-950">Acceso <span className="text-red-600">Restringido</span></h2>
        <form onSubmit={(e) => { e.preventDefault(); if (!onLogin(u,p)) setStatus({text:'Credenciales inválidas', type:'error'}); }} className="space-y-6 text-left">
          <input type="text" placeholder="Usuario" className="w-full bg-slate-50 p-7 rounded-[2rem] outline-none border-2 border-transparent focus:border-red-600 transition-all font-bold text-xl placeholder:text-slate-200 text-slate-950" value={u} onChange={(e) => setU(e.target.value)} />
          <input type="password" placeholder="Contraseña" className="w-full bg-slate-50 p-7 rounded-[2rem] outline-none border-2 border-transparent focus:border-red-600 transition-all font-bold text-xl placeholder:text-slate-200 text-slate-950" value={p} onChange={(e) => setP(e.target.value)} />
          <button type="submit" className="w-full bg-slate-950 text-white py-8 rounded-[2.5rem] font-black text-2xl mt-6 hover:bg-red-600 transition-all shadow-xl active:scale-95">INGRESAR</button>
        </form>
      </div>
    </div>
  );
};

export default App;