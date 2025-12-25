/* --- main.js: إصلاح المتابعة، المراسلة، والعودة للبروفايل --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// إعدادات Bunny CDN
const BUNNY_STORAGE_NAME = "hooby"; 
const BUNNY_API_KEY = "ce4c08e4-41a1-477f-a163d4a0cfcc-315f-4508"; 
const BUNNY_CDN_URL = "https://hooby.b-cdn.net"; 
const STREAM_LIB_ID = "569937";
const STREAM_API_KEY = "670a82d3-2783-45cb-a97fe91e960a-c972-4f1a";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBZXpf8lo3bNdCUypuUXO2yeNNAuBm7cQQ",
  authDomain: "hooby-7d945.firebaseapp.com",
  databaseURL: "https://hooby-7d945-default-rtdb.firebaseio.com",
  projectId: "hooby-7d945",
  storageBucket: "hooby-7d945.firebasestorage.app",
  messagingSenderId: "522131121638",
  appId: "1:522131121638:web:748f7761f18167fb65e227",
  measurementId: "G-H1F82C1THC"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const postsRef = ref(db, 'posts');
const usersRef = ref(db, 'users');

const DEFAULT_IMG = "default.jpg";
const NOTIFICATION_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

let userXPCache = {};

// دالة الأمان
function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    const isLoginPage = path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html') || path.endsWith('/');
    if (isLoggedIn) {
        if (isLoginPage) window.location.href = 'home.html';
        requestNotificationPermission();
        monitorNotifications();
        if (path.includes('messages.html')) localStorage.setItem('hasUnreadMessages', 'false');
        registerUserPresence();
    } else {
        if (!isLoginPage) window.location.href = 'index.html';
    }
}
checkAuth(); 

function getSafeName(name) { if(!name) return null; return name.replace(/[.#$\[\]]/g, "_"); }

function registerUserPresence() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || DEFAULT_IMG;
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        update(ref(db, 'users/' + getSafeName(myName)), { name: myName, img: myImg, lastActive: serverTimestamp() });
    }
}
setInterval(registerUserPresence, 120000); 

function timeAgo(timestamp) {
    if (!timestamp) return "الآن";
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 60) return "الآن";
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} أيام`;
    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-EG');
}

// نظام الرتب
function getLevelClass(xp) {
    xp = xp || 0;
    if (xp >= 20000) return "lvl-max-phoenix";     
    if (xp >= 17000) return "lvl-crown-green";     
    if (xp >= 14000) return "lvl-red-chain";       
    if (xp >= 10000) return "lvl-black-green";     
    if (xp >= 8000)  return "lvl-black-glow";      
    if (xp >= 5000)  return "lvl-emerald";         
    if (xp >= 3000)  return "lvl-gold";            
    if (xp >= 1000)  return "lvl-copper";          
    return "lvl-bronze";                           
}
function addXP(userId, amount) {
    const userRef = ref(db, 'users/' + getSafeName(userId) + '/xp');
    runTransaction(userRef, (currentXP) => (currentXP || 0) + amount);
}

// دوال الرفع
function updateProgressBar(percent) { const overlay = document.getElementById('uploadProgressOverlay'); if (overlay) { overlay.style.display = 'flex'; document.getElementById('progressBarFill').style.width = percent + '%'; document.getElementById('progressText').innerText = `جاري الرفع: ${Math.round(percent)}%`; } }
function hideProgressBar() { const overlay = document.getElementById('uploadProgressOverlay'); if(overlay) overlay.style.display='none'; }
function uploadWithProgress(url, method, headers, body) { return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open(method, url, true); for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value); xhr.upload.onprogress = (e) => { if (e.lengthComputable) updateProgressBar((e.loaded / e.total) * 100); }; xhr.onload = () => { (xhr.status >= 200 && xhr.status < 300) ? resolve(JSON.parse(xhr.responseText||'{}')) : reject(new Error(xhr.statusText)); }; xhr.onerror = () => reject(new Error("Network Error")); xhr.send(body); }); }
async function uploadToBunny(file) { const fileName = Date.now() + "_" + file.name.replace(/\s/g, "_"); try { await uploadWithProgress(`https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`, 'PUT', { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' }, file); return `${BUNNY_CDN_URL}/${fileName}`; } catch (e) { console.error(e); return null; } }
async function uploadVideoToBunnyStream(file) { try { const createRes = await fetch(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos`, { method: 'POST', headers: { 'AccessKey': STREAM_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: file.name }) }); if (!createRes.ok) throw new Error("Create Failed"); const vid = (await createRes.json()).guid; await uploadWithProgress(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos/${vid}`, 'PUT', { 'AccessKey': STREAM_API_KEY }, file); return `https://iframe.mediadelivery.net/embed/${STREAM_LIB_ID}/${vid}`; } catch (e) { console.error(e); return null; } }

window.triggerCoverUpload = function() { document.getElementById('coverImgInput').click(); }
window.uploadNewCoverImg = async function() { const f = document.getElementById('coverImgInput').files[0]; if(f) { const u=await uploadToBunny(f); if(u){ update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {coverImg:u}).then(()=>{ document.getElementById('profile-cover-img').src=u; document.getElementById('profile-cover-img').style.display='block'; hideProgressBar(); alert("تم!"); }); } else hideProgressBar(); } }

// الإشعارات
function requestNotificationPermission() { if ("Notification" in window) Notification.requestPermission(); }
function showSystemNotification(sender, message, img) { NOTIFICATION_SOUND.play().catch(()=>{}); if (Notification.permission === "granted") { const n = new Notification(`رسالة من ${sender}`, { body: message, icon: img || DEFAULT_IMG }); n.onclick = () => { window.focus(); window.location.href = 'messages.html'; }; } }
function monitorNotifications() { const myName = getSafeName(localStorage.getItem('hobbyName')); if (!myName) return; onChildAdded(query(ref(db, `notifications/${myName}`), limitToLast(1)), (s) => { const d = s.val(); if (d.timestamp && (Date.now() - d.timestamp < 10000) && currentChatPartner !== d.senderName) showSystemNotification(d.senderName, d.text, d.senderImg); }); }

// =========================================================
// 🔥 حل مشكلة المراسلة من البروفايل (الجزء 1: الاستقبال) 🔥
// =========================================================
if (document.getElementById('usersList')) {
    // التحقق فوراً: هل هناك أمر معلق لفتح محادثة؟
    const pendingChat = JSON.parse(localStorage.getItem('pendingChat'));
    if (pendingChat) {
        // امسح الأمر حتى لا يتكرر
        localStorage.removeItem('pendingChat');
        // انتظر قليلاً لتحميل الصفحة ثم افتح الشات
        setTimeout(() => startChat(pendingChat), 500);
    }

    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onValue(usersRef, (snapshot) => {
        userListContainer.innerHTML = ""; 
        const users = snapshot.val();
        const myName = localStorage.getItem('hobbyName');
        Object.values(users).forEach(user => {
            if (user.name === myName) return; 
            const isOnline = (Date.now() - (user.lastActive || 0)) < 180000;
            const levelClass = getLevelClass(user.xp || 0);
            userListContainer.innerHTML += `
                <div class="user-item" onclick='startChat(${JSON.stringify(user)})' style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                    <div class="avatar-wrapper ${levelClass}" onclick="event.stopPropagation(); visitUserProfile('${user.name}', '${user.img||DEFAULT_IMG}')">
                         <img src="${user.img || DEFAULT_IMG}" class="user-avatar-small" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
                    </div>
                    <div class="user-item-info">
                        <h4 style="margin:0;">${user.name}</h4>
                        <div style="display:flex; align-items:center; margin-top:2px;"><span class="user-status-indicator ${isOnline ? "status-online" : "status-offline"}"></span><span class="status-text">${isOnline ? "متصل" : "غير متصل"}</span></div>
                    </div>
                </div>
            `;
        });
    });
}

// دالة بدء المحادثة
let currentChatPartner = null;
window.startChat = function(user) {
    currentChatPartner = user.name;
    if(window.innerWidth <= 768) { if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none'; if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex'; }
    
    const hName = document.getElementById('chatHeaderName');
    const hImg = document.getElementById('chatHeaderImg');
    hName.innerText = user.name;
    hImg.src = user.img || DEFAULT_IMG;
    hName.onclick = () => visitUserProfile(user.name, user.img||DEFAULT_IMG);
    hImg.onclick = () => visitUserProfile(user.name, user.img||DEFAULT_IMG);
    
    // الرتبة في الهيدر
    const levelClass = getLevelClass(user.xp || 0);
    const w = document.getElementById('chatHeaderImgWrapper');
    if(w) w.className = `avatar-wrapper ${levelClass}`;

    if(document.getElementById('inputArea')) document.getElementById('inputArea').style.display = 'flex';
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages'); msgContainer.innerHTML = "";
    
    // تحميل الرسائل
    onChildAdded(query(ref(db, 'chats/' + chatId), limitToLast(50)), (s) => {
        const msg = s.val();
        const div = document.createElement('div');
        div.className = `message ${msg.sender === localStorage.getItem('hobbyName') ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        div.style.padding="8px"; div.style.margin="5px"; div.style.borderRadius="10px";
        div.style.background = msg.sender === localStorage.getItem('hobbyName') ? "#4CAF50" : "#ddd";
        div.style.alignSelf = msg.sender === localStorage.getItem('hobbyName') ? "flex-end" : "flex-start";
        div.style.color = msg.sender === localStorage.getItem('hobbyName') ? "#fff" : "#000";
        msgContainer.appendChild(div); msgContainer.scrollTop = msgContainer.scrollHeight;
    });
}
window.sendChatMessage = function() { const inp = document.getElementById('msgInput'); const txt = inp.value; if(!txt || !currentChatPartner) return; const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_"); push(ref(db, 'chats/' + chatId), { sender: localStorage.getItem('hobbyName'), text: txt, timestamp: serverTimestamp() }); const receiverSafe = getSafeName(currentChatPartner); push(ref(db, `notifications/${receiverSafe}`), { senderName: localStorage.getItem('hobbyName'), senderImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG, text: txt, type: 'message', timestamp: serverTimestamp() }); inp.value=""; }
window.backToUsers = function() { document.getElementById('usersList').style.display = 'block'; document.getElementById('chatArea').style.display = 'none'; }

// دوال المنشورات والتعليقات
// (تم اختصارها هنا لعدم تغييرها - هي نفسها النسخة السابقة، ركزنا على المشاكل الجديدة)
// ... (افترض وجود دوال createCommentHTML, loadCommentsForPost, getPostHTML هنا كما هي) ...
// لتوفير المساحة، انسخ دوال المنشورات من الرد السابق، وسأركز هنا على الدوال التي أصلحتها.

window.voteComment = function(postId, commentId, type, isReply, parentId) { /* ... نفس الكود السابق ... */ } 
window.toggleReplyBox = function(postId, commentId) { const box = document.getElementById(`reply-box-${commentId}`); if(box) box.classList.toggle('active'); }
window.prepareReplyToReply = function(postId, parentId, authorName) { const box = document.getElementById(`reply-box-${parentId}`); if(box) { box.classList.add('active'); const input = document.getElementById(`reply-input-${parentId}`); if(input) { input.value = `@${authorName} `; input.focus(); } } }
window.sendReply = function(postId, commentId) { /* ... نفس الكود السابق ... */ }

