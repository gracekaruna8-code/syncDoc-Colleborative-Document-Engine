# SyncDoc: Collaborative Document Engine with AST Conflict Resolution

A full-stack academic web-development demo for editing Markdown documents, broadcasting live changes to other open sessions, and demonstrating conflict-aware merging at the client.

## Stack
- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express
- Real-time communication: Socket.IO
- Persistence: JSON file (`documents.json`)
- Conflict-resolution demo: line/block-based AST-inspired three-way merge for Markdown headings, lists, paragraphs and other blocks

## Run locally
1. Install Node.js LTS from https://nodejs.org/
2. Extract this ZIP and open this folder in VS Code.
3. Open Terminal in this folder and run:
   ```bash
   npm install
   npm start
   ```
4. Open http://localhost:3000
5. Open the same URL in a second browser tab/window to demonstrate live update notifications.

## Main features
- Create, list and open documents
- Markdown editing and preview
- Auto-save button
- Socket.IO broadcasts updates to other open clients
- Conflict Lab compares a common base with two versions and demonstrates block-based merge/conflict markers
- Document version counter and update status

## Important scope notes
This is a demonstration prototype, not a production-ready Google Docs replacement. It does not implement authentication, permissions, a database server, cursor presence, or a formal AST/parser for all Markdown syntax. The conflict lab uses a simplified block-based three-way merge and displays conflicts for manual review. Simultaneous whole-document saves use last-write-wins on the server, so describe the AST-inspired merge as a demonstrator/prototype rather than claiming full automatic AST conflict resolution. For a production version, use a Markdown parser, operational transformation or CRDT, robust version history, and database storage.

## API
- `GET /api/health`
- `GET /api/documents`
- `GET /api/documents/:id`
- `POST /api/documents` with `{ "title": "My document" }`
- `PUT /api/documents/:id` with `{ "title": "...", "content": "...", "clientId": "..." }`

## Suggested demo
1. Create a document.
2. Type text and click Save.
3. Open the same document in another tab and observe the update notification.
4. Scroll to Conflict Lab. Keep the base text, make one change in Version A and a different change in Version B, then click “Resolve changes”. If both versions change the same block differently, inspect the conflict markers.
