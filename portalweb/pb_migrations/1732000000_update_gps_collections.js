

migrate((app) => {
    // 1. Update user_locations collection
    const userLocations = app.findCollectionByNameOrId("user_locations");

    if (!userLocations) {
        console.log('[MIGRATION] user_locations collection not found, skipping.');
        return;
    }

    // Add new fields FIRST to ensure collection stays valid
    // Get current field count to determine insertion positions
    const currentFieldCount = userLocations.fields.length;
    
    if (!userLocations.fields.getByName("status")) {
        userLocations.fields.addAt(currentFieldCount, new Field({
            "hidden": false,
            "id": "usrstat01",
            "maxSelect": 1,
            "name": "status",
            "presentable": false,
            "primaryKey": false,
            "required": true,
            "system": false,
            "type": "select",
            "values": ["home", "away"]
        }));
    }

    if (!userLocations.fields.getByName("home_latitude")) {
        userLocations.fields.addAt(currentFieldCount + 1, new Field({
            "hidden": false,
            "id": "ushlat01",
            "max": 90,
            "min": -90,
            "name": "home_latitude",
            "noDecimal": false,
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "number"
        }));
    }

    if (!userLocations.fields.getByName("home_longitude")) {
        userLocations.fields.addAt(currentFieldCount + 2, new Field({
            "hidden": false,
            "id": "ushlon01",
            "max": 180,
            "min": -180,
            "name": "home_longitude",
            "noDecimal": false,
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "number"
        }));
    }

    // Save after adding new fields
    app.save(userLocations);

    // Now remove old fields
    const latitudeField = userLocations.fields.getByName("latitude");
    if (latitudeField) {
        userLocations.fields.removeById(latitudeField.id);
    }
    const longitudeField = userLocations.fields.getByName("longitude");
    if (longitudeField) {
        userLocations.fields.removeById(longitudeField.id);
    }
    const accuracyField = userLocations.fields.getByName("accuracy");
    if (accuracyField) {
        userLocations.fields.removeById(accuracyField.id);
    }

    return app.save(userLocations);

    // 2. Update bike_locations collection
    const bikeLocations = app.findCollectionByNameOrId("bike_locations");

    // Remove speed field (only if it exists)
    if (bikeLocations.fields.getByName("speed")) {
        bikeLocations.fields.removeByName("speed");
    }

    return app.save(bikeLocations);

}, (app) => {
    // Rollback user_locations
    const userLocations = app.findCollectionByNameOrId("user_locations");
    
    // Remove new fields
    const statusField = userLocations.fields.getByName("status");
    if (statusField) {
        userLocations.fields.removeById(statusField.id);
    }
    const homeLatField = userLocations.fields.getByName("home_latitude");
    if (homeLatField) {
        userLocations.fields.removeById(homeLatField.id);
    }
    const homeLonField = userLocations.fields.getByName("home_longitude");
    if (homeLonField) {
        userLocations.fields.removeById(homeLonField.id);
    }
    
    // Add back old fields
    const rollbackFieldCount = userLocations.fields.length;
    userLocations.fields.addAt(rollbackFieldCount, new Field({
        "hidden": false,
        "id": "uslat001",
        "max": 90,
        "min": -90,
        "name": "latitude",
        "noDecimal": false,
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "number"
    }));
    userLocations.fields.addAt(rollbackFieldCount + 1, new Field({
        "hidden": false,
        "id": "uslon001",
        "max": 180,
        "min": -180,
        "name": "longitude",
        "noDecimal": false,
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "number"
    }));
    userLocations.fields.addAt(rollbackFieldCount + 2, new Field({
        "hidden": false,
        "id": "usacc001",
        "min": 0,
        "name": "accuracy",
        "noDecimal": false,
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number"
    }));

    app.save(userLocations);

    // Rollback bike_locations
    const bikeLocations = app.findCollectionByNameOrId("bike_locations");
    
    const bikeFieldCount = bikeLocations.fields.length;
    bikeLocations.fields.addAt(bikeFieldCount, new Field({
        "hidden": false,
        "id": "bkspd001",
        "min": 0,
        "name": "speed",
        "noDecimal": false,
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "number"
    }));

    return app.save(bikeLocations);
});


