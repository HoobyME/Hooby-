/* --- main.js: النسخة المتطورة (شريط تقدم + إشعارات داخلية) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// إعدادات Bunny
const BUNNY_STORAGE_NAME = "hooby"; 
const BUNNY_API_KEY = "ce4c08e4-41a1-477f-a163d4a0cfcc-315f-4508"; 
const BUNNY_CDN_URL = "https://hooby.b-cdn.net"; 

// إعدادات Bunny Stream
const STREAM_LIB_ID = "569937";
const STREAM_API_KEY = "670a82d3-2783-45cb-a97fe91e960a-c972-4f1a";

const firebaseConfig = {
  apiKey: "AIzaSyBIVXdGJ09zgMxg4WaGU9vbvICY6JURqDM",
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

// --- التحقق والأمان ---
function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    const isLoginPage = path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html') || path.endsWith('/');
    
    if (isLoggedIn) {
        if (isLoginPage) window.location.href = 'home.html';
        requestNotificationPermission();
        monitorNotifications();
        
        // إذا فتحنا صفحة الرسائل، نخفي النقطة الحمراء
        if (path.includes('messages.html')) {
            localStorage.setItem('hasUnreadMessages', 'false');
        }
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
        update(ref(db, 'users/' + getSafeName(myName)), { 
            name: myName, img: myImg, lastActive: serverTimestamp() 
        });
    }
}
registerUserPresence();

// =========================================================
// 🚀 وظائف الرفع المتقدمة (مع شريط التقدم XHR)
// =========================================================

// دالة مساعدة لتحديث واجهة شريط التقدم
function updateProgressBar(percent) {
    const overlay = document.getElementById('uploadProgressOverlay');
    const fill = document.getElementById('progressBarFill');
    const text = document.getElementById('progressText');
    
    if (overlay) {
        overlay.style.display = 'flex'; // إظهار النافذة
        fill.style.width = percent + '%';
        text.innerText = `جاري الرفع: ${Math.round(percent)}%`;
    }
}

// إخفاء شريط التقدم
function hideProgressBar() {
    const overlay = document.getElementById('uploadProgressOverlay');
    if (overlay) overlay.style.display = 'none';
}

// دالة رفع عامة تدعم التقدم (XHR)
function uploadWithProgress(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        
        // إضافة الهيدرز
        for (const [key, value] of Object.entries(headers)) {
            xhr.setRequestHeader(key, value);
        }

        // متابعة التقدم
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgressBar(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText || '{}')); // Bunny أحيانا يرجع JSON وأحيانا لا
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(body);
    });
}

// 1. رفع صورة (Bunny Storage) مع التقدم
async function uploadToBunny(file) {
    const fileName = Date.now() + "_" + file.name.replace(/\s/g, "_");
    const uploadUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`;
    
    try {
        await uploadWithProgress(uploadUrl, 'PUT', { 
            'AccessKey': BUNNY_API_KEY, 
            'Content-Type': 'application/octet-stream' 
        }, file);
        return `${BUNNY_CDN_URL}/${fileName}`;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// 2. رفع فيديو (Bunny Stream) مع التقدم
async function uploadVideoToBunnyStream(file) {
    try {
        // خطوة 1: إنشاء الفيديو (سريع جداً لا يحتاج تقدم)
        const createUrl = `https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos`;
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: { 'AccessKey': STREAM_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: file.name })
        });
        if (!createRes.ok) throw new Error("فشل إنشاء الفيديو");
        const videoData = await createRes.json();
        const videoId = videoData.guid;

        // خطوة 2: رفع الفيديو الفعلي (هنا نحتاج التقدم)
        const uploadUrl = `https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos/${videoId}`;
        await uploadWithProgress(uploadUrl, 'PUT', { 'AccessKey': STREAM_API_KEY }, file);

        return `https://iframe.mediadelivery.net/embed/${STREAM_LIB_ID}/${videoId}`;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// =========================================================
// 🔔 نظام الإشعارات (صوت + نقطة حمراء)
// =========================================================

function requestNotificationPermission() { if ("Notification" in window) { Notification.requestPermission(); } }

function showSystemNotification(sender, message, img) {
    // 1. تشغيل الصوت
    NOTIFICATION_SOUND.play().catch(e => {});
    
    // 2. إشعار المتصفح
    if (Notification.permission === "granted") {
        const notif = new Notification(`رسالة من ${sender}`, { body: message, icon: img || DEFAULT_IMG });
        notif.onclick = function() { window.focus(); window.location.href = 'messages.html'; };
    }

    // 3. 🔥 إظهار النقطة الحمراء داخل التطبيق 🔥
    const badge = document.getElementById('msgBadge');
    if (badge && !window.location.href.includes('messages.html')) {
        badge.classList.add('active');
        localStorage.setItem('hasUnreadMessages', 'true');
    }
}

function monitorNotifications() {
    const mySafeName = getSafeName(localStorage.getItem('hobbyName'));
    if (!mySafeName) return;
    
    // استرجاع حالة النقطة الحمراء من الذاكرة (إذا حدثت الصفحة)
    if (localStorage.getItem('hasUnreadMessages') === 'true') {
        const badge = document.getElementById('msgBadge');
        if(badge) badge.classList.add('active');
    }

    const notifRef = ref(db, `notifications/${mySafeName}`);
    onChildAdded(query(notifRef, limitToLast(1)), (snapshot) => {
        const data = snapshot.val();
        const now = Date.now();
        // إذا الإشعار جديد (وصل الآن)
        if (data.timestamp && (now - data.timestamp < 10000)) {
            if (currentChatPartner !== data.senderName) { 
                showSystemNotification(data.senderName, data.text, data.senderImg); 
            }
        }
    });
}


// =========================================================
// 📱 عرض المنشورات
// =========================================================

function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    let isLiked = (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]);
    const activeClass = isLiked ? 'active' : '';

    let mediaHTML = "";
    if (post.postImg && post.postImg.includes("iframe.mediadelivery.net")) {
        mediaHTML = `<div style="position:relative; padding-top:56.25%; margin-top:10px;"><iframe src="${post.postImg}?autoplay=false" style="border:none; position:absolute; top:0; height:100%; width:100%; border-radius:10px;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen="true"></iframe></div>`;
    } else if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }
    
    let contentHTML = post.content;
    if (post.content && (post.content.includes('youtube.com') || post.content.includes('youtu.be'))) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
        const match = post.content.match(youtubeRegex);
        if (match && match[1]) mediaHTML += `<iframe loading="lazy" style="width:100%; height:250px; border-radius:10px; margin-top:10px;" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe>`;
    }
    let delHTML = (post.author === myName) ? `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';

    return `
        <div class="post-card" id="post-card-${postId}">
            <div class="post-header">
                <img src="${post.authorImg || DEFAULT_IMG}" class="user-avatar-small" loading="lazy" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg || DEFAULT_IMG}')" style="cursor:pointer">
                <div class="user-info-text" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg || DEFAULT_IMG}')" style="cursor:pointer"><h4>${post.author}</h4><span>الآن</span></div>
                <div class="options-btn" onclick="togglePostMenu('${postId}')"><i class="fas fa-ellipsis-h"></i></div>
                <div id="menu-${postId}" class="options-menu"><div class="menu-option" onclick="hidePost('${postId}')">إخفاء</div>${delHTML}</div>
            </div>
            <div class="post-body"><h3>${post.title}</h3><p>${contentHTML}</p>${mediaHTML}</div>
            <div class="post-actions">
                <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}', '${safeAuthor}')">
                    <img src="logo.png" class="efada-icon"><span>إفادة</span><span class="like-count" id="like-count-${postId}">${post.likes||0}</span>
                </div>
                <div class="action-btn" onclick="toggleComments('${postId}')"><i class="far fa-comment"></i> تعليق</div>
            </div>
            <div id="comments-section-${postId}" class="comments-section">
                <div class="comments-list" id="comments-list-${postId}"></div>
                <div class="comment-input-area">
                    <input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً...">
                    <button onclick="sendComment('${postId}', '${safeAuthor}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    `;
}

function loadCommentsForPost(postId) {
    onChildAdded(ref(db, `posts/${postId}/comments`), (snap) => {
        const c = snap.val();
        const list = document.getElementById(`comments-list-${postId}`);
        if(list) {
            const cSafe = c.author.replace(/'/g, "\\'");
            const cImg = c.authorImg || DEFAULT_IMG;
            list.innerHTML += `<div class="comment-item"><img src="${cImg}" class="comment-avatar" loading="lazy" onclick="visitUserProfile('${cSafe}','${cImg}')"><div class="comment-content"><span class="comment-author" onclick="visitUserProfile('${cSafe}','${cImg}')">${c.author}</span><span>${c.text}</span></div></div>`;
        }
    });
}

if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    const loader = document.getElementById('pageLoader');

    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => {
        if(loader) loader.style.display = 'none';
        const post = snapshot.val();
        const cardHTML = getPostHTML(post, snapshot.key);
        container.insertAdjacentHTML('afterbegin', cardHTML);
        loadCommentsForPost(snapshot.key);
    });

    onChildChanged(postsRef, (snapshot) => {
        const post = snapshot.val();
        const postId = snapshot.key;
        const myName = localStorage.getItem('hobbyName');
        const isLiked = (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]);
        const countSpan = document.getElementById(`like-count-${postId}`);
        if(countSpan) countSpan.innerText = post.likes || 0;
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        if(likeBtn) { if(isLiked) likeBtn.classList.add('active'); else likeBtn.classList.remove('active'); }
    });
}

if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    onValue(query(postsRef, limitToLast(50)), (snapshot) => {
        container.innerHTML = "";
        const data = snapshot.val();
        if(data) {
            const postsArray = Object.entries(data).map(([key, val]) => ({ id: key, data: val })).reverse();
            postsArray.forEach(item => { if(item.data.author === viewingName) { container.innerHTML += getPostHTML(item.data, item.id); loadCommentsForPost(item.id); } });
        }
    });
}

// --- زر النشر (يستخدم دالة التقدم الجديدة) ---
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 

    if(!title && !content && !file) { alert("اكتب شيئاً أو اختر ملفاً!"); return; }
    if(btn) { btn.disabled = true; } // نعطل الزر فقط ولا نغير نصه لأن شريط التقدم سيظهر

    let fileUrl = "";
    
    if (file) {
        // سيظهر شريط التقدم تلقائياً داخل هذه الدوال
        if (file.type.startsWith('image/')) {
            fileUrl = await uploadToBunny(file);
        } else if (file.type.startsWith('video/')) {
            fileUrl = await uploadVideoToBunnyStream(file);
        } else {
            alert("نوع الملف غير مدعوم"); hideProgressBar(); if(btn) btn.disabled=false; return;
        }

        if (!fileUrl) { 
            alert("فشل الرفع"); hideProgressBar(); if(btn) btn.disabled=false; return; 
        }
    }

    push(postsRef, {
        title: title || "بدون عنوان", 
        content: content || "", 
        postImg: fileUrl, 
        author: localStorage.getItem('hobbyName'), 
        authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
        timestamp: serverTimestamp(), likes: 0
    }).then(() => { 
        hideProgressBar(); // إخفاء الشريط عند الانتهاء
        alert("✅ تم النشر!"); 
        window.closeAddPost(); 
        location.reload(); 
    });
}


// --- باقي الوظائف ---
window.logout = function() {
    if(confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        localStorage.removeItem('hobbyLoggedIn');
        localStorage.removeItem('hobbyName');
        localStorage.removeItem('hobbyImage');
        signOut(auth).then(() => { window.location.href = 'index.html'; }).catch(() => { window.location.href = 'index.html'; });
    }
}
if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        if (user.name === localStorage.getItem('hobbyName')) return;
        userListContainer.innerHTML += `<div class="user-item" onclick='startChat(${JSON.stringify(user)})' style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;"><img src="${user.img || DEFAULT_IMG}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;"><div class="user-item-info"><h4 style="margin:0;">${user.name}</h4><span style="font-size:12px; color:gray;">اضغط للمراسلة</span></div></div>`;
    });
}
let currentChatPartner = null;
window.startChat = function(user) {
    currentChatPartner = user.name;
    if(window.innerWidth <= 768) { if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none'; if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex'; }
    document.getElementById('chatHeaderName').innerText = user.name;
    document.getElementById('chatHeaderImg').src = user.img || DEFAULT_IMG;
    if(document.getElementById('inputArea')) document.getElementById('inputArea').style.display = 'flex';
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages'); msgContainer.innerHTML = "";
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
window.toggleLike = function(postId, postAuthor) { const uid = getSafeName(localStorage.getItem('hobbyName')); const btn = document.getElementById(`like-btn-${postId}`); const countSpan = document.getElementById(`like-count-${postId}`); let c = parseInt(countSpan.innerText)||0; if(btn.classList.contains('active')){ btn.classList.remove('active'); countSpan.innerText = c>0?c-1:0; } else { btn.classList.add('active'); countSpan.innerText = c+1; } runTransaction(ref(db, `posts/${postId}`), (p) => { if(p) { if(!p.likedBy) p.likedBy={}; if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } else { p.likes++; p.likedBy[uid]=true; } } return p; }); }
window.visitUserProfile = function(name, img) { localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG, isMe: (name===localStorage.getItem('hobbyName')) })); window.location.href = 'profile-view.html'; }
window.visitMyProfile = function() { window.visitUserProfile(localStorage.getItem('hobbyName'), localStorage.getItem('hobbyImage')); }
window.togglePostMenu = function(id) { document.getElementById(`menu-${id}`).classList.toggle('active'); }
window.hidePost = function(id) { document.getElementById(`post-card-${id}`).style.display='none'; }
window.deletePost = function(id) { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)); }
window.toggleComments = function(id) { document.getElementById(`comments-section-${id}`).classList.toggle('active'); }
window.sendComment = function(postId, postAuthor) { const t = document.getElementById(`comment-input-${postId}`).value; if(!t) return; push(ref(db, `posts/${postId}/comments`), {text:t, author:localStorage.getItem('hobbyName'), authorImg:localStorage.getItem('hobbyImage')||DEFAULT_IMG}); }
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }
window.uploadNewProfileImg = async function() { const f = document.getElementById('profileImgInput').files[0]; if(f) { alert("جاري الرفع..."); const url = await uploadToBunny(f); if(url) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {img:url}).then(()=>{localStorage.setItem('hobbyImage', url); alert("تم!");}); } }
window.editProfileName = function() { const n = prompt("الاسم الجديد:"); if(n) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {name:n}).then(()=>{localStorage.setItem('hobbyName', n); location.reload();}); }
window.openEditModal = function(t) { if(t==='bio'){ document.getElementById('editProfileModal').style.display='flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; }}
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display='none'; }
window.saveProfileChanges = function() { update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {bio:document.getElementById('editBioInput').value}).then(()=>window.closeEditModal()); }
window.toggleFollow = function(t) { const m = getSafeName(localStorage.getItem('hobbyName')), target = getSafeName(t); const ref1 = ref(db, `users/${m}/following/${target}`), ref2 = ref(db, `users/${target}/followers/${m}`); get(ref1).then(s => { if(s.exists()){ remove(ref1); remove(ref2); } else { set(ref1, true); set(ref2, true); } }); }
window.messageFromProfile = function(n, i) { localStorage.setItem('pendingChat', JSON.stringify({name:n, img:i})); location.href='messages.html'; }
if(document.getElementById('profileContent')) { const v = JSON.parse(localStorage.getItem('viewingProfile')), m = localStorage.getItem('hobbyName'); if(v) onValue(ref(db, `users/${getSafeName(v.name)}`), s => { const u = s.val()||{}; document.getElementById('p-name').innerText = u.name||v.name; document.getElementById('p-img').src = u.img||v.img||DEFAULT_IMG; document.getElementById('p-bio').innerText = u.bio||"لا توجد نبذة"; const d = document.getElementById('profileActionsBtns'); d.innerHTML=""; if(v.name===m) { if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex'; if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block'; if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'inline-block'; d.innerHTML = `<button class="action-btn-profile btn-message" onclick="location.href='settings.html'"><i class="fas fa-cog"></i> الإعدادات</button>`; } else { if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none'; if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none'; if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'none'; d.innerHTML = `<button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${v.name}')">متابعة</button><button class="action-btn-profile btn-message" onclick="messageFromProfile('${v.name}','${u.img||DEFAULT_IMG}')">مراسلة</button>`; onValue(ref(db, `users/${getSafeName(m)}/following/${getSafeName(v.name)}`), s => { const b = document.getElementById('followBtn'); if(b) { if(s.exists()){ b.innerHTML='<i class="fas fa-check"></i> أتابعه'; b.classList.add('following'); } else { b.innerHTML='<i class="fas fa-user-plus"></i> متابعة'; b.classList.remove('following'); } } }); } onValue(ref(db, `users/${getSafeName(v.name)}/followers`), s => document.getElementById('p-followers-count').innerText = s.size); onValue(ref(db, `users/${getSafeName(v.name)}/following`), s => document.getElementById('p-following-count').innerText = s.size); }); }
window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
