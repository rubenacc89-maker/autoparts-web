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
  const [stats, setStats] = useState({ totalVisits: 0, totalOrdersClicked: 0, totalCartsStarted: 0 });
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [isXLSXLoaded, setIsXLSXLoaded] = useState(false);

  // Carga dinámica de la librería XLSX para evitar errores de compilación
  useEffect(() => {
    if (window.XLSX) {
      setIsXLSXLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXLSXLoaded(true);
    document.head.appendChild(script);
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
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        setStatusMsg({ text: 'Error de conexión con la base de datos', type: 'error' });
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

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
    }, (error) => setStatusMsg({ text: 'Error al sincronizar inventario', type: 'error' }));

    const unsubStats = onSnapshot(statsRef, (s) => s.exists() && setStats(s.data()));
    return () => { unsubProds(); unsubStats(); };
  }, [user, view]);

  const addToCart = (p) => {
    setIsCartBouncing(true); setTimeout(() => setIsCartBouncing(false), 300);
    setCart(prev => {
      const id = p.id || p.code;
      const exist = prev.find(i => i.id === id);
      if (exist) return prev.map(i => i.id === id ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, id, qty: 1}];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {statusMsg.text && (
        <div className={`fixed top-0 left-0 right-0 z-[200] p-4 text-center font-bold text-white shadow-lg animate-in slide-in-from-top duration-300 ${statusMsg.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          <div className="flex items-center justify-center gap-3">
            {statusMsg.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
            {statusMsg.text}
            <button onClick={() => setStatusMsg({text:'', type:''})} className="ml-4 bg-white/20 hover:bg-white/30 p-1 rounded-md transition-colors font-black">
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-md border-b p-4 sticky top-0 z-50 flex justify-between items-center px-6 shadow-sm">
        <div onClick={() => window.location.hash = ''} className="flex items-center gap-2 cursor-pointer group">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg group-hover:rotate-6 transition-transform"><Package className="text-white" /></div>
          <span className="font-black italic uppercase text-lg tracking-tight">AUTO<span className="text-indigo-600">PARTS</span></span>
        </div>
        <button onClick={() => window.location.hash = '#/cart'} className={`p-3 rounded-2xl border bg-white relative transition-transform hover:shadow-md ${isCartBouncing ? 'scale-110' : ''}`}>
          <ShoppingCart size={20} />
          {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold ring-2 ring-white">{cart.reduce((a,b)=>a+b.qty, 0)}</span>}
        </button>
      </header>

      <main>
        {view === 'landing' && <LandingView onSearch={() => window.location.hash = '#/catalog'} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
        {view === 'catalog' && <CatalogView products={products.filter(p => `${p.name} ${p.code} ${p.model}`.toLowerCase().includes(searchTerm.toLowerCase()))} onAdd={addToCart} onBack={() => window.location.hash = ''} />}
        {view === 'admin-login' && <AdminLogin onLogin={(u, p) => u === 'admin' && p === 'AutoPrecision2024*'} onAuthSuccess={() => setIsAdminAuthenticated(true)} />}
        {view === 'admin-dashboard' && <AdminDashboard products={products} stats={stats} onLogout={() => setIsAdminAuthenticated(false)} setStatus={setStatusMsg} isReady={isXLSXLoaded} />}
        {view === 'cart' && <CartView cart={cart} setCart={setCart} />}
      </main>

      <footer className="py-20 text-center opacity-50 hover:opacity-100 transition-opacity">
        <button onClick={() => window.location.hash = '#/admin'} className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] hover:text-indigo-600 transition-colors">
          &copy; 2024 AUTOPARTS PRECISION
        </button>
      </footer>
    </div>
  );
};

const AdminDashboard = ({ products, stats, onLogout, setStatus, isReady }) => {
  const [loading, setLoading] = useState(false);

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!isReady || !window.XLSX) {
      setStatus({ text: 'Esperando a que la herramienta de Excel cargue...', type: 'error' });
      return;
    }
    
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const XLSX = window.XLSX;
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(sheet);
        
        if (rawData.length === 0) throw new Error("El archivo está vacío o no tiene el formato correcto.");

        const batch = writeBatch(db);
        let count = 0;

        rawData.forEach((row) => {
          const findKey = (names) => {
            const key = Object.keys(row).find(k => names.includes(k.toLowerCase().trim()));
            return key ? row[key] : null;
          };

          const code = String(findKey(['code', 'codigo', 'cod', 'referencia']) || '').trim();
          const name = String(findKey(['name', 'nombre', 'descripcion', 'artículo']) || '').trim();
          const priceRaw = String(findKey(['price', 'precio', 'monto', 'costo']) || '0').replace(',', '.');

          if (code && name) {
            const ref = doc(db, 'artifacts', appId, 'public', 'data', 'products', code);
            batch.set(ref, {
              code,
              name,
              brand: findKey(['brand', 'marca', 'fabricante']) || 'Genérico',
              model: findKey(['model', 'modelo', 'carro', 'aplicación']) || 'Universal',
              category: findKey(['category', 'categoria', 'tipo', 'rubro']) || 'Repuestos',
              price: parseFloat(priceRaw) || 0,
              updatedAt: serverTimestamp()
            }, { merge: true });
            count++;
          }
        });

        await batch.commit();
        setStatus({ text: `¡Éxito! Se actualizaron ${count} productos correctamente.`, type: 'success' });
      } catch (err) {
        setStatus({ text: `Error en la carga: ${err.message}`, type: 'error' });
      } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Panel <span className="text-indigo-600">Administrativo</span></h2>
        <button onClick={onLogout} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><LogOut /></button>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] border-4 border-dashed border-indigo-100 text-center mb-12 shadow-sm hover:border-indigo-300 transition-colors">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="animate-spin text-indigo-600" size={56} />
            <p className="font-black text-indigo-600 uppercase tracking-widest text-sm">Sincronizando Base de Datos...</p>
          </div>
        ) : (
          <div>
            <UploadCloud size={64} className="mx-auto text-indigo-600 mb-6" />
            <h3 className="text-2xl font-black mb-2 uppercase italic">Importar Inventario Real</h3>
            <p className="text-slate-400 font-medium mb-8 max-w-md mx-auto">Sube tu archivo Excel (.xlsx) o CSV. El sistema limpiará comas y detectará las columnas automáticamente.</p>
            {!isReady && <p className="text-amber-600 text-xs font-bold mb-4 animate-pulse uppercase">Cargando motor de Excel...</p>}
            <label className={`px-12 py-5 rounded-[2rem] font-black text-lg cursor-pointer transition-all shadow-xl inline-block ${isReady ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              Seleccionar Archivo
              <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} disabled={!isReady} />
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600 font-black text-xs uppercase mb-3"><Eye size={18}/> Visitas Totales</div>
          <p className="text-5xl font-black tracking-tighter">{stats.totalVisits || 0}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 text-emerald-600 font-black text-xs uppercase mb-3"><MessageSquare size={18}/> Consultas WhatsApp</div>
          <p className="text-5xl font-black tracking-tighter">{stats.totalOrdersClicked || 0}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
          <div className="flex items-center gap-3 text-slate-400 font-black text-xs uppercase mb-3"><Package size={18}/> Catálogo Activo</div>
          <p className="text-5xl font-black tracking-tighter">{products.length}</p>
        </div>
      </div>
    </div>
  );
};

const LandingView = ({ onSearch, searchTerm, setSearchTerm }) => (
  <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
    <div className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-10 shadow-sm flex items-center gap-2">
      <Zap size={14} className="animate-pulse" /> Valencia, Venezuela
    </div>
    <h1 className="text-6xl md:text-9xl font-black tracking-tighter italic mb-8 leading-[0.85] text-slate-900">Busca tu <br/><span className="text-indigo-600">Repuesto.</span></h1>
    <p className="text-slate-400 font-medium text-lg md:text-xl mb-14 max-w-xl mx-auto leading-relaxed">Conéctate directamente con el stock real de los mejores distribuidores de Carabobo.</p>
    <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="w-full max-w-2xl bg-white p-2 rounded-[2.5rem] shadow-2xl flex items-center border border-indigo-50 hover:border-indigo-200 transition-all">
      <Search className="ml-6 text-indigo-300" size={28} />
      <input type="text" placeholder="Ej: Amortiguador Aveo, Filtro..." className="w-full p-6 bg-transparent outline-none font-bold text-xl md:text-2xl placeholder:text-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      <button className="bg-indigo-600 text-white p-6 rounded-[2rem] hover:bg-indigo-700 transition-all shadow-xl active:scale-95"><ArrowRight strokeWidth={3}/></button>
    </form>
  </div>
);

const CatalogView = ({ products, onAdd, onBack }) => (
  <div className="p-6 max-w-6xl mx-auto pb-32 animate-in fade-in slide-in-from-bottom-8 duration-500 text-left">
    <div className="flex justify-between items-center mb-12 px-2">
      <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">Resultados</h2>
      <button onClick={onBack} className="bg-white border px-6 py-3 rounded-2xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors shadow-sm">Volver</button>
    </div>
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
          <Package size={64} className="mx-auto text-slate-200 mb-6" />
          <p className="text-slate-300 font-black text-xl uppercase tracking-widest italic">No encontramos esa pieza</p>
        </div>
      ) : products.map(p => (
        <div key={p.code} className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 flex flex-col md:grid md:grid-cols-12 justify-between items-center gap-8 hover:border-indigo-600 hover:shadow-xl transition-all shadow-sm group text-left">
          <div className="md:col-span-6 w-full text-left">
            <h4 className="text-2xl md:text-4xl font-black italic tracking-tight group-hover:text-indigo-600 transition-colors mb-4">{p.name}</h4>
            <div className="flex flex-wrap gap-3">
              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl uppercase tracking-widest">{p.category}</span>
              <span className="text-[10px] font-bold text-slate-400 border border-slate-100 px-4 py-2 rounded-xl uppercase tracking-widest bg-slate-50/50">{p.model}</span>
              <span className="text-[10px] font-mono font-bold text-slate-300 px-2 py-2">REF: {p.code}</span>
            </div>
          </div>
          <div className="md:col-span-6 w-full flex items-center justify-between md:justify-end gap-10">
            <div className="text-left md:text-right">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">{p.brand}</p>
               <span className="text-5xl md:text-6xl font-black italic tracking-tighter leading-none text-slate-900">${(p.price || 0).toFixed(2)}</span>
            </div>
            <button onClick={() => onAdd(p)} className="bg-slate-950 text-white p-6 md:p-8 rounded-full hover:bg-indigo-600 transition-all shadow-2xl active:scale-90"><Plus size={32} strokeWidth={4}/></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CartView = ({ cart, setCart }) => {
  const total = cart.reduce((a,b)=>a+(b.price*b.qty), 0);
  const handleConfirm = () => {
    const phone = "584120000000"; 
    let msg = `🚗 *NUEVO PEDIDO - AUTOPARTS PRECISION*\n\n`;
    cart.forEach(i => msg += `• *${i.name}* (Ref: ${i.code}) x${i.qty} - $${(i.price*i.qty).toFixed(2)}\n`);
    msg += `\n💰 *Total Estimado: $${total.toFixed(2)} USD*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto py-20 animate-in slide-in-from-bottom-12 text-left">
      <h2 className="text-6xl md:text-9xl font-black italic mb-16 tracking-tighter leading-none">Tu <span className="text-indigo-600 underline decoration-indigo-100 decoration-8 underline-offset-8">Cesta</span></h2>
      {cart.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
          <p className="text-slate-300 font-black text-2xl uppercase italic mb-10">Tu carrito está vacío</p>
          <button onClick={() => window.location.hash = '#/catalog'} className="bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-indigo-100 hover:scale-105 transition-all">Ir al Catálogo</button>
        </div>
      ) : (
        <div className="space-y-8">
          {cart.map(item => (
            <div key={item.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between shadow-sm group hover:border-indigo-100 transition-all text-left">
              <div className="text-left w-full">
                <h4 className="font-black text-2xl md:text-3xl italic tracking-tight">{item.name}</h4>
                <div className="flex items-center gap-6 mt-6">
                   <p className="text-indigo-600 font-black text-3xl md:text-4xl italic leading-none">${item.price.toFixed(2)}</p>
                   <div className="flex items-center bg-slate-100 rounded-2xl px-5 py-3 gap-6 border border-slate-200 shadow-inner">
                    <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: Math.max(1, i.qty-1)} : i))} className="p-1 hover:text-indigo-600 transition-colors"><Minus size={20} strokeWidth={3}/></button>
                    <span className="font-black text-2xl w-8 text-center">{item.qty}</span>
                    <button onClick={() => setCart(c => c.map(i => i.id === item.id ? {...i, qty: i.qty+1} : i))} className="p-1 hover:text-indigo-600 transition-colors"><Plus size={20} strokeWidth={3}/></button>
                   </div>
                </div>
              </div>
              <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="mt-8 md:mt-0 p-6 text-red-100 hover:text-red-500 transition-colors"><Trash2 size={32} /></button>
            </div>
          ))}
          <div className="bg-slate-950 p-14 rounded-[4rem] text-center text-white mt-16 shadow-3xl relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-500 uppercase font-black text-xs tracking-[0.5em] mb-6">Total a Consultar</p>
              <h3 className="text-7xl md:text-9xl font-black italic mb-14 tracking-tighter leading-none">${total.toFixed(2)}</h3>
              <button onClick={handleConfirm} className="w-full bg-emerald-500 py-10 rounded-[2.5rem] font-black text-3xl flex items-center justify-center gap-6 hover:bg-emerald-400 transition-all shadow-2xl active:scale-95">CONFIRMAR PEDIDO <ExternalLink size={36} strokeWidth={3}/></button>
            </div>
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all"></div>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLogin = ({ onLogin, onAuthSuccess }) => {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6 animate-in zoom-in duration-500">
      <div className="bg-white p-14 rounded-[4rem] shadow-2xl border border-indigo-50 w-full max-w-md text-center">
        <div className="bg-indigo-600 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-10 mx-auto text-white shadow-xl shadow-indigo-100"><Lock size={48} strokeWidth={2.5} /></div>
        <h2 className="text-3xl font-black uppercase mb-10 italic tracking-tighter text-slate-900">Acceso <span className="text-indigo-600">Admin</span></h2>
        <form onSubmit={(e) => { e.preventDefault(); if(onLogin(u,p)) onAuthSuccess(); else alert("Clave o usuario incorrectos"); }} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Usuario</label>
            <input type="text" placeholder="Ej: admin" className="w-full bg-slate-50 p-6 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-600 transition-all font-bold text-lg" value={u} onChange={(e) => setU(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Contraseña</label>
            <input type="password" placeholder="••••••••" className="w-full bg-slate-50 p-6 rounded-2xl outline-none border-2 border-transparent focus:border-indigo-600 transition-all font-bold text-lg" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
          <button className="w-full bg-slate-950 text-white py-6 rounded-[2.5rem] font-black text-2xl mt-4 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95">INGRESAR</button>
        </form>
      </div>
    </div>
  );
};

export default App;