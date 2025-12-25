/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("file_transfer_messages")

    // update field
    collection.fields.addAt(3, new Field({
        "hidden": false,
        "id": "ftfile001",
        "maxSelect": 99,
        "maxSize": 524288000, // 500 MB
        "mimeTypes": [],
        "name": "file",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("file_transfer_messages")

    // revert field
    collection.fields.addAt(3, new Field({
        "hidden": false,
        "id": "ftfile001",
        "maxSelect": 99,
        "maxSize": 0, // default 5MB
        "mimeTypes": [],
        "name": "file",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
    }))

    return app.save(collection)
})
