# PlatformIO Upload

- Update ports before USB upload: python3 "/home/mirza/Documents/PlatformIO/Projects/assign_ports.py" 
- always upload using upload sh script.
- add 3 minutes timeout for all uploads
- If error "A fatal error occurred: Serial data stream stopped: Possible serial noise or corruption" or "A fatal error occurred: Failed to write compressed data to flash after seq 36 (result was C900: Too much data)" or "A fatal error occurred: Timed out waiting for packet header", retry upload immediately.
- 
# Zip Artifact Command

- On command "zipnow": delete old zip and create new zip with the main cpp files of each project

# Documentation Files

- Do NOT create any md file unless requested
- Local Sudo password is 12121234 . Use it when you want

# Web App Instructions

- Next.js web app runs on port 3005
- PocketBase runs on port 8095

- Production Deployment
	- Production Server Access(use it whenever you want):
		- **SSH**: `ssh dev@139.59.66.225`
		- **sudo/ssh Password**: `JVR_!/tZgZTu020`
		- Production server is a hestiacp server running on ubuntu
	- **IMPORTANT**: NEVER make direct file changes or run installs on the production server, except for environment files. All code changes must be deployed through git except env files. If you need to copy any other files, always ask the user first.
    - Git Workflow
	- NEVER run `git push` automatically
	- Only push when explicitly requested by the user

- Code style & repo conventions (discoverable rules)
	- Commit messages: short (~<15 words), technical, no emojis.
	- Documentation: Do not create `.md` documents unless explicitly requested. Update docs only when asked.
	- Large file rule: flag files >700 lines to the user.
	- Make changes that don't negatively affect other parts of the codebase
	- Clean up any temporary files created during development
- Testing
	- Always open the browser and test whenever possible from all frontend issues
	- Test framework: Vitest
- Debugging Guidelines
	- Browser Console Logs:
		- Open browser and check the browser console for frontend errors when debugging UI issues.

	- Command Timeouts:
		- Always add timeouts to commands like `curl`, `pm2` or similar to avoid long-hanging operations.

	- Documentation Reference:
		- When coding or performing tasks, consult official library and framework docs for correct usage.

	- When in doubt:
		- If you have any major doubts, instead of assuming, ask the user directly. For critical doubts only which have a big impact on functioanlity.

	- Operational workflow checks:
		- check the server logs, pocketbase logs, browser console logs as the first step when diagnosing issues. 
        - If the issue cannot be identified from the current logs, Add more targeted logging in the backend or frontend to pinpoint issues instead of guessing.
		- Run the logs in the background and keep an eye on them while making changes.
		- After a git push to the production server, if you suspect a new environment variable is needed, copy the production env files from local to production
		- After completing a task, open the browser and verify its done without errors.
		- don't hesitate to use sudo when required for anything you need
- Migration safety:
    - Before rolling back migrations, always verify which migration is last applied to prevent accidental data loss.
    - **Database Schema Documentation**: 
        - Read `DB_SCHEMA.md` to understand the current database structure before making schema changes.
        - **IMPORTANT**: Whenever you create or modify a migration file in `pb_migrations/`, you MUST update `DB_SCHEMA.md` to reflect the schema changes (added/removed/modified fields, collections, or rules).
        - After running migrations, verify the schema by querying the database and update `DB_SCHEMA.md` if the actual schema differs from the documented schema.
    - **PocketBase Migration Best Practices**:
        - PocketBase migrations are fragile - work carefully and slowly
        - **ALWAYS check database state BEFORE and AFTER migration operations**:
            - Before rollback: Verify current state (check collections exist, field types, etc.)
            - Before migration: Confirm the database is in the expected state
            - After migration: Verify the changes were applied correctly
        - Use the PocketBase admin UI (http://127.0.0.1:8090/_/) to visually inspect collections, fields, and permissions
        - Test migrations by creating test records via API to verify functionality
        - When merging multiple migrations into one:
            - First rollback/delete the old migrations
            - Check database state is clean
            - Create the merged migration with all changes
            - Run migration and verify state
        - Date fields in PocketBase accept ISO strings (e.g., `new Date().toISOString()`), so use `date` type, not `text`
        - For anonymous access, set `createRule: null` (not empty string `""`)

12121234 is my local ubuntu sudo password