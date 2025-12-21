/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create presence_data collection
 * 
 * This migration creates the presence_data collection to store human presence sensor data:
 * - presence: Whether presence was detected
 * - distance: Distance in cm (-1 if no presence)
 * - voltage: Battery voltage
 * - battery_percent: Calculated battery percentage
 * - timestamp: When the reading was taken
 */

migrate((app) => {
    console.log('[MIGRATION] Starting presence_data collection creation...');

    // Helper to check if collection exists
    const collectionExists = (name) => {
        try {
            const existing = app.findCollectionByNameOrId(name);
            return existing !== null;
        } catch (e) {
            return false;
        }
    };

    // Helper to delete collection if exists
    const deleteCollectionIfExists = (name) => {
        try {
            const collection = app.findCollectionByNameOrId(name);
            if (collection) {
                app.delete(collection);
                console.log(`[MIGRATION] Deleted existing '${name}' collection.`);
            }
        } catch (e) {
            // Collection doesn't exist, continue
        }
    };

    // Create presence_data collection
    if (collectionExists('presence_data')) {
        console.log('[MIGRATION] presence_data collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating presence_data collection...');
        deleteCollectionIfExists('presence_data');
        
        const presenceDataCollection = new Collection({
            "name": "presence_data",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "hidden": false,
                    "id": "prpres001",
                    "name": "presence",
                    "type": "bool",
                    "required": true,
                    "presentable": false,
                    "system": false,
                    "options": {}
                },
                {
                    "hidden": false,
                    "id": "prdist001",
                    "name": "distance",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": -1,
                        "max": null,
                        "onlyInt": true
                    }
                },
                {
                    "hidden": false,
                    "id": "prvolt001",
                    "name": "voltage",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": 0,
                        "max": null
                    }
                },
                {
                    "hidden": false,
                    "id": "prbatt001",
                    "name": "battery_percent",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": 0,
                        "max": 100,
                        "onlyInt": true
                    }
                },
                {
                    "hidden": false,
                    "id": "prtime001",
                    "name": "timestamp",
                    "type": "date",
                    "required": true,
                    "presentable": true,
                    "system": false,
                    "options": {
                        "min": "",
                        "max": ""
                    }
                }
            ],
            "options": {},
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": ""
        });

        app.save(presenceDataCollection);
        console.log('[MIGRATION] presence_data collection created successfully.');
    }

    console.log('[MIGRATION] Migration completed successfully.');
}, (app) => {
    // Rollback: Delete presence_data collection
    console.log('[MIGRATION] Rolling back - deleting presence_data collection...');
    
    try {
        const presenceData = app.findCollectionByNameOrId('presence_data');
        if (presenceData) app.delete(presenceData);
        console.log('[MIGRATION] presence_data collection deleted.');
    } catch (e) {
        console.log('[MIGRATION] presence_data collection not found during rollback.');
    }
    
    console.log('[MIGRATION] Rollback completed.');
});

