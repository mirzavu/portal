#!/bin/bash

# Configuration
API_URL="http://localhost:3005/api/v1"

echo "Testing BookingPress Sync API..."

# 1. Test Sync Customer
echo -e "\n1. Testing Sync Customer..."
curl -X POST "$API_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "new_customer",
    "customer_id": 9991,
    "customer_name": "Test User",
    "customer_email": "test.user@example.com",
    "customer_phone": "1234567890"
  }'

# 2. Test Sync Booking
echo -e "\n\n2. Testing Sync Booking..."
curl -X POST "$API_URL/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "new_booking",
    "appointment_id": 8881,
    "customer_name": "Test User",
    "customer_email": "test.user@example.com",
    "service_name": "Test Service",
    "booking_date": "2026-02-01",
    "booking_time": "14:00:00",
    "status": "1"
  }'

echo -e "\n\nDone."
