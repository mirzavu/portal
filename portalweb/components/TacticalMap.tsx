import React from 'react';
import { Crosshair, MapPin, Navigation } from 'lucide-react';

interface TacticalMapProps {
  lat: number;
  lng: number;
}

const TacticalMap: React.FC<TacticalMapProps> = ({ lat, lng }) => {
  return (
    <div className="relative w-full h-96 bg-gray-900 rounded-lg overflow-hidden border border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] group">
      {/* Map Background (Dark Styled) */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-luminosity"
        style={{
          backgroundImage: `url('https://picsum.photos/1200/800?grayscale&blur=2')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:40px_40px] [background-image:radial-gradient(rgba(50,50,50,0.3)_1px,transparent_1px)]"></div>
      {/* Radar Scan Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <div className="w-full h-full border-t-2 border-blood/50 shadow-[0_0_20px_#8a0303] animate-scan opacity-30"></div>
      </div>
      {/* Center Target */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="relative">
          <div className="absolute w-24 h-24 border border-gold/30 rounded-full animate-ping"></div>
          <div className="absolute w-48 h-48 border border-blood/20 rounded-full animate-pulse"></div>
          <MapPin className="text-blood w-8 h-8 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]" />
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 px-2 py-1 text-[10px] text-gold font-mono border border-gold/30">
            LAT: {lat.toFixed(6)} | LNG: {lng.toFixed(6)}
          </div>
        </div>
      </div>

      {/* HUD Elements */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm p-2 border-l-2 border-gold">
        <h3 className="text-gold text-xs font-mono uppercase tracking-widest">Sector Analysis</h3>
        <p className="text-gray-400 text-[10px] font-mono mt-1">ZONE: PACHALAM // DANGER LEVEL: MODERATE</p>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
         <button className="p-2 bg-black/80 border border-gray-700 hover:border-gold text-white transition-colors">
            <Crosshair className="w-5 h-5" />
         </button>
         <button className="p-2 bg-black/80 border border-gray-700 hover:border-gold text-white transition-colors">
            <Navigation className="w-5 h-5" />
         </button>
      </div>
    </div>
  );
};

export default TacticalMap;






