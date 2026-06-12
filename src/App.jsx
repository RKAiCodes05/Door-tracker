import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('office'); // 'office' or 'factory'
  const [mobileTab, setMobileTab] = useState('Upcoming'); 
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [showSummary, setShowSummary] = useState(false); 

  // Simple Filtering & Search States
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Input Box States
  const [customerName, setCustomerName] = useState('');
  const [doorSpecs, setDoorSpecs] = useState('');
  const [toasts, setToasts] = useState([]);

  // 🛡️ MOBILE-SAFE ALERT ENGINE
  const alertUser = (title, msg) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);

    // Only fire if the browser/phone actually supports native notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: msg });
    }
  };

  useEffect(() => {
    // Safety check to prevent mobile crashes on window load
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    fetchOrders();

    // Live Database Listener
    const channel = supabase
      .channel('factory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          alertUser("New Order Added 🎯", `${payload.new.customer_name} added a new order.`);
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'Ready to Dispatch') {
          alertUser("Order Completed! ✅", `${payload.new.customer_name}'s door is ready for delivery.`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('id', { ascending: false });
    if (!error && data) setOrders(data);
  };

  const handleAddOrder = async (e) => {
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

  const handleDeleteOrder = async (id, name) => {
    if (!window.confirm(`Delete order for "${name}" permanently from the database?`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) alertUser("Order Deleted 🗑️", `Order #${id} was permanently removed.`);
  };

  const handleUpdateStatus = async (id, nextStatus) => {
    let updateData = { status: nextStatus };
    if (nextStatus === 'In Progress') {
      const worker = prompt("Enter Worker Name:");
      if (!worker) return;
      updateData.handler_name = worker;
    }
    await supabase.from('orders').update(updateData).eq('id', id);
  };

  const getGroupedDimensions = () => {
    const groups = {};
    orders.forEach(o => {
      const sizeKey = o.door_specs.trim().toLowerCase();
      if (!groups[sizeKey]) {
        groups[sizeKey] = { originalText: o.door_specs, total: 0, customers: new Set(), timestamps: [] };
      }
      groups[sizeKey].total += 1;
      groups[sizeKey].customers.add(o.customer_name);
      groups[sizeKey].timestamps.push({ id: o.id, date: new Date(o.created_at).toLocaleString() });
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  };

  const processedOrders = orders
    .filter(o => `${o.customer_name} ${o.door_specs} #${o.id}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'oldest') return a.id - b.id;
      if (sortBy === 'client') return a.customer_name.localeCompare(b.customer_name);
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      
      {/* 🔔 FLOATING ALERT BOXES */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 border-2 border-blue-500 p-4 rounded-xl shadow-2xl backdrop-blur pointer-events-auto animate-in fade-in slide-in-from-top-2">
            <h5 className="font-bold text-blue-400 text-sm">{t.title}</h5>
            <p className="text-xs text-slate-300 mt-0.5">{t.msg}</p>
          </div>
        ))}
      </div>

      {/* TOP CONTROL HEAD PANEL */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
            <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse" />
            DOOR WORKFLOW SYSTEM
          </h1>
          
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button onClick={() => setViewMode('office')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold uppercase transition ${viewMode === 'office' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>🏢 Office Dashboard</button>
            <button onClick={() => setViewMode('factory')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold uppercase transition ${viewMode === 'factory' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>      🏭 Factory Tasks</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        
        {/* ======================================= */}
        {/* 🏢 VIEW ENGINE: OFFICE ADMIN PANEL      */}
        {/* ======================================= */}
        {viewMode === 'office' && (
          <div className="space-y-6">
            
            {/* SEARCH AND CONTROL TOOLBAR */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <input 
                  type="text" 
                  placeholder="🔍 Search by customer name, size, or ID..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1 text-slate-200"
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-300">
                  <option value="newest">⏱️ Sort: Newest First</option>
                  <option value="oldest">⏱️ Sort: Oldest First</option>
                  <option value="client">🏢 Sort: Customer Name</option>
                </select>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setShowSummary(!showSummary)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition ${showSummary ? 'bg-blue-950/40 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>📊 {showSummary ? "Hide Size Summary" : "Show Size Summary"}</button>
                <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow">➕ Add New Order</button>
              </div>
            </div>

            {/* 📊 BATCHING OPTIMIZATION SUB-GRID */}
            {showSummary && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-150">
                <h3 className="text-sm font-black text-white uppercase mb-1">Identical Sizes Optimization List</h3>
                <p className="text-xs text-slate-500 mb-4">Groups orders with identical measurements automatically to help batch lumber production cutting schedules.</p>
                <div className="space-y-3">
                  {getGroupedDimensions().map((group, i) => (
                    <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <span className="text-sm font-bold text-blue-400 block font-mono">{group.originalText}</span>
                        <span className="text-xs text-slate-400 mt-1 block">Customers: <span className="text-slate-200">{Array.from(group.customers).join(', ')}</span></span>
                      </div>
                      <div className="text-left sm:text-right flex sm:flex-col justify-between items-center sm:items-end gap-2 border-t border-slate-800 pt-2 sm:border-0 sm:pt-0">
                        <span className="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full font-bold border border-blue-500/20">{group.total} Orders Total</span>
                        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
                          {group.timestamps.map(t => <div key={t.id}>ID #{t.id} added on {t.date}</div>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DESKTOP WORKSPACE LAYOUT (3 Columns Grid) */}
            <div className="hidden md:grid grid-cols-3 gap-6">
              {['Upcoming', 'In Progress', 'Ready to Dispatch'].map(status => (
                <div key={status} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 min-h-[450px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
                    <h3 className={`font-black text-xs uppercase tracking-wider ${status === 'Ready to Dispatch' ? 'text-emerald-400' : status === 'In Progress' ? 'text-amber-400' : 'text-blue-400'}`}>{status === 'Upcoming' ? 'Waiting' : status}</h3>
                    <span className="bg-slate-950 text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{processedOrders.filter(o => o.status === status).length}</span>
                  </div>
                  <div className="space-y-3">
                    {processedOrders.filter(o => o.status === status).map(order => (
                      <div key={order.id} className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 group relative hover:border-slate-700 transition">
                        <button onClick={() => handleDeleteOrder(order.id, order.customer_name)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs transition">🗑️ Delete</button>
                        <div className="text-[10px] text-slate-500 font-mono">ID #00{order.id} • {new Date(order.created_at).toLocaleDateString()}</div>
                        <h4 className="font-extrabold text-white text-base mt-1">{order.customer_name}</h4>
                        <p className="text-sm text-slate-300 mt-1.5 font-mono bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-line">{order.door_specs}</p>
                        {order.handler_name && <span className="inline-block text-[11px] text-amber-400 font-bold mt-2 bg-amber-500/10 px-2 py-0.5 rounded">👷 Worker: {order.handler_name}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* MOBILE WORKSPACE LAYOUT (Tab Filters Stack) */}
            <div className="md:hidden">
              <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1 mb-4">
                {['Upcoming', 'In Progress', 'Ready to Dispatch'].map(tab => (
                  <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mobileTab === tab ? 'bg-slate-800 text-white shadow' : 'text-slate-400'}`}>
                    {tab === 'Upcoming' ? 'Waiting' : tab.split(' ')[0]} ({processedOrders.filter(o => o.status === tab).length})
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {processedOrders.filter(o => o.status === mobileTab).map(order => (
                  <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs font-mono text-slate-500">ID #00{order.id}</span>
                      <button onClick={() => handleDeleteOrder(order.id, order.customer_name)} className="text-xs text-rose-400 font-bold px-2 py-1 bg-rose-500/10 rounded">🗑️ Remove</button>
                    </div>
                    <h4 className="font-bold text-white text-base">{order.customer_name}</h4>
                    <p className="text-sm text-slate-300 font-mono bg-slate-950 p-3 rounded border border-slate-800 whitespace-pre-line">{order.door_specs}</p>
                    {order.handler_name && <span className="text-xs text-amber-400 font-bold">👷 Worker: {order.handler_name}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* 🏭 VIEW ENGINE: FACTORY TOUCH SCREENS   */}
        {/* ======================================= */}
        {viewMode === 'factory' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-xl font-black text-white uppercase tracking-wide">Factory Assembly Line</h2>
              <p className="text-xs text-slate-500">Big layout views designed for workshop mobile screens</p>
            </div>
            
            {orders.filter(o => o.status !== 'Ready to Dispatch').map(order => (
              <div key={order.id} className={`border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shadow-xl ${order.status === 'In Progress' ? 'bg-amber-950/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">JOB #{order.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${order.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>{order.status === 'Upcoming' ? 'Waiting' : order.status}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{order.customer_name}</h3>
                  <p className="text-base text-slate-100 mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono whitespace-pre-line tracking-wide leading-relaxed">
                    {order.door_specs}
                  </p>
                  {order.handler_name && <div className="text-xs text-amber-400 font-bold mt-2 uppercase tracking-wider">🔨 Handler: {order.handler_name}</div>}
                </div>

                <div className="flex items-center justify-end">
                  {order.status === 'Upcoming' ? (
                    <button onClick={() => handleUpdateStatus(order.id, 'In Progress')} className="w-full md:w-44 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm uppercase tracking-wider shadow-lg active:scale-95 transition">🚀 Start Door making</button>
                  ) : (
                    <button onClick={() => handleUpdateStatus(order.id, 'Ready to Dispatch')} className="w-full md:w-44 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm uppercase tracking-wider shadow-lg active:scale-95 transition animate-pulse">✅ Finished</button>
                  )}
                </div>
              </div>
            ))}

            {orders.filter(o => o.status !== 'Ready to Dispatch').length === 0 && (
              <p className="text-center text-slate-500 py-16 font-mono text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">No pending build orders found inside the workshop queue.</p>
            )}
          </div>
        )}

      </main>

      {/* POPUP OVERLAY WINDOW FOR SUBMITTING ORDERS */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm p-4 z-50 flex items-center justify-center animate-in fade-in duration-100">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="text-sm font-black uppercase text-slate-200">Log New Custom Order Slip</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAddOrder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Customer / Company Name</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., Ganesh Enterprise"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Door Sizes & Description Details</label>
                <textarea 
                  rows="3"
                  value={doorSpecs} 
                  onChange={(e) => setDoorSpecs(e.target.value)}
                  placeholder="e.g., 80X32, teak polish"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-mono focus:outline-none focus:border-blue-500 transition"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-slate-400">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl transition">Add to System</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
