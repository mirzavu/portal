import { NextRequest, NextResponse } from 'next/server';
import { getAdminPocketBase } from '@/lib/admin-pocketbase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[API] Sync New Customer payload:', body);

        const {
            customer_id,
            customer_name,
            customer_email,
            customer_phone
        } = body;

        if (!customer_email) {
            return NextResponse.json(
                { error: 'customer_email is required' },
                { status: 400 }
            );
        }

        const pb = await getAdminPocketBase();

        // Check if customer exists
        let existingCustomer;
        try {
            // Assuming email is unique. You might want to check by customer_id if that's the primary key from WP
            // But for now let's query by email
            existingCustomer = await pb.collection('event_customers').getFirstListItem(`email="${customer_email}"`);
        } catch (e) {
            // Not found, valid to create new
        }

        let record;
        if (existingCustomer) {
            // Update
            console.log(`[API] Updating existing customer: ${existingCustomer.id}`);
            record = await pb.collection('event_customers').update(existingCustomer.id, {
                customer_id: customer_id, // Store WP ID if needed
                name: customer_name,
                email: customer_email,
                phone: customer_phone,
            });
        } else {
            // Create
            console.log('[API] Creating new customer');
            record = await pb.collection('event_customers').create({
                customer_id: customer_id,
                name: customer_name,
                email: customer_email,
                phone: customer_phone,
            });
        }

        return NextResponse.json({ success: true, id: record.id });
    } catch (error: any) {
        console.error('[API] Sync Customer Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