// 🔥 الإصلاح 3: دالة زيارة البروفايل (مع حفظ البيانات)
window.visitUserProfile = function(name, img) { 
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG })); 
    window.location.href = 'profile-view.html'; 
}

// 🔥 الإصلاح 3: دالة العودة لبروفايلي الشخصي
window.visitMyProfile = function() { 
    // نقوم بتحديث viewingProfile ليكون "أنا" بدلاً من "آخر شخص زرته"
    localStorage.setItem('viewingProfile', JSON.stringify({ 
        name: localStorage.getItem('hobbyName'), 
        img: localStorage.getItem('hobbyImage') || DEFAULT_IMG
    })); 
    window.location.href = 'profile-view.html'; 
}

// 🔥 الإصلاح 2: إرسال رسالة من البروفايل
window.messageFromProfile = function(n, i) { 
    // نحفظ بيانات الشخص المستهدف في الذاكرة
    localStorage.setItem('pendingChat', JSON.stringify({name: n, img: i})); 
    // نذهب لصفحة الرسائل
    window.location.href = 'messages.html'; 
}

// البروفايل (عرض)
if(document.getElementById('profileContent')) { 
    const v = JSON.parse(localStorage.getItem('viewingProfile'));
    const m = localStorage.getItem('hobbyName'); 
    
    if(v) onValue(ref(db, `users/${getSafeName(v.name)}`), s => { 
        const u = s.val()||{}; 
        document.getElementById('p-name').innerText = u.name || v.name; 
        document.getElementById('p-img').src = u.img || v.img || DEFAULT_IMG; 
        document.getElementById('p-bio').innerText = u.bio || "لا توجد نبذة"; 
        
        const ci = document.getElementById('profile-cover-img');
        if(u.coverImg){ ci.src=u.coverImg; ci.style.display='block'; } else ci.style.display='none';

        const levelClass = getLevelClass(u.xp || 0);
        const w = document.getElementById('p-img-wrapper'); if(w) w.className = `profile-avatar-large-wrapper ${levelClass}`;

        const d = document.getElementById('profileActionsBtns'); d.innerHTML = ""; 
        if(v.name === m) { 
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display='flex'; 
            if(document.getElementById('edit-cover-icon')) document.getElementById('edit-cover-icon').style.display='flex';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display='inline-block';
            if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display='inline-block';
            d.innerHTML = `<button class="action-btn-profile btn-message" onclick="location.href='settings.html'"><i class="fas fa-cog"></i> الإعدادات</button>`; 
        } else { 
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display='none'; 
            if(document.getElementById('edit-cover-icon')) document.getElementById('edit-cover-icon').style.display='none';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display='none';
            if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display='none';
            d.innerHTML = `<button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${v.name}')">متابعة</button><button class="action-btn-profile btn-message" onclick="messageFromProfile('${v.name}','${u.img||DEFAULT_IMG}')">مراسلة</button>`; 
            onValue(ref(db, `users/${getSafeName(m)}/following/${getSafeName(v.name)}`), s => { const b = document.getElementById('followBtn'); if(b) { if(s.exists()){ b.innerHTML='<i class="fas fa-check"></i> أتابعه'; b.classList.add('following'); } else { b.innerHTML='<i class="fas fa-user-plus"></i> متابعة'; b.classList.remove('following'); } } }); 
        } 
        onValue(ref(db, `users/${getSafeName(v.name)}/followers`), s => document.getElementById('p-followers-count').innerText = s.size); 
        onValue(ref(db, `users/${getSafeName(v.name)}/following`), s => document.getElementById('p-following-count').innerText = s.size); 
        
        // المنشورات
        const pc = document.getElementById('profilePostsContainer');
        if (pc) onValue(postsRef, (sn) => {
            pc.innerHTML=""; let c=0; let arr=[];
            sn.forEach(ch => { const p=ch.val(); if(p.author===v.name){ c++; arr.push({id:ch.key, data:p}); } });
            document.getElementById('p-posts-count').innerText = c;
            if(arr.length>0) arr.reverse().forEach(i => { pc.innerHTML += getPostHTML(i.data, i.id); loadCommentsForPost(i.id); });
            else pc.innerHTML = `<p style="text-align:center; color:gray; padding:20px;">لا توجد منشورات.</p>`;
        });
    }); 
}

