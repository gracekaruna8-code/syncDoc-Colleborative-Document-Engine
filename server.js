const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "documents.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function loadDocs() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return [{ id: "welcome", title: "Welcome to SyncDoc", content: "# Welcome to SyncDoc\n\nThis is a collaborative document workspace.\n\n## Try it out\n- Edit the document in the editor.\n- Open this page in another browser tab to see live updates.\n- Use **Preview** to view rendered Markdown.\n\n> Demo note: conflict handling is a lightweight, line-based AST-inspired merge, not a full language parser." , updatedAt: new Date().toISOString(), version: 1 }]; }
}
function saveDocs(docs) { fs.writeFileSync(DB_FILE, JSON.stringify(docs, null, 2)); }
let docs = loadDocs();

function getDoc(id) { return docs.find(d => d.id === id); }
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "SyncDoc API" }));
app.get("/api/documents", (_req, res) => res.json(docs.map(({id,title,updatedAt,version}) => ({id,title,updatedAt,version}))));
app.get("/api/documents/:id", (req, res) => {
  const doc = getDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json(doc);
});
app.post("/api/documents", (req, res) => {
  const title = String(req.body.title || "").trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: "Document title is required." });
  const doc = { id: "doc-" + Date.now().toString(36) + Math.random().toString(36).slice(2,6), title, content: "# " + title + "\n\nStart writing here...", updatedAt: new Date().toISOString(), version: 1 };
  docs.unshift(doc); saveDocs(docs); res.status(201).json(doc);
});
app.put("/api/documents/:id", (req, res) => {
  const doc = getDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const title = String(req.body.title ?? doc.title).trim().slice(0,120);
  const content = String(req.body.content ?? doc.content);
  if (!title) return res.status(400).json({ error: "Title cannot be empty." });
  if (content.length > 200000) return res.status(413).json({ error: "Document is too large (maximum 200 KB)." });
  doc.title = title; doc.content = content; doc.updatedAt = new Date().toISOString(); doc.version += 1;
  saveDocs(docs);
  io.to(doc.id).emit("document:update", { id: doc.id, title: doc.title, content: doc.content, updatedAt: doc.updatedAt, version: doc.version, by: req.body.clientId || "another editor" });
  res.json(doc);
});

io.on("connection", socket => {
  socket.on("document:join", id => {
    if (typeof id !== "string" || !getDoc(id)) return;
    for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
    socket.join(id);
    socket.emit("document:joined", { id, activeEditors: io.sockets.adapter.rooms.get(id)?.size || 1 });
    socket.to(id).emit("presence:update", { activeEditors: io.sockets.adapter.rooms.get(id)?.size || 1 });
  });
  socket.on("document:leave", id => {
    socket.leave(id);
    socket.to(id).emit("presence:update", { activeEditors: io.sockets.adapter.rooms.get(id)?.size || 0 });
  });
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.to(room).emit("presence:update", { activeEditors: Math.max(0,(io.sockets.adapter.rooms.get(room)?.size || 1)-1) });
    }
  });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
server.listen(PORT, () => console.log(`SyncDoc running at http://localhost:${PORT}`));
