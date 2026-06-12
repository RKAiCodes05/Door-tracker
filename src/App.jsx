import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Connect securely to your Supabase cloud database using Vercel keys
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('office'); // Toggle: 'office' or 'factory'
  const [officeMobileTab, setOfficeMobileTab] = useState('Upcoming'); // Mobile filter tab
  const [isModalOpen, setIsModalOpen] = useState(false); // Mobile form popup toggle

  // Form Input States
  const [customerName, setCustomerName] = useState('');
  const [doorSpecs, setDoorSpecs] = useState('');

  // ==========================================
  // ⚡ DAY 4 LOGIC: THE DATABASE ENGINE
  // ==========================================
  
  // Load data immediately on app open and listen to the cloud live
  useEffect(() => {
    fetchOrders();

    // The Magic Switch: Realtime subscription listener
    const channel = supabase
      .channel('live-door-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders(); // Instantly update UI when database shifts
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

  // Submit new items from the Office
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

  // Factory Action: Assign worker and advance status
  const handleStartProduction = async (id) => {
    const workerName = prompt("Enter Worker Name (Handler Attribution):");
    if (!workerName) return; 

    await supabase
      .from('orders')
      .update({ status: 'In Progress', handler_name: workerName })
      .eq('id', id);
  };

  // Factory Action: Mark Completed
  const handleMarkReady = async (id) => {
    await supabase
      .from('orders')
      .update({ status: 'Ready to Dispatch' })
      .eq('id', id);
  };

  // 💾 LOCAL EXCEL/CSV DATA BACKUP GENERATOR
  const downloadBackupCSV = () => {
    if (orders.length === 0) return alert("No history found to download.");
    
    const headers = ["Order ID", "Customer Name", "Door Specifications", "Current Status", "Handler Name", "Logged Date"];
    const csvRows = [headers.join(",")];

    orders.forEach(order => {
      const row = [
        order.id,
        `"${order.customer_name.replace(/"/g, '""')}"`,
        `"${order.door_specs.replace(/"/g, '""')}"`,
        order.status,
        order.handler_name ? `"${order.handler_name.replace(/"/g, '""')}"` : "None",
        order.created_at
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", encodedUri);
    downloadLink.setAttribute("download", `DoorTracker_Backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* GLOBAL APPLICATION CONTAINER CONTROL */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 bg-emerald-500 rounded-full animate-pulse" />
            <h1 className="text-xl font-bold tracking-wider text-white">DOOR TRACKER LIVE</h1>
          </div>
          
          {/* Quick Switching Station for Office and Workshop */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button 
              onClick={() => setViewMode('office')}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'office' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🏢 Office View
            </button>
            <button 
              onClick={() => setViewMode('factory')}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'factory' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              🏭 Factory View
            </button>
          </div>
        </div>
      </header>

      {/* ======================================= */}
      {/* 🎨 DAY 3 LOGIC: THE RESPONSIVE VISUAL ENGINE */}
      {/* ======================================= */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 pb-28">
        
        {/* OFFICE MODE DASHBOARD */}
        {viewMode === 'office' && (
          <div className="animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-white">Order Pipeline Monitor</h2>
                <p className="text-xs text-slate-500 mt-0.5">Realtime sync with production floor</p>
              </div>
              <button 
                onClick={downloadBackupCSV}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition active:scale-95"
              >
                💾 Save Backup to Device (.CSV)
              </button>
            </div>

            {/* DESKTOP UI: 3-Column Horizontal Kanban Board */}
            <div className="hidden md:grid grid-cols-3 gap-6">
              {['Upcoming', 'In Progress', 'Ready to Dispatch'].map((statusKey) => (
                <div key={statusKey} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 min-h-[550px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h3 className={`font-black text-sm uppercase tracking-widest ${statusKey === 'Ready to Dispatch' ? 'text-emerald-400' : statusKey === 'In Progress' ? 'text-amber-400' : 'text-indigo-400'}`}>
                      {statusKey}
                    </h3>
                    <span className="bg-slate-900 border border-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {orders.filter(o => o.status === statusKey).length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {orders.filter(o => o.status === statusKey).map(order => (
                      <div key={order.id} className="bg-slate-900 border border-slate-800/60 rounded-xl p-4 shadow-xl hover:border-slate-700 transition duration-150">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded">#00{order.id}</span>
                          {order.handler_name && <span className="text-xs bg-amber-950/40 text-amber-400 px-2 py-0.5 rounded border border-amber-900/30">👷 {order.handler_name}</span>}
                        </div>
                        <h4 className="font-extrabold text-slate-200 text-base">{order.customer_name}</h4>
                        <p className="text-sm text-slate-400 mt-1.5 font-mono whitespace-pre-line bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">{order.door_specs}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* MOBILE OFFICE UI: Sliding Single Tab Filter Row */}
            <div className="md:hidden">
              <div className="flex bg-slate-900 rounded-xl border border-slate-800 p-1 mb-6">
                {['Upcoming', 'In Progress', 'Ready to Dispatch'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setOfficeMobileTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-black rounded-lg transition uppercase tracking-wide ${officeMobileTab === tab ? 'bg-slate-800 text-white shadow border border-slate-700' : 'text-slate-400'}`}
                  >
                    {tab.split(' ')[0]} ({orders.filter(o => o.status === tab).length})
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {orders.filter(o => o.status === officeMobileTab).map(order => (
                  <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded">#00{order.id}</span>
                      {order.handler_name && <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">👷 {order.handler_name}</span>}
                    </div>
                    <h4 className="font-bold text-slate-200 text-base">{order.customer_name}</h4>
                    <p className="text-sm text-slate-400 mt-1 font-mono whitespace-pre-line bg-slate-950/20 p-2 rounded">{order.door_specs}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Touch Trigger Target Floating Plus Action Button */}
            <div className="fixed bottom-6 right-6 z-50 md:hidden">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="h-14 w-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-3xl font-light shadow-2xl active:scale-90 transition transform"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* FACTORY MODE TASK VIEW SHEET */}
        {viewMode === 'factory' && (
          <div className="animate-in fade-in duration-200 space-y-4">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Workshop Task Routing Sheet</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tap assignments to change tracking states instantly</p>
            </div>
            
            {orders.filter(o => o.status !== 'Ready to Dispatch').map(order => (
              <div key={order.id} className={`border rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${order.status === 'In Progress' ? 'bg-amber-950/10 border-amber-700/50' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">JOB #00{order.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-black uppercase tracking-wider ${order.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                      {order.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{order.customer_name}</h3>
                  <p className="text-base text-slate-200 mt-2 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono whitespace-pre-line tracking-wide leading-relaxed">
                    {order.door_specs}
                  </p>
                  {order.handler_name && (
                    <div className="text-sm text-amber-400 font-bold mt-3 flex items-center gap-1">
                      🔨 Current Builder Assigned: {order.handler_name}
                    </div>
                  )}
                </div>

                <div className="w-full md:w-auto flex items-center justify-end">
                  {order.status === 'Upcoming' ? (
                    <button
                      onClick={() => handleStartProduction(order.id)}
                      className="w-full md:w-44 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition active:scale-95 uppercase tracking-wider text-sm"
                    >
                      🚀 Start Work
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      className="w-full md:w-44 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition active:scale-95 uppercase tracking-wider text-sm animate-pulse"
                    >
                      ✅ Mark Ready
                    </button>
                  )}
                </div>
              </div>
            ))}

            {orders.filter(o => o.status !== 'Ready to Dispatch').length === 0 && (
              <p className="text-center text-slate-500 py-16 font-mono text-sm border-2 border-dashed border-slate-800 rounded-2xl">
                No open active tasks remaining on the shop floor.
              </p>
            )}
          </div>
        )}

      </main>

      {/* POPUP MODAL DIALOG CONTAINER FOR ADDING ORDERS */}
      {((viewMode === 'office' && isModalOpen) || (viewMode === 'office' && !isModalOpen)) && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm p-4 z-50 flex items-center justify-center ${isModalOpen ? 'flex' : 'hidden md:flex md:static md:bg-transparent md:backdrop-blur-none md:p-0 md:z-0 md:mb-12'}`}>
          <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl ${isModalOpen ? 'block' : 'hidden md:block md:max-w-7xl md:mx-auto'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-200">Log New Custom Order Slip</h3>
              {isModalOpen && <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-lg hover:text-white">✕</button>}
            </div>
            <form onSubmit={handleCreateOrder} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Client Identity</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., Apex Builders Ltd"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Door Architecture Specs</label>
                  <textarea 
                    rows="2"
                    value={doorSpecs} 
                    onChange={(e) => setDoorSpecs(e.target.value)}
                    placeholder="Dimensions: 80x32, Wood: Pine Wood, Trim: Flush Finish"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-mono focus:outline-none focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-800/60 pt-4">
                <button type="submit" className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-lg">
                  Deploy to Factory Operations Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
