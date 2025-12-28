/* --- main.js: نسخة الإنقاذ (Clean Stable Version) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =========================================================
// 1. إعدادات BunnyCDN (تم التصحيح: hoooyp)
// =========================================================
const BUNNY_STORAGE_NAME = "hoooyp"; // ✅ الاسم الصحيح
const BUNNY_API_KEY = "1d3c3073-83f3-4e01-9bc3d8159405-255b-442d"; 
const BUNNY_CDN_URL = "https://vz-4ce371e0-da7.b-cdn.net"; 

const STREAM_LIB_ID = "570600";
const STREAM_API_KEY = "d3eab474-337a-4424-bf5f2947347c-d1fa-431c"; 

// =========================================================
// 2. إعدادات Firebase
// =========================================================
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

// =========================================================
// 3. الدوال الأساسية (بدون تعديل)
// =========================================================
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

function getSafeName(name) {
    if(!name) return null;
    return name.replace(/[.#$\[\]]/g, "_");
}

function registerUserPresence() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || DEFAULT_IMG;
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        // نستخدم catch لمنع توقف الموقع في حال حدوث خطأ بسيط
        update(ref(db, 'users/' + getSafeName(myName)), { 
            name: myName, img: myImg, lastActive: serverTimestamp() 
        }).catch(e => console.log("Presence error ignored"));
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
    runTransaction(userRef, (currentXP) => {
        return (currentXP || 0) + amount;
    });
}

// =========================================================
// 4. دالة الرفع (بسيطة ومباشرة لسيرفر بريطانيا)
// =========================================================
function updateProgressBar(percent) {
    const overlay = document.getElementById('uploadProgressOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('progressBarFill').style.width = percent + '%';
        document.getElementById('progressText').innerText = `جاري الرفع: ${Math.round(percent)}%`;
    }
}
function hideProgressBar() { const overlay = document.getElementById('uploadProgressOverlay'); if(overlay) overlay.style.display='none'; }

function uploadWithProgress(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) updateProgressBar((e.loaded / e.total) * 100); };
        xhr.onload = () => { 
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText || '{}'));
            } else {
                reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`));
            }
        };
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(body);
    });
}

async function uploadToBunny(file) {
    // إصلاح مشكلة الأسماء العربية
    const rawName = Date.now() + "_" + file.name.replace(/\s/g, "_");
    const fileName = encodeURIComponent(rawName);

    try {
        console.log("جار الرفع إلى بريطانيا...");
        // نستخدم سيرفر بريطانيا مباشرة لأنه الأفضل للعراق حالياً
        await uploadWithProgress(`https://uk.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`, 'PUT', { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' }, file);
        return `${BUNNY_CDN_URL}/${rawName}`;
    } catch (e) {
        console.error("فشل الرفع:", e);
        // إذا فشل، جرب نيويورك
        try {
            console.log("تجربة نيويورك...");
            await uploadWithProgress(`https://ny.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`, 'PUT', { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' }, file);
            return `${BUNNY_CDN_URL}/${rawName}`;
        } catch (e2) {
             throw new Error("فشل الرفع. تأكد من الانترنت أو شغل VPN.");
        }
    }
}

async function uploadVideoToBunnyStream(file) {
    try {
        const createRes = await fetch(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos`, { 
            method: 'POST', 
            headers: { 'AccessKey': STREAM_API_KEY, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ title: file.name }) 
        });
        if (!createRes.ok) throw new Error("Video Create Failed");
        const vid = (await createRes.json()).guid;
        await uploadWithProgress(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos/${vid}`, 'PUT', { 'AccessKey': STREAM_API_KEY }, file);
        return `https://iframe.mediadelivery.net/embed/${STREAM_LIB_ID}/${vid}`;
    } catch (e) { console.error(e); throw e; }
}

// =========================================================
// 5. دالة النشر (محمية من الأخطاء)
// =========================================================
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 
    
    if(!title && !content && !file) { alert("اكتب شيئاً!"); return; }

    if(btn) { btn.disabled = true; btn.innerText = "جاري النشر..."; }

    let fileUrl = "";
    
    try {
        if (file) {
            if (file.type.startsWith('image/')) fileUrl = await uploadToBunny(file);
            else if (file.type.startsWith('video/')) fileUrl = await uploadVideoToBunnyStream(file);
        }

        const myName = localStorage.getItem('hobbyName');
        const safeName = getSafeName(myName);
        
        // جلب XP بأمان
        let currentXP = 0;
        try {
            const xpSnap = await get(ref(db, `users/${safeName}/xp`));
            currentXP = xpSnap.val() || 0;
        } catch(e) { console.log("XP fetch failed, ignoring"); }
        
        addXP(myName, 10); 
        
        await push(postsRef, {
            title: title || "بدون عنوان", 
            content: content || "", 
            postImg: fileUrl,
            author: myName, 
            authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
            authorXP: currentXP + 10,
            timestamp: serverTimestamp(), 
            likes: 0
        });

        hideProgressBar(); 
        alert("✅ تم!"); 
        window.closeAddPost(); 
        location.reload();

    } catch (error) {
        hideProgressBar();
        alert("خطأ: " + error.message);
        if(btn) { btn.disabled = false; btn.innerText = "نشر"; }
    }
}

// =========================================================
// 6. باقي وظائف العرض (بدون تعديل)
// =========================================================
onValue(usersRef, (snapshot) => {
    const users = snapshot.val();
    if (!users) return;
    const userListContainer = document.getElementById('usersList');
    if (userListContainer) {
        userListContainer.innerHTML = ""; 
        const myName = localStorage.getItem('hobbyName');
        Object.values(users).forEach(user => {
            if (user.name === myName) return; 
            const isOnline = (Date.now() - (user.lastActive || 0)) < 180000;
            const levelClass = getLevelClass(user.xp || 0);
            userListContainer.innerHTML += `
                <div class="user-item" onclick='startChat(${JSON.stringify(user)})' style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                    <div class="avatar-wrapper ${levelClass}">
                         <img src="${user.img || DEFAULT_IMG}" class="user-avatar-small" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">
                    </div>
                    <div class="user-item-info">
                        <h4 style="margin:0;">${user.name}</h4>
                        <div style="display:flex; align-items:center; margin-top:2px;"><span class="user-status-indicator ${isOnline ? "status-online" : "status-offline"}"></span><span class="status-text">${isOnline ? "متصل" : "غير متصل"}</span></div>
                    </div>
                </div>`;
        });
    }
    Object.values(users).forEach(user => { userXPCache[user.name] = user.xp || 0; });
});

function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    let isLiked = (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]);
    const activeClass = isLiked ? 'active' : '';

    let mediaHTML = "";
    if (post.postImg && post.postImg.includes("iframe.mediadelivery.net")) {
        mediaHTML = `<div style="position:relative; padding-top:56.25%; margin-top:10px;"><iframe src="${post.postImg}?autoplay=false" style="border:none; position:absolute; top:0; height:100%; width:100%; border-radius:10px;" allowfullscreen></iframe></div>`;
    } else if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }

    return `
        <div class="post-card" id="post-card-${postId}">
            <div class="post-header">
                <div class="avatar-wrapper ${getLevelClass(userXPCache[post.author]||0)}" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg || DEFAULT_IMG}')">
                    <img src="${post.authorImg || DEFAULT_IMG}" class="user-avatar-small" loading="lazy">
                </div>
                <div class="user-info-text"><h4>${post.author}</h4><span>${timeAgo(post.timestamp)}</span></div>
            </div>
            <div class="post-body"><h3>${post.title}</h3><p>${post.content}</p>${mediaHTML}</div>
            <div class="post-actions">
                <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}', '${safeAuthor}')">
                    <span>إفادة</span> <span id="like-count-${postId}">${post.likes||0}</span>
                </div>
            </div>
        </div>`;
}

if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => {
        const post = snapshot.val();
        container.insertAdjacentHTML('afterbegin', getPostHTML(post, snapshot.key));
    });
}

// الدوال المساعدة (تفاعلات المستخدم)
window.logout = function() { localStorage.clear(); location.href='index.html'; }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.toggleLike = function(postId) { 
    const uid = getSafeName(localStorage.getItem('hobbyName')); 
    runTransaction(ref(db, `posts/${postId}`), (p) => { 
        if(p) { 
            if(!p.likedBy) p.likedBy={}; 
            if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } 
            else { p.likes++; p.likedBy[uid]=true; } 
        } 
        return p; 
    }); 
}
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.visitUserProfile = function(name, img) { localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG })); window.location.href = 'profile-view.html'; }
window.visitMyProfile = function() { window.visitUserProfile(localStorage.getItem('hobbyName'), localStorage.getItem('hobbyImage')); }

// إعدادات الوضع الليلي
window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
