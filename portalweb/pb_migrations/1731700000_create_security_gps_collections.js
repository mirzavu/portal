/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create security and GPS tracking collections
 * 
 * This migration creates the following collections:
 * - door_knocks: Stores door knock events
 * - bike_locations: Stores bike GPS location data
 * - user_locations: Stores user location data
 * - alerts: Stores system alerts
 */

migrate((app) => {
    console.log('[MIGRATION] Starting security and GPS collections creation...');

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

    // 1. Create door_knocks collection
    if (collectionExists('door_knocks')) {
        console.log('[MIGRATION] door_knocks collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating door_knocks collection...');
        deleteCollectionIfExists('door_knocks');
        
        const doorKnocksCollection = new Collection({
            "name": "door_knocks",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "system": false,
                    "id": "dkmac001",
                    "name": "mac",
                    "type": "text",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
                    }
                },
                {
                    "system": false,
                    "id": "dkcnt001",
                    "name": "knock_count",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": 1,
                        "max": null,
                        "noDecimal": true
                    }
                },
                {
                    "system": false,
                    "id": "dktime001",
                    "name": "timestamp",
                    "type": "date",
                    "required": true,
                    "presentable": true,
                    "unique": false,
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

        app.save(doorKnocksCollection);
        console.log('[MIGRATION] door_knocks collection created successfully.');
    }

    // 2. Create bike_locations collection
    if (collectionExists('bike_locations')) {
        console.log('[MIGRATION] bike_locations collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating bike_locations collection...');
        deleteCollectionIfExists('bike_locations');
        
        const bikeLocationsCollection = new Collection({
            "name": "bike_locations",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "system": false,
                    "id": "bklat001",
                    "name": "latitude",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": -90,
                        "max": 90,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "bklon001",
                    "name": "longitude",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": -180,
                        "max": 180,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "bkspd001",
                    "name": "speed",
                    "type": "number",
                    "required": false,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": 0,
                        "max": null,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "bksat001",
                    "name": "satellites",
                    "type": "number",
                    "required": false,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": 0,
                        "max": null,
                        "noDecimal": true
                    }
                },
                {
                    "system": false,
                    "id": "bkbat001",
                    "name": "battery_mv",
                    "type": "number",
                    "required": false,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": 0,
                        "max": null,
                        "noDecimal": true
                    }
                },
                {
                    "system": false,
                    "id": "bktime001",
                    "name": "timestamp",
                    "type": "date",
                    "required": true,
                    "presentable": true,
                    "unique": false,
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

        app.save(bikeLocationsCollection);
        console.log('[MIGRATION] bike_locations collection created successfully.');
    }

    // 3. Create user_locations collection
    if (collectionExists('user_locations')) {
        console.log('[MIGRATION] user_locations collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating user_locations collection...');
        deleteCollectionIfExists('user_locations');
        
        const userLocationsCollection = new Collection({
            "name": "user_locations",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "system": false,
                    "id": "uslat001",
                    "name": "latitude",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": -90,
                        "max": 90,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "uslon001",
                    "name": "longitude",
                    "type": "number",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": -180,
                        "max": 180,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "usacc001",
                    "name": "accuracy",
                    "type": "number",
                    "required": false,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": 0,
                        "max": null,
                        "noDecimal": false
                    }
                },
                {
                    "system": false,
                    "id": "ustime001",
                    "name": "timestamp",
                    "type": "date",
                    "required": true,
                    "presentable": true,
                    "unique": false,
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

        app.save(userLocationsCollection);
        console.log('[MIGRATION] user_locations collection created successfully.');
    }

    // 4. Create alerts collection
    if (collectionExists('alerts')) {
        console.log('[MIGRATION] alerts collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating alerts collection...');
        deleteCollectionIfExists('alerts');
        
        const alertsCollection = new Collection({
            "name": "alerts",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "system": false,
                    "id": "altyp001",
                    "name": "type",
                    "type": "text",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": 50,
                        "pattern": ""
                    }
                },
                {
                    "system": false,
                    "id": "almsg001",
                    "name": "message",
                    "type": "text",
                    "required": true,
                    "presentable": false,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": 500,
                        "pattern": ""
                    }
                },
                {
                    "system": false,
                    "id": "altime001",
                    "name": "timestamp",
                    "type": "date",
                    "required": true,
                    "presentable": true,
                    "unique": false,
                    "options": {
                        "min": "",
                        "max": ""
                    }
                },
                {
                    "system": false,
                    "id": "alread001",
                    "name": "read",
                    "type": "bool",
                    "required": false,
                    "presentable": false,
                    "unique": false,
                    "options": {}
                }
            ],
            "options": {},
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": ""
        });

        app.save(alertsCollection);
        console.log('[MIGRATION] alerts collection created successfully.');
    }

    console.log('[MIGRATION] All collections created successfully.');
}, (app) => {
    // Rollback: Delete all collections
    console.log('[MIGRATION] Rolling back - deleting collections...');
    
    try {
        const alerts = app.findCollectionByNameOrId('alerts');
        if (alerts) app.delete(alerts);
    } catch (e) {}
    
    try {
        const userLocations = app.findCollectionByNameOrId('user_locations');
        if (userLocations) app.delete(userLocations);
    } catch (e) {}
    
    try {
        const bikeLocations = app.findCollectionByNameOrId('bike_locations');
        if (bikeLocations) app.delete(bikeLocations);
    } catch (e) {}
    
    try {
        const doorKnocks = app.findCollectionByNameOrId('door_knocks');
        if (doorKnocks) app.delete(doorKnocks);
    } catch (e) {}
    
    console.log('[MIGRATION] Rollback completed.');
});




