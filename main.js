/* --- main.js: نسخة السرعة القصوى (Local Cache + Bunny CDN) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// إعدادات Bunny (للرفع)
const BUNNY_STORAGE_NAME = "hooby"; 
const BUNNY_API_KEY = "ce4c08e4-41a1-477f-a163d4a0cfcc-315f-4508";
const BUNNY_CDN_URL = "https://hooby.b-cdn.net"; 

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

// 1. الأمان والتحقق
function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    if (path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html')) return;
    if (!isLoggedIn) window.location.href = 'index.html';
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
// 🚀 وظيفة الرفع (Bunny.net)
// =========================================================
async function uploadToBunny(file) {
    const fileName = Date.now() + "_" + file.name.replace(/\s/g, "_");
    const uploadUrl = `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`;
    try {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' },
            body: file
        });
        if (response.ok) {
            return `${BUNNY_CDN_URL}/${fileName}`;
        } else {
            alert("فشل الرفع، تأكد من إعدادات Bunny");
            return null;
        }
    } catch (error) { alert("خطأ في الاتصال"); return null; }
}

// =========================================================
// 📱 نظام العرض الذكي (Cache System)
// =========================================================

// 1. دالة لإنشاء HTML البطاقة
function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    let isLiked = (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]);
    const activeClass = isLiked ? 'active' : '';

    let mediaHTML = "";
    if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }

    let contentHTML = post.content;
    if (post.content && (post.content.includes('youtube.com') || post.content.includes('youtu.be'))) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
        const match = post.content.match(youtubeRegex);
        if (match && match[1]) {
            mediaHTML += `<iframe loading="lazy" style="width:100%; height:250px; border-radius:10px; margin-top:10px;" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
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
                    <img src="logo.png" class="efada-icon"><span>إفادة</span><span class="like-count">${post.likes||0}</span>
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

// 2. دالة لجلب التعليقات لكل منشور (تنفصل عن الكاش لتخفيف الحجم)
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

// 3. المنطق الرئيسي للعرض (Cache-First Strategy)
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    const CACHE_KEY = 'cached_posts_v1';
    
    // أ) عرض البيانات المخزنة فوراً (إذا وجدت)
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const postsArray = JSON.parse(cachedData);
        container.innerHTML = ""; // تنظيف
        // إخفاء اللودر فوراً لأننا عرضنا بيانات
        const loader = document.getElementById('pageLoader');
        if(loader) loader.style.display = 'none';
        
        postsArray.forEach(item => {
            container.innerHTML += getPostHTML(item.data, item.id);
            // تحميل التعليقات في الخلفية
            setTimeout(() => loadCommentsForPost(item.id), 100);
        });
        console.log("تم تحميل البيانات من الكاش ⚡");
    }

    // ب) جلب البيانات الحديثة من الإنترنت وتحديث الكاش
    onValue(query(postsRef, limitToLast(20)), (snapshot) => {
        const data = snapshot.val();
        if(!data) {
             const l = document.getElementById('pageLoader'); if(l) l.style.display = 'none';
             if(!cachedData) container.innerHTML = "<p style='text-align:center; padding:20px'>لا توجد منشورات بعد.</p>";
             return;
        }

        // تحويل البيانات لمصفوفة لترتيبها
        const postsArray = Object.entries(data).map(([key, val]) => ({ id: key, data: val })).reverse();
        
        // حفظ في الكاش للمرة القادمة
        localStorage.setItem(CACHE_KEY, JSON.stringify(postsArray));

        // تحديث الواجهة (نعيد رسمها بالبيانات الجديدة)
        container.innerHTML = "";
        const loader = document.getElementById('pageLoader');
        if(loader) loader.style.display = 'none';

        postsArray.forEach(item => {
            container.innerHTML += getPostHTML(item.data, item.id);
            loadCommentsForPost(item.id);
        });
        console.log("تم تحديث البيانات من السيرفر 🌐");
    });
}

// عرض منشورات البروفايل (بدون كاش حالياً للتبسيط)
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    
    container.innerHTML = "";
    // نستخدم onValue هنا أيضاً لترتيبها
    onValue(query(postsRef, limitToLast(50)), (snapshot) => {
        container.innerHTML = "";
        const data = snapshot.val();
        if(data) {
            const postsArray = Object.entries(data).map(([key, val]) => ({ id: key, data: val })).reverse();
            postsArray.forEach(item => {
                if(item.data.author === viewingName) {
                    container.innerHTML += getPostHTML(item.data, item.id);
                    loadCommentsForPost(item.id);
                }
            });
        }
    });
}


// =========================================================
// 🔥 باقي الوظائف (الرسائل، الرفع، التفاعل) كما هي 🔥
// =========================================================

// الرفع باستخدام Bunny
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 

    if(!title && !content) { alert("اكتب شيئاً!"); return; }
    if(btn) { btn.innerText = "جاري النشر... ⏳"; btn.disabled = true; }

    let fileUrl = "";
    if (file) {
        if(file.type.startsWith('image/')) {
            fileUrl = await uploadToBunny(file);
            if (!fileUrl) { if(btn) { btn.innerText = "نشر"; btn.disabled = false; } return; }
        } else { alert("الفيديو غير مدعوم مباشرة"); if(btn) { btn.innerText = "نشر"; btn.disabled = false; } return; }
    }

    push(postsRef, {
        title: title || "بدون عنوان", content: content || "", postImg: fileUrl,
        author: localStorage.getItem('hobbyName'), authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
        timestamp: serverTimestamp(), likes: 0
    }).then(() => { alert("✅ تم النشر!"); window.closeAddPost(); location.reload(); });
}

// الرسائل
if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        if (user.name === localStorage.getItem('hobbyName')) return;
        userListContainer.innerHTML += `
            <div class="user-item" onclick='startChat(${JSON.stringify(user)})' style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <img src="${user.img || DEFAULT_IMG}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                <div class="user-item-info"><h4 style="margin:0;">${user.name}</h4><span style="font-size:12px; color:gray;">اضغط للمراسلة</span></div>
            </div>
        `;
    });
}
// (باقي كود الدردشة والوظائف العامة... سأختصره هنا لأنه لم يتغير، ولكن تأكد من نسخه من الردود السابقة إذا فقدته)
// ... [انسخ دوال startChat, sendChatMessage, toggleLike, visitProfile, etc. من الكود السابق] ...
// سأعيد كتابة الدوال الأساسية هنا لضمان عمل الملف بالكامل:

let currentChatPartner = null;
window.startChat = function(user) {
    currentChatPartner = user.name;
    if(window.innerWidth <= 768) {
        if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none';
        if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex';
    }
    document.getElementById('chatHeaderName').innerText = user.name;
    document.getElementById('chatHeaderImg').src = user.img || DEFAULT_IMG;
    if(document.getElementById('inputArea')) document.getElementById('inputArea').style.display = 'flex';
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages');
    msgContainer.innerHTML = "";
    onChildAdded(query(ref(db, 'chats/' + chatId), limitToLast(50)), (s) => {
        const msg = s.val();
        const div = document.createElement('div');
        div.className = `message ${msg.sender === localStorage.getItem('hobbyName') ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        div.style.padding="8px"; div.style.margin="5px"; div.style.borderRadius="10px";
        div.style.background = msg.sender === localStorage.getItem('hobbyName') ? "#4CAF50" : "#ddd";
        div.style.alignSelf = msg.sender === localStorage.getItem('hobbyName') ? "flex-end" : "flex-start";
        div.style.color = msg.sender === localStorage.getItem('hobbyName') ? "#fff" : "#000";
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });
}
window.sendChatMessage = function() {
    const inp = document.getElementById('msgInput'); if(!inp.value || !currentChatPartner) return;
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    push(ref(db, 'chats/' + chatId), { sender: localStorage.getItem('hobbyName'), text: inp.value, timestamp: serverTimestamp() }).then(()=>inp.value="");
}
window.backToUsers = function() {
    document.getElementById('usersList').style.display = 'block';
    document.getElementById('chatArea').style.display = 'none';
}

window.toggleLike = function(postId, postAuthor) {
    const uid = getSafeName(localStorage.getItem('hobbyName'));
    const btn = document.getElementById(`like-btn-${postId}`);
    const countSpan = btn.querySelector('.like-count');
    let c = parseInt(countSpan.innerText)||0;
    if(btn.classList.contains('active')){ btn.classList.remove('active'); countSpan.innerText = c>0?c-1:0; } else { btn.classList.add('active'); countSpan.innerText = c+1; }
    runTransaction(ref(db, `posts/${postId}`), (p) => {
        if(p) { if(!p.likedBy) p.likedBy={}; if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } else { p.likes++; p.likedBy[uid]=true; } } return p;
    });
}
window.visitUserProfile = function(name, img) {
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG, isMe: (name===localStorage.getItem('hobbyName')) }));
    window.location.href = 'profile-view.html';
}
window.visitMyProfile = function() { window.visitUserProfile(localStorage.getItem('hobbyName'), localStorage.getItem('hobbyImage')); }
window.togglePostMenu = function(id) { document.getElementById(`menu-${id}`).classList.toggle('active'); }
window.hidePost = function(id) { document.getElementById(`post-card-${id}`).style.display='none'; }
window.deletePost = function(id) { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)); }
window.toggleComments = function(id) { document.getElementById(`comments-section-${id}`).classList.toggle('active'); }
window.sendComment = function(postId, postAuthor) {
    const t = document.getElementById(`comment-input-${postId}`).value; if(!t) return;
    push(ref(db, `posts/${postId}/comments`), {text:t, author:localStorage.getItem('hobbyName'), authorImg:localStorage.getItem('hobbyImage')||DEFAULT_IMG});
}
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
window.logout = function() { if(confirm("خروج؟")) { localStorage.clear(); window.location.href = 'index.html'; } }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }
window.uploadNewProfileImg = async function() {
    const f = document.getElementById('profileImgInput').files[0]; if(f) {
        alert("جاري الرفع..."); const url = await uploadToBunny(f);
        if(url) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {img:url}).then(()=>{localStorage.setItem('hobbyImage', url); alert("تم!");});
    }
}
window.editProfileName = function() {
    const n = prompt("الاسم الجديد:"); if(n) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {name:n}).then(()=>{localStorage.setItem('hobbyName', n); location.reload();});
}
window.openEditModal = function(t) { if(t==='bio'){ document.getElementById('editProfileModal').style.display='flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; }}
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display='none'; }
window.saveProfileChanges = function() { update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {bio:document.getElementById('editBioInput').value}).then(()=>window.closeEditModal()); }
// منطق البروفايل والأزرار
window.toggleFollow = function(t) {
    const m = getSafeName(localStorage.getItem('hobbyName')), target = getSafeName(t);
    const ref1 = ref(db, `users/${m}/following/${target}`), ref2 = ref(db, `users/${target}/followers/${m}`);
    get(ref1).then(s => { if(s.exists()){ remove(ref1); remove(ref2); } else { set(ref1, true); set(ref2, true); } });
}
window.messageFromProfile = function(n, i) { localStorage.setItem('pendingChat', JSON.stringify({name:n, img:i})); location.href='messages.html'; }
if(document.getElementById('profileContent')) {
    const v = JSON.parse(localStorage.getItem('viewingProfile')), m = localStorage.getItem('hobbyName');
    if(v) onValue(ref(db, `users/${getSafeName(v.name)}`), s => {
        const u = s.val()||{};
        document.getElementById('p-name').innerText = u.name||v.name;
        document.getElementById('p-img').src = u.img||v.img||DEFAULT_IMG;
        document.getElementById('p-bio').innerText = u.bio||"لا توجد نبذة";
        const d = document.getElementById('profileActionsBtns'); d.innerHTML="";
        if(v.name===m) {
             if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex';
             if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block';
             if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'inline-block';
             d.innerHTML = `<button class="action-btn-profile btn-message" onclick="location.href='settings.html'"><i class="fas fa-cog"></i> الإعدادات</button>`;
        } else {
             if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none';
             if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none';
             if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'none';
             d.innerHTML = `<button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${v.name}')">متابعة</button><button class="action-btn-profile btn-message" onclick="messageFromProfile('${v.name}','${u.img||DEFAULT_IMG}')">مراسلة</button>`;
             onValue(ref(db, `users/${getSafeName(m)}/following/${getSafeName(v.name)}`), s => {
                 const b = document.getElementById('followBtn'); if(b) { if(s.exists()){ b.innerHTML='<i class="fas fa-check"></i> أتابعه'; b.classList.add('following'); } else { b.innerHTML='<i class="fas fa-user-plus"></i> متابعة'; b.classList.remove('following'); } }
             });
        }
        onValue(ref(db, `users/${getSafeName(v.name)}/followers`), s => document.getElementById('p-followers-count').innerText = s.size);
        onValue(ref(db, `users/${getSafeName(v.name)}/following`), s => document.getElementById('p-following-count').innerText = s.size);
    });
}
window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