// دالة المتابعة (تم تصحيحها لتعمل مع القواعد الجديدة)
window.toggleFollow = function(t) { 
    const m = getSafeName(localStorage.getItem('hobbyName')); 
    const target = getSafeName(t); 
    const ref1 = ref(db, `users/${m}/following/${target}`); 
    const ref2 = ref(db, `users/${target}/followers/${m}`); 
    get(ref1).then(s => { 
        if(s.exists()){ remove(ref1); remove(ref2); } 
        else { set(ref1, true); set(ref2, true); } 
    }); 
}

// الدوال المساعدة الباقية (موجودة سابقاً)
window.logout = function() { if(confirm("خروج؟")) { localStorage.clear(); signOut(auth).then(() => { window.location.href = 'index.html'; }); } }
window.togglePostMenu = function(id) { document.getElementById(`menu-${id}`).classList.toggle('active'); }
window.hidePost = function(id) { document.getElementById(`post-card-${id}`).style.display='none'; }
window.deletePost = function(id) { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)); }
window.toggleComments = function(id) { document.getElementById(`comments-section-${id}`).classList.toggle('active'); }
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }
window.uploadNewProfileImg = async function() { const f = document.getElementById('profileImgInput').files[0]; if(f) { const u = await uploadToBunny(f); if(u) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {img:u}).then(()=>{localStorage.setItem('hobbyImage', u); alert("تم!");}); } }
window.editProfileName = function() { const n = prompt("الاسم الجديد:"); if(n) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {name:n}).then(()=>{localStorage.setItem('hobbyName', n); location.reload();}); }
window.openEditModal = function(t) { if(t==='bio'){ document.getElementById('editProfileModal').style.display='flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; }}
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display='none'; }
window.saveProfileChanges = function() { update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {bio:document.getElementById('editBioInput').value}).then(()=>window.closeEditModal()); }
window.toggleLike = function(postId, postAuthor) { const uid = getSafeName(localStorage.getItem('hobbyName')); runTransaction(ref(db, `posts/${postId}`), (p) => { if(p) { if(!p.likedBy) p.likedBy={}; if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } else { p.likes++; p.likedBy[uid]=true; } } return p; }); }
// دالة عرض المنشور (مختصرة - تأكد من وجود createCommentHTML و loadCommentsForPost)
// ... (أضف getPostHTML هنا إذا لم تكن موجودة) ...
window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
