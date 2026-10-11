const $ = id => document.getElementById(id);
const socket = io();
const clientId = "editor-" + Math.random().toString(36).slice(2,9);
let currentId = "welcome", currentVersion = 1, currentTitle = "Welcome to SyncDoc";
let applyingRemote = false, lastSavedContent = "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600)}
async function api(url,opts={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
function setConnection(connected){$("connectionText").textContent=connected?"Connected":"Offline";$("connectionText").parentElement.classList.toggle("connected",connected)}
function updateLines(){const n=$("editor").value.split("\n").length;$("lineNumbers").textContent=Array.from({length:n},(_,i)=>i+1).join("\n");$("wordCount").textContent=($("editor").value.trim().match(/\S+/g)||[]).length+" words"}
function updateDirty(){const dirty=$("editor").value!==lastSavedContent;$("saveStatus").textContent=dirty?"Unsaved changes":"All changes saved";updateLines()}
function simpleMarkdown(md){
 return esc(md).split("\n").map(line=>{
  if(line.startsWith("### "))return `<h3>${line.slice(4)}</h3>`;
  if(line.startsWith("## "))return `<h2>${line.slice(3)}</h2>`;
  if(line.startsWith("# "))return `<h1>${line.slice(2)}</h1>`;
  if(line.startsWith("> "))return `<blockquote>${line.slice(2)}</blockquote>`;
  if(line.startsWith("- "))return `<p>• ${line.slice(2)}</p>`;
  if(line.trim()==="")return "<br>";
  return `<p>${line.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>")}</p>`;
 }).join("");
}
function showPreview(show){$("editor").classList.toggle("hidden",show);$("lineNumbers").classList.toggle("hidden",show);$("preview").classList.toggle("hidden",!show);$("previewToggle").textContent=show?"✎ Edit":"◫ Preview";if(show)$("preview").innerHTML=simpleMarkdown($("editor").value)}
async function loadDocList(){
 const list=await api("/api/documents");
 $("docList").innerHTML=list.map(d=>`<div class="doc-item ${d.id===currentId?"active":""}" data-id="${esc(d.id)}"><span class="doc-glyph">▤</span><span>${esc(d.title)}</span></div>`).join("");
}
async function openDoc(id){
 if(currentId)socket.emit("document:leave",currentId);
 const d=await api("/api/documents/"+encodeURIComponent(id));
 currentId=d.id;currentVersion=d.version;currentTitle=d.title;lastSavedContent=d.content;
 $("crumbTitle").textContent=d.title;$("pageTitle").textContent=d.title;$("editor").value=d.content;$("version").textContent="v"+d.version;
 $("updatedAt").textContent="Updated "+new Date(d.updatedAt).toLocaleString();$("saveStatus").textContent="All changes saved";
 showPreview(false);updateLines();socket.emit("document:join",currentId);await loadDocList();
}
async function refreshAll(){await loadDocList();await openDoc(currentId||"welcome")}
$("docList").addEventListener("click",async e=>{const item=e.target.closest("[data-id]");if(item)try{await openDoc(item.dataset.id)}catch(err){toast(err.message)}});
$("newDoc").addEventListener("click",async()=>{const title=prompt("Enter a title for your new document:");if(!title||!title.trim())return;try{const d=await api("/api/documents",{method:"POST",body:JSON.stringify({title})});await openDoc(d.id);toast("New document created.")}catch(err){toast(err.message)}});
$("editor").addEventListener("input",()=>{updateDirty();if(!$("preview").classList.contains("hidden"))$("preview").innerHTML=simpleMarkdown($("editor").value)});
$("saveBtn").addEventListener("click",async()=>{
 try{
  $("saveStatus").textContent="Saving…";
  const d=await api("/api/documents/"+encodeURIComponent(currentId),{method:"PUT",body:JSON.stringify({title:currentTitle,content:$("editor").value,clientId})});
  currentVersion=d.version;lastSavedContent=d.content;$("version").textContent="v"+d.version;$("updatedAt").textContent="Updated "+new Date(d.updatedAt).toLocaleString();$("saveStatus").textContent="All changes saved";await loadDocList();toast("Document saved successfully.");
 }catch(err){$("saveStatus").textContent="Save failed";toast(err.message)}
});
$("previewToggle").addEventListener("click",()=>showPreview($("preview").classList.contains("hidden")));
$("jumpConflict").addEventListener("click",()=>$("conflictLab").scrollIntoView({behavior:"smooth"}));
socket.on("connect",()=>{setConnection(true);socket.emit("document:join",currentId)});
socket.on("disconnect",()=>setConnection(false));
socket.on("document:joined",data=>{$("presenceText").textContent=(data.activeEditors||1)+" editor"+((data.activeEditors||1)===1?"":"s")+" in this room"});
socket.on("presence:update",data=>{$("presenceText").textContent=(data.activeEditors||1)+" editor"+((data.activeEditors||1)===1?"":"s")+" in this room"});
socket.on("document:update",data=>{
 if(data.id!==currentId||data.by===clientId)return;
 $("version").textContent="v"+data.version;$("updatedAt").textContent="Updated "+new Date(data.updatedAt).toLocaleString();
 if($("editor").value===lastSavedContent||$("editor").value===data.content){
  applyingRemote=true;$("editor").value=data.content;lastSavedContent=data.content;currentVersion=data.version;currentTitle=data.title;$("pageTitle").textContent=data.title;$("crumbTitle").textContent=data.title;updateDirty();applyingRemote=false;toast("Document updated from another session.");
 }else{
  toast("Another session saved changes. Save or copy your local edits before reloading.");
 }
});
function splitBlocks(text){return text.replace(/\r/g,"").split("\n").reduce((blocks,line)=>{if(line.trim()===""){if(blocks.length&&blocks[blocks.length-1]!=="")blocks.push("");return blocks}if(!blocks.length||blocks[blocks.length-1]==="")blocks.push(line);else blocks[blocks.length-1]+="\n"+line;return blocks},[])}
function merge3(baseText,aText,bText){
 const base=splitBlocks(baseText), a=splitBlocks(aText), b=splitBlocks(bText), max=Math.max(base.length,a.length,b.length), out=[];let conflicts=0;
 for(let i=0;i<max;i++){
  const o=base[i], av=a[i], bv=b[i];
  if(av===bv){if(av!==undefined)out.push(av)}
  else if(av===o){if(bv!==undefined)out.push(bv)}
  else if(bv===o){if(av!==undefined)out.push(av)}
  else if(av===undefined&&bv!==undefined){out.push("<<<<<<< Version A\n[Block removed in A]\n=======\n"+bv+"\n>>>>>>> Version B");conflicts++}
  else if(bv===undefined&&av!==undefined){out.push("<<<<<<< Version A\n"+av+"\n=======\n[Block removed in B]\n>>>>>>> Version B");conflicts++}
  else if(av!==undefined&&bv!==undefined){out.push("<<<<<<< Version A\n"+av+"\n=======\n"+bv+"\n>>>>>>> Version B");conflicts++}
 }
 return {text:out.join("\n\n"),conflicts};
}
let latestMerge="";
$("resolveBtn").addEventListener("click",()=>{
 const result=merge3($("baseText").value,$("versionA").value,$("versionB").value);latestMerge=result.text;
 $("mergeOutput").textContent=result.text||"(empty document)";$("conflictCount").textContent=result.conflicts+" conflict"+(result.conflicts===1?"":"s");
 $("mergeResult").classList.remove("hidden");toast(result.conflicts?"Review the conflict markers before applying.":"Changes merged without overlapping block edits.");
});
$("applyMerge").addEventListener("click",()=>{$("editor").value=latestMerge;showPreview(false);updateDirty();$("editor").focus();window.scrollTo({top:0,behavior:"smooth"});toast("Merge result copied into editor. Click Save document to persist it.")});
refreshAll().catch(err=>toast("Could not load documents: "+err.message));
