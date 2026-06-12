import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('office'); // 'office' or 'factory'
  const [officeMobileTab, setOfficeMobileTab] = useState('Upcoming'); 
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [showAnalytics, setShowAnalytics] = useState(false); // Toggle analytics grid

  // Search, Filtering & Sorting Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'company'

  // Form Input States
  const [customerName, setCustomerName] = useState('');
  const [doorSpecs, setDoorSpecs] = useState('');

  // Internal Toast Alerts System State
  const [toasts, setToasts] = useState([]);

  // Trigger Local UI Alert and Desktop Ping
  const triggerNotification = (title, message) => {
    // 1. Add to internal UI alert stream
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);

    // 2. Fire HTML5 system push notification if allowed
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/favicon.ico' });
    }
  };

  // Request browser permission for system pings on launch
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch Database Objects and Hook Realtime Stream Channels
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('live-factory-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          fetchOrders(); // Force reload state matrix
          
          // Route notification conditions dynamically based on event types
          if (payload.eventType === 'INSERT') {
            triggerNotification(
              "📦 New Order Logged", 
              `${payload.new.customer_name} added: "${payload.new.door_specs}"`
            );
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'Ready to Dispatch' && payload.old.status !== 'Ready to Dispatch') {
              triggerNotification(
                "✅ Production Complete", 
                `Order #00${payload.new.id} (${payload.new.customer_name}) is ready for dispatch!`
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false });
    if (!error && data) setOrders(data);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!customerName || !doorSpecs) return;

    const { error } = await supabase.from('orders').insert([
      { customer_name: customerName, door_specs: doorSpecs, status: 'Upcoming' }
    ]);

    if (!error) {
      setCustomerName('');
      setDoorSpecs('');
      setIsModalOpen(false);
    }
  };

  // 🗑️ OFFICE FEATURE: Wipe incorrect data rows immediately 
  const handleDeleteOrder = async (id, client) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete the order for "${client}"? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) {
      triggerNotification("🗑️ Row Terminated", `Order #00${id} was deleted by the office.`);
    }
  };

  const handleStartProduction = async (id) => {
    const workerName = prompt("Enter Builder Name:");
    if (!workerName) return; 

    await supabase
      .from('orders')
      .update({ status: 'In Progress', handler_name: workerName })
      .eq('id', id);
  };

  const handleMarkReady = async (id) => {
    await supabase
      .from('orders')
      .update({ status: 'Ready to Dispatch' })
      .eq('id', id);
  };

  // ==========================================
  // 📊 LOGIC EXTENSION: DIMENSIONAL OPTIMIZATION MATRIX
  // ==========================================
  const getAggregatedMatrix = () => {
    const matrix = {};
    orders.forEach(order => {
      // Normalize casing and string spaces to match duplicates accurately
      const normalizedSpecs = order.door_specs.trim().toLowerCase();
      if (!matrix[normalizedSpecs]) {
        matrix[normalizedSpecs] = {
          rawSpecs: order.door_specs,
          count: 0,
          companies: new Set(),
          items: []
        };
      }
      matrix[normalizedSpecs].count += 1;
      matrix[normalizedSpecs].companies.add(order.customer_name);
      matrix[normalizedSpecs].items.push(order);
    });
    return Object.values(matrix).order ? Object.values(matrix) : Object.values(matrix).sort((a,b) => b.count - a.count);
  };

  // Processing Local Sorting and Search Filters
  const filteredAndSortedOrders = orders
    .filter(order => {
      const matchText = `${order.customer_name} ${order.door_specs} #00${order.id}`.toLowerCase();
      return matchText.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'oldest') return a.id - b.id;
      if (sortBy === 'company') return a.customer_name.localeCompare(b.customer_name);
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      
      {/* NATIVE TOAST ALERT CONTROLLER VIEW */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-slate-900/95 text-white border border-indigo-500/40 p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex flex-col gap-0.5">
            <span className="text-sm font-black text-indigo-400 uppercase tracking-wide">{toast.title}</span>
            <span className="text-xs text-slate-300">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* FIXED APPLICATION NAVBAR CONTAINER */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 bg-indigo-500 rounded-full animate-ping" />
            <h1 className="text-lg font-black tracking-wider text-slate-100">DOOR TRACKER CONTROL HUB</h1>
          </div>
          
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button 
              onClick={() => setViewMode('office')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${viewMode === 'office' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}
            >
              🏢 Administration
            </button>
            <button 
              onClick={() => setViewMode('factory')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${viewMode === 'factory' ? 'bg-amber-600 text-white shadow' : 'text-slate-400'}`}
            >
              🏭 Factory Floor
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-28">
        
        {/* OFFICE MANAGEMENT AREA CONTAINER */}
        {viewMode === 'office' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            {/* CONTROL BAR: Search, Sort and Layout Alternators */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row justify-between gap-4 shadow-md">
              <div className="flex flex-col md:flex-row gap-3 flex-1">
                <input 
                  type="text"
                  placeholder="🔍 Search client, dimension data or Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 flex-1 transition"
                />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-300 transition"
                >
                  <option value="newest">⏱️ Date Added: Newest</option>
                  <option value="oldest">⏱️ Date Added: Oldest</option>
                  <option value="company">🏢 Sort by Client Name</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition ${showAnalytics ? 'bg-indigo-950 border-indigo-500 text-indigo-300 shadow-inner' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                >
                  📊 {showAnalytics ? "Hide Dimension Summary" : "View Dimension Summary"}
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs rounded-xl uppercase tracking-wider shadow text-white transition"
                >
                  ➕ Create Order Form
                </button>
              </div>
            </div>

            {/* ==========================================
                📊 EXTENSION VIEW: OPTIMIZATION ANALYTICS GRID
                ========================================== */}
            {showAnalytics && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-200">
                <h3 className="text-base font-black tracking-wide text-white mb-1 uppercase">Batch Manufacturing Summary Matrix</h3>
                <p className="text-xs text-slate-500 mb-4">Orders clustered by identical structural profile sizes automatically to optimize lumber cut setups.</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Cluster Specifications</th>
                        <th className="py-3 px-4 text-center">Volume Pending</th>
                        <th className="py-3 px-4">Associated Client Groups</th>
                        <th className="py-3 px-4">Timeline Footprints (Date & Time Logged)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {getAggregatedMatrix().map((group, idx) => (
                        <tr key={idx} className="hover:bg-slate-950/40 transition">
                          <td className="py-3 px-4 font-bold text-indigo-400 whitespace-pre-line">{group.rawSpecs}</td>
                          <td className="py-3 px-4 text-center"><span className="bg-indigo-950 border border-indigo-900/60 text-indigo-400 text-xs px-3 py-1 rounded-full font-bold">{group.count} doors</span></td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{Array.from(group.companies).join(", ")}</td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] leading-relaxed">
                            {group.items.map(item => (
                              <div key={item.id}>• ID #{item.id} — {new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PIPELINE ARCHITECTURE CARD COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Upcoming', 'In Progress', 'Ready to Dispatch'].map((statusKey) => (
                <div key={statusKey} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 min-h-[500px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h3 className={`font-black text-xs uppercase tracking-widest ${statusKey === 'Ready to Dispatch' ? 'text-emerald-400' : statusKey === 'In Progress' ? 'text-amber-400' : 'text-indigo-400'}`}>
                      {statusKey}
                    </h3>
                    <span className="bg-slate-950 border border-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {filteredAndSortedOrders.filter(o => o.status === statusKey).length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {filteredAndSortedOrders.filter(o => o.status === statusKey).map(order => (
                      <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl hover:border-slate-700 group relative transition duration-150">
                        
                        {/* 🗑️ ERASE TARGET ROW ACTION HOOK ACTION */}
                        <button 
                          onClick={() => handleDeleteOrder(order.id, order.customer_name)}
                          className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition duration-150 focus:opacity-100"
                          title="Delete this order profile"
                        >
                          🗑️
                        </button>

                        <div className="flex flex-col gap-0.5 mb-2">
                          <span className="text-[10px] font-mono font-bold text-indigo-400">ORDER #00{order.id}</span>
                          <span className="text-[10px] text-slate-500 font-mono">⏱️ {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>

                        <h4 className="font-extrabold text-slate-200 text-base tracking-wide">{order.customer_name}</h4>
                        <p className="text-sm text-slate-400 mt-2 font-mono whitespace-pre-line bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">{order.door_specs}</p>
                        
                        {order.handler_name && (
                          <div className="text-[11px] text-amber-400 font-bold mt-2.5 flex items-center gap-1 bg-amber-950/20 px-2 py-1 rounded border border-amber-900/30 w-max">
                            👷 Builder: {order.handler_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FACTORY OPERATIONS TRACK SHEET VIEW */}
        {viewMode === 'factory' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h2 className="text-xl font-black text-slate-200 uppercase tracking-wide">Active Work Stations</h2>
              <p className="text-xs text-slate-500">Real-time build routing queues on production assets</p>
            </div>
            
            {orders.filter(o => o.status !== 'Ready to Dispatch').map(order => (
              <div key={order.id} className={`border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${order.status === 'In Progress' ? 'bg-amber-950/10 border-amber-700/40' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">TICKET #00{order.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wider uppercase ${order.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide">{order.customer_name}</h3>
                  <p className="text-base text-slate-100 mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono whitespace-pre-line tracking-wider leading-relaxed">
                    {order.door_specs}
                  </p>
                  {order.handler_name && (
                    <div className="text-xs text-amber-400 font-bold mt-3 uppercase tracking-wider">
                      🛠️ Builder Claimed: {order.handler_name}
                    </div>
                  )}
                </div>

                <div className="w-full md:w-auto flex items-center justify-end">
                  {order.status === 'Upcoming' ? (
                    <button
                      onClick={() => handleStartProduction(order.id)}
                      className="w-full md:w-44 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition shadow active:scale-95"
                    >
                      🚀 Claim Task
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      className="w-full md:w-44 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition shadow active:scale-95 animate-pulse"
                    >
                      ✅ Declare Complete
                    </button>
                  )}
                </div>
              </div>
            ))}

            {orders.filter(o => o.status !== 'Ready to Dispatch').length === 0 && (
              <p className="text-center text-slate-500 py-16 font-mono text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                No active build operations items mapped into workshop arrays.
              </p>
            )}
          </div>
        )}

      </main>

      {/* NEW SLIP REGISTRATION MODAL PANEL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm p-4 z-50 flex items-center justify-center animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Register Custom Assembly Ticket</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-sm hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Client Profile Identity</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., Ganesh Enterprise"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Dimensional Blueprints</label>
                <textarea 
                  rows="3"
                  value={doorSpecs} 
                  onChange={(e) => setDoorSpecs(e.target.value)}
                  placeholder="e.g., 80X32, teak polish"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-mono focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-slate-400">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition">
                  Transmit Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
