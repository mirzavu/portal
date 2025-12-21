/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create file_transfer_threads and file_transfer_messages collections
 * 
 * This migration creates collections for the file transfer chat system:
 * - file_transfer_threads: Stores chat thread metadata (name, timestamps)
 * - file_transfer_messages: Stores messages with optional file attachments
 */

migrate((app) => {
    console.log('[MIGRATION] Starting file transfer collections creation...');

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

    // Create file_transfer_threads collection
    if (collectionExists('file_transfer_threads')) {
        console.log('[MIGRATION] file_transfer_threads collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating file_transfer_threads collection...');
        deleteCollectionIfExists('file_transfer_threads');
        
        const threadsCollection = new Collection({
            "name": "file_transfer_threads",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "hidden": false,
                    "id": "ftname001",
                    "name": "name",
                    "type": "text",
                    "required": true,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
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

        app.save(threadsCollection);
        console.log('[MIGRATION] file_transfer_threads collection created successfully.');
    }

    // Create file_transfer_messages collection
    if (collectionExists('file_transfer_messages')) {
        console.log('[MIGRATION] file_transfer_messages collection already exists, skipping creation.');
    } else {
        console.log('[MIGRATION] Creating file_transfer_messages collection...');
        deleteCollectionIfExists('file_transfer_messages');
        
        // Reload the threads collection to get its ID after save
        const threadsCollection = app.findCollectionByNameOrId('file_transfer_threads');
        if (!threadsCollection) {
            throw new Error('file_transfer_threads collection must exist before creating file_transfer_messages');
        }
        
        // Get the collection ID - reload to ensure ID is available
        const threadsCollectionId = threadsCollection.id;
        console.log('[MIGRATION] Threads collection ID:', threadsCollectionId);
        if (!threadsCollectionId || threadsCollectionId === '') {
            throw new Error('file_transfer_threads collection ID is not available');
        }
        
        const messagesCollection = new Collection({
            "name": "file_transfer_messages",
            "type": "base",
            "system": false,
            "fields": [
                {
                    "cascadeDelete": false,
                    "collectionId": threadsCollectionId,
                    "hidden": false,
                    "id": "ftthrd001",
                    "maxSelect": 1,
                    "minSelect": null,
                    "name": "thread_id",
                    "presentable": false,
                    "required": true,
                    "system": false,
                    "type": "relation"
                },
                {
                    "hidden": false,
                    "id": "ftmsg001",
                    "name": "message",
                    "type": "text",
                    "required": false,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
                    }
                },
                {
                    "hidden": false,
                    "id": "ftfile001",
                    "name": "file",
                    "type": "file",
                    "required": false,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "maxSelect": 1,
                        "maxSize": 0,
                        "mimeTypes": [],
                        "protected": false
                    }
                },
                {
                    "hidden": false,
                    "id": "ftfnam001",
                    "name": "file_name",
                    "type": "text",
                    "required": false,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
                    }
                },
                {
                    "hidden": false,
                    "id": "ftfsiz001",
                    "name": "file_size",
                    "type": "number",
                    "required": false,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "noDecimal": false
                    }
                },
                {
                    "hidden": false,
                    "id": "ftftyp001",
                    "name": "file_type",
                    "type": "text",
                    "required": false,
                    "presentable": false,
                    "system": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
                    }
                },
                {
                    "hidden": false,
                    "id": "fttime001",
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

        app.save(messagesCollection);
        console.log('[MIGRATION] file_transfer_messages collection created successfully.');
    }

    console.log('[MIGRATION] Migration completed successfully.');
}, (app) => {
    // Rollback: Delete both collections
    console.log('[MIGRATION] Rolling back - deleting file transfer collections...');
    
    try {
        const messages = app.findCollectionByNameOrId('file_transfer_messages');
        if (messages) {
            app.delete(messages);
            console.log('[MIGRATION] file_transfer_messages collection deleted.');
        }
    } catch (e) {
        console.log('[MIGRATION] file_transfer_messages collection not found during rollback.');
    }
    
    try {
        const threads = app.findCollectionByNameOrId('file_transfer_threads');
        if (threads) {
            app.delete(threads);
            console.log('[MIGRATION] file_transfer_threads collection deleted.');
        }
    } catch (e) {
        console.log('[MIGRATION] file_transfer_threads collection not found during rollback.');
    }
    
    console.log('[MIGRATION] Rollback completed.');
});

