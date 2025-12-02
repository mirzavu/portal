import { z } from 'zod';

// Door knock validation
// Timestamp is generated server-side, no need to pass it
export const doorKnockSchema = z.object({
  mac: z.string().min(1, 'MAC address is required'),
  knock_count: z.number().int().positive('Knock count must be positive'),
});

// Bike location validation
export const bikeLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  satellites: z.number().int().min(0).optional(),
  battery_mv: z.number().int().min(0).optional(),
  timestamp: z.number().int().positive('Timestamp must be positive'),
});

// User location validation
// Timestamp is generated server-side, no need to pass it
export const userLocationSchema = z.object({
  status: z.enum(['home', 'away', 'update']),
  home_latitude: z.number().min(-90).max(90).optional(),
  home_longitude: z.number().min(-180).max(180).optional(),
});

// Query parameters for door knocks
export const doorKnocksQuerySchema = z.object({
  from: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  to: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  perPage: z.string().optional().transform((val) => val ? parseInt(val, 10) : 50),
});
