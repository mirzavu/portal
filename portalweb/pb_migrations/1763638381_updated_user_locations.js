
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_locations")

  // Update existing status field to include "update"
  const statusField = collection.fields.getByName("status")
  if (statusField) {
    statusField.values = ["home", "away", "update"]
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_locations")

  // Rollback: Remove "update" from status field values
  const statusField = collection.fields.getByName("status")
  if (statusField) {
    statusField.values = ["home", "away"]
  }

  return app.save(collection)
})
