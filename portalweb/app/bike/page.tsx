'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, Radio, Battery, Zap, AlertTriangle, 
  RefreshCw, Terminal, Eye, Skull, Globe
} from 'lucide-react';
import TacticalMap from '@/components/TacticalMap';
import StatusCard from '@/components/StatusCard';
import { TelemetryData, Alert } from '@/types';
import { getTacticalAnalysis } from '@/services/gemini';
import { formatRelativeTime } from '@/lib/utils';

const App: React.FC = () => {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [tacticalAdvice, setTacticalAdvice] = useState<string>("");
  
  // Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    latitude: 10.001260,
    longitude: 76.282927,
    speedKmh: 0,
    batteryVoltage: 52.4,
    satellites: 5,
    lastUpdate: 'Just now',
    status: 'ACTIVE'
  });
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/bike/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      
      if (data.bike) {
        setTelemetry({
          latitude: data.bike.latitude,
          longitude: data.bike.longitude,
          speedKmh: data.bike.speed || 0,
          batteryVoltage: data.bike.battery_mv ? (data.bike.battery_mv / 1000) : 52.4,
          satellites: data.bike.satellites || 0,
          lastUpdate: formatRelativeTime(data.bike.timestamp),
          status: 'ACTIVE'
        });
      }
    } catch (err: any) {
      console.error('Error fetching bike status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8095';
      const response = await fetch(
        `${pbUrl}/api/collections/alerts/records?sort=-timestamp&filter=type = "bike_distance"&perPage=10`
      );
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      
      const formattedAlerts: Alert[] = (data.items || []).map((item: any) => ({
        id: item.id,
        severity: 'medium' as const,
        message: item.message,
        timestamp: item.timestamp || item.created
      }));
      
      setAlerts(formattedAlerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const handleTacticalAnalysis = async () => {
    setIsAnalysing(true);
    setTacticalAdvice("ENCRYPTING CHANNEL... CONTACTING CONSIGLIERE...");
    try {
      const advice = await getTacticalAnalysis(telemetry, "Pachalam District");
      setTacticalAdvice(advice);
    } catch (e) {
      setTacticalAdvice("CONNECTION SEVERED.");
    } finally {
      setIsAnalysing(false);
    }
  };

  // Simulate live updates
  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchAlerts();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blood shadow-[0_0_20px_rgba(138,3,3,0.5)]"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-serif drop-shadow-lg flex items-center gap-3">
            <span className="text-blood text-4xl">»</span> Asset Tracker: Ghost Rider
          </h2>
          <p className="text-gray-500 font-mono text-sm mt-1 max-w-2xl">
            Real-time telemetry and surveillance of high-value mobile assets. 
            Unauthorized access will trigger countermeasures.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleTacticalAnalysis}
            className="group relative px-6 py-2 bg-black border border-gold/50 text-gold font-mono text-sm uppercase overflow-hidden transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            <div className="absolute inset-0 w-full h-full bg-gold/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
            <span className="relative flex items-center gap-2">
              {isAnalysing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Ask The Don
            </span>
          </button>
        </div>
      </div>

      {/* Gemini Intel Feed */}
      {tacticalAdvice && (
        <div className="mb-8 border-l-4 border-gold bg-gradient-to-r from-gray-900 to-black p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Skull className="w-32 h-32" />
          </div>
          <h3 className="text-gold font-mono text-xs uppercase tracking-[0.3em] mb-2">Consigliere Direct Line</h3>
          <p className="text-lg text-gray-200 font-serif leading-relaxed relative z-10">
            "{tacticalAdvice}"
          </p>
        </div>
      )}

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Configuration (Home Location) */}
        <div className="lg:col-span-3 xl:col-span-3 bg-charcoal/50 border border-gray-800 p-1 relative group">
          {/* Decorative corners */}
          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blood"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blood"></div>
          <div className="bg-black/80 p-6 backdrop-blur-sm">
            <h3 className="text-blood font-mono uppercase tracking-widest text-sm mb-6 border-b border-gray-800 pb-2 flex justify-between">
              <span>Base of Operations</span>
              <span className="text-gray-600">SECURE_LVL_5</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-gray-500 text-[10px] uppercase font-mono">Safehouse Designation</label>
                  <select className="w-full bg-gray-900 border border-gray-700 text-gray-300 p-3 font-mono focus:border-blood focus:ring-1 focus:ring-blood outline-none transition-colors">
                    <option>Safehouse Alpha (Home)</option>
                    <option>The Warehouse (Work)</option>
                    <option>The Docks (Storage)</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-gray-500 text-[10px] uppercase font-mono">Latitude</label>
                    <input 
                      type="text" 
                      value={telemetry.latitude.toFixed(6)} 
                      readOnly
                      className="w-full bg-gray-900 border border-gray-700 text-blood p-3 font-mono focus:border-blood outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-500 text-[10px] uppercase font-mono">Longitude</label>
                    <input 
                      type="text" 
                      value={telemetry.longitude.toFixed(6)} 
                      readOnly
                      className="w-full bg-gray-900 border border-gray-700 text-blood p-3 font-mono focus:border-blood outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end space-y-3">
                <div className="p-3 bg-gray-900/50 border border-gray-800 rounded text-xs font-mono text-gray-500">
                  CURRENT VECTOR LOCK: <span className="text-cyan-500">{telemetry.latitude.toFixed(6)}, {telemetry.longitude.toFixed(6)}</span>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-transparent border border-gray-600 text-gray-400 font-mono text-xs hover:border-white hover:text-white transition-all uppercase">
                     Ping Current
                  </button>
                  <button className="flex-1 py-3 bg-blood hover:bg-red-900 text-white font-mono text-xs shadow-[0_0_15px_rgba(138,3,3,0.4)] transition-all uppercase font-bold">
                     Update Coordinates
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Map */}
        <div className="lg:col-span-2 space-y-8">
          {/* Map Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gold text-xs font-mono uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4" /> Real-time Surveillance
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                <span className="text-[10px] text-red-500 font-mono">LIVE FEED ACTIVE</span>
              </div>
            </div>
            <TacticalMap lat={telemetry.latitude} lng={telemetry.longitude} />
          </div>
        </div>

        {/* Right Column: Status & Alerts */}
        <div className="space-y-6">
          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatusCard 
              label="Velocity" 
              value={telemetry.speedKmh} 
              unit="km/h" 
              icon={<Activity className="w-5 h-5" />}
              trend={telemetry.speedKmh > 0 ? 'up' : 'stable'}
            />
            <StatusCard 
              label="Power Core" 
              value={telemetry.batteryVoltage.toFixed(1)} 
              unit="V" 
              icon={<Battery className="w-5 h-5" />}
              critical={telemetry.batteryVoltage < 48}
              trend="down"
            />
            <StatusCard 
              label="Sat Link" 
              value={telemetry.satellites} 
              icon={<Radio className="w-5 h-5" />}
              trend="stable"
            />
            <StatusCard 
              label="Last Ping" 
              value="NOW" 
              icon={<Zap className="w-5 h-5" />}
            />
          </div>

          {/* Alerts Panel */}
          <div className="bg-black border border-gray-800 shadow-lg overflow-hidden">
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-blood text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Threat Detection
              </h3>
              <span className="text-[10px] bg-blood/20 text-blood px-2 py-0.5 rounded border border-blood/30">
                LEVEL 3
              </span>
            </div>
            <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
              {alerts.length > 0 ? (
                alerts.map(alert => (
                  <div key={alert.id} className="p-4 hover:bg-gray-900/50 transition-colors flex items-start gap-3 group cursor-pointer">
                    <div className={`w-1.5 h-1.5 mt-2 rounded-full flex-shrink-0 ${alert.severity === 'high' ? 'bg-blood shadow-[0_0_8px_red]' : 'bg-gold'}`}></div>
                    <div>
                      <p className="text-xs text-gray-300 font-mono group-hover:text-white transition-colors">{alert.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1 font-mono">{formatRelativeTime(alert.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 hover:bg-gray-900/50 transition-colors flex items-start gap-3 group opacity-50">
                  <div className="w-1.5 h-1.5 mt-2 rounded-full flex-shrink-0 bg-gray-600"></div>
                  <div>
                    <p className="text-xs text-gray-300 font-mono">SYSTEM DIAGNOSTIC COMPLETE</p>
                    <p className="text-[10px] text-gray-600 mt-1 font-mono">08:00</p>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-900/50 p-2 border-t border-gray-800">
              <button className="w-full text-center text-[10px] font-mono text-gray-500 hover:text-gold uppercase transition-colors">
                View Full Security Log
              </button>
            </div>
          </div>

          {/* Terminal / Logs */}
          <div className="bg-black p-4 border border-gray-800 font-mono text-xs text-terminal h-48 overflow-hidden relative">
            <div className="absolute top-2 right-2 opacity-50"><Terminal className="w-4 h-4" /></div>
            <div className="space-y-1 opacity-80">
              <p>&gt; INIT_SECURE_PROTOCOL_V9</p>
              <p>&gt; CONNECTING_TO_DARK_NODE...</p>
              <p className="text-gold">&gt; SUCCESS. TUNNEL ESTABLISHED.</p>
              <p>&gt; MONITORING_ASSET_ID: GHOST_RIDER</p>
              <p>&gt; LAT_DELTA: 0.000000</p>
              <p>&gt; LNG_DELTA: 0.000000</p>
              <p className="animate-pulse">&gt; AWAITING_INPUT_</p>
            </div>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,255,0,0.06))] z-10 bg-[length:100%_4px,6px_100%]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;






