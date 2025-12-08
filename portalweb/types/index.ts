export interface TelemetryData {
  latitude: number;
  longitude: number;
  speedKmh: number;
  batteryVoltage: number;
  satellites: number;
  lastUpdate: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  DOOR_KNOCKS = 'door_knocks',
  BIKE_GPS = 'bike_gps',
}






