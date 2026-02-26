import { NextRequest, NextResponse } from 'next/server';
import { getAdminPocketBase } from '@/lib/admin-pocketbase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[API] Sync New Booking payload:', body);

        const {
            appointment_id,
            customer_name,
            customer_email,
            service_name,
            booking_date,
            booking_time,
            status
        } = body;

        if (!appointment_id) {
            return NextResponse.json(
                { error: 'appointment_id is required' },
                { status: 400 }
            );
        }

        const pb = await getAdminPocketBase();

        // Ideally, we link to the customer record if it exists
        let customerId = '';
        if (customer_email) {
            try {
                const customer = await pb.collection('event_customers').getFirstListItem(`email="${customer_email}"`);
                customerId = customer.id;
            } catch (e) {
                console.log('[API] Customer not found for booking, continuing without link');
            }
        }

        // Check if booking exists (update it) or create new
        let existingBooking;
        try {
            existingBooking = await pb.collection('event_bookings').getFirstListItem(`appointment_id="${appointment_id}"`);
        } catch (e) {
            // Not found
        }

        let record;
        const data = {
            appointment_id,
            customer_name,
            customer_email,
            service_name,
            booking_date,
            booking_time,
            status: String(status), // Ensure string if enum/text
            // customer: customerId // Uncomment if you have a relation field 'customer'
        };

        if (existingBooking) {
            console.log(`[API] Updating booking: ${existingBooking.id}`);
            record = await pb.collection('event_bookings').update(existingBooking.id, data);
        } else {
            console.log('[API] Creating new booking');
            record = await pb.collection('event_bookings').create(data);
        }

        return NextResponse.json({ success: true, id: record.id });
    } catch (error: any) {
        console.error('[API] Sync Booking Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
