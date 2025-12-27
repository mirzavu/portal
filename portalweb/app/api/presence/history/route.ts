import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/lib/pocketbase';

export const dynamic = 'force-dynamic'; // Disable caching for real-time data

export async function GET(request: NextRequest) {
    try {
        const pb = getPocketBase();

        // Calculate timestamp for 1 hour ago
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        console.log('[API DEBUG] Fetching history since:', oneHourAgo);
        console.log('[API DEBUG] Current Server Time:', new Date().toISOString());

        // Fetch all records from the last hour
        // Needed to fetch enough data to downsample accurately
        // Format timestamp for PocketBase filter (YYYY-MM-DD HH:mm:ss)
        const filterTime = oneHourAgo.replace('T', ' ').substring(0, 19);
        console.log('[API DEBUG] Filter Time:', filterTime);

        const records = await pb.collection('presence_data').getList(1, 1000, {
            // Start fetching recent items. Sort is default reverse created usually? 
            // We want oldest first for the chart, but 'sort' param might be causing issues too?
            // Let's strip it all and sort/filter in JS.
            // filter: `created >= "${filterTime}"`,
            // sort: '-created', // Newest first (default)
            requestKey: null, // Disable auto-cancellation
        });

        console.log(`[API DEBUG] Found ${records.totalItems} records.`);
        if (records.items.length > 0) {
            console.log('[API DEBUG] First Record Structure:', JSON.stringify(records.items[0]));
        }

        // JS Filtering & Sorting
        let items = records.items;

        // 1. Filter by time
        const minTime = new Date(oneHourAgo).getTime();
        items = items.filter(r => {
            const t = r.timestamp || r.created; // Fallback to created if timestamp missing
            return new Date(t).getTime() >= minTime;
        });

        // 2. Sort oldest first
        items.sort((a, b) => {
            const tA = a.timestamp || a.created;
            const tB = b.timestamp || b.created;
            return new Date(tA).getTime() - new Date(tB).getTime();
        });

        if (items.length > 0) {
            // console.log('[API DEBUG] Last Record Time (after JS sort/filter):', items[items.length - 1].timestamp);
        }

        // Downsampling logic: 1 point per ~5 minutes
        const downsampledData: any[] = [];
        let lastBucketTime = 0;
        const bucketSize = 5 * 60 * 1000; // 5 minutes in ms

        // Process records
        items.forEach((record) => {
            // Optional: Filter out failed reads if distance is -1 or presence is false
            // User asked for "distance", usually implying active presence.
            // We'll keep all but ensure chart handles gaps or 0s.

            const t = record.timestamp || record.created;
            const recordTime = new Date(t).getTime();

            if (recordTime - lastBucketTime >= bucketSize) {
                // Push this record as the representative for this 5-min bucket
                downsampledData.push({
                    timestamp: t, // Use the actual timestamp field
                    distance: record.distance,
                    presence: record.presence,
                    voltage: record.voltage
                });
                lastBucketTime = recordTime;
            }
        });

        return NextResponse.json(downsampledData);

    } catch (error: any) {
        console.error('Error fetching history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch history', details: error.message },
            { status: 500 }
        );
    }
}
