/* --- main.js: النسخة النهائية (صورة افتراضية جديدة + إصلاح الرسائل) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// مفتاح ImgBB الخاص بك
const IMGBB_API_KEY = "340c983156e536035bd7806ebdf2c56c"; 

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

// اسم الصورة الافتراضية الجديد (تأكد أنك رفعتها بهذا الاسم)
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

// --- وظيفة رفع الصور ---
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await response.json();
        if (data.success) return data.data.url;
        else { alert("خطأ من ImgBB: " + (data.error ? data.error.message : "غير معروف")); return null; }
    } catch (error) { alert("فشل الاتصال برفع الصور"); return null; }
}

// --- إنشاء بطاقة المنشور ---
function createPostCard(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    let isLiked = (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]);
    const activeClass = isLiked ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-card-${postId}`;
    
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

    card.innerHTML = `
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
        <div id="comments-section-${postId}" class="comments-section"><div class="comments-list"></div><div class="comment-input-area"><input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً..."><button onclick="sendComment('${postId}', '${safeAuthor}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button></div></div>
    `;
    
    onChildAdded(ref(db, `posts/${postId}/comments`), (snap) => {
        const c = snap.val();
        const cSafe = c.author.replace(/'/g, "\\'");
        const list = card.querySelector('.comments-list');
        const cImg = c.authorImg || DEFAULT_IMG;
        if(list) list.innerHTML += `<div class="comment-item"><img src="${cImg}" class="comment-avatar" loading="lazy" onclick="visitUserProfile('${cSafe}','${cImg}')"><div class="comment-content"><span class="comment-author" onclick="visitUserProfile('${cSafe}','${cImg}')">${c.author}</span><span>${c.text}</span></div></div>`;
    });

    return card;
}

// --- عرض المنشورات ---
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 
    setTimeout(() => { const l = document.getElementById('pageLoader'); if(l) l.style.display = 'none'; }, 2000);

    let firstLoad = true;
    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => {
        if(firstLoad) { const l = document.getElementById('pageLoader'); if(l) l.style.display = 'none'; firstLoad = false; }
        container.prepend(createPostCard(snapshot.val(), snapshot.key)); 
    });
}

if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    container.innerHTML = "";
    onChildAdded(postsRef, (snapshot) => {
        if (snapshot.val().author === viewingName) container.prepend(createPostCard(snapshot.val(), snapshot.key));
    });
}

// =========================================================
// 🔥 قسم الرسائل (يستخدم الصورة الافتراضية الجديدة) 🔥
// =========================================================
let currentChatPartner = null;

if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        if (user.name === localStorage.getItem('hobbyName')) return;
        
        userListContainer.innerHTML += `
            <div class="user-item" onclick='startChat(${JSON.stringify(user)})' style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <img src="${user.img || DEFAULT_IMG}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                <div class="user-item-info">
                    <h4 style="margin:0;">${user.name}</h4>
                    <span style="font-size:12px; color:gray;">اضغط للمراسلة</span>
                </div>
            </div>
        `;
    });
    
    const pendingChat = localStorage.getItem('pendingChat');
    if (pendingChat) {
        const user = JSON.parse(pendingChat);
        setTimeout(() => { startChat(user); localStorage.removeItem('pendingChat'); }, 500);
    }
}

window.startChat = function(user) {
    currentChatPartner = user.name;
    if(window.innerWidth <= 768) {
        if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none';
        if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex';
    }
    const headerName = document.getElementById('chatHeaderName');
    const headerImg = document.getElementById('chatHeaderImg');
    if(headerName) {
        headerName.innerText = user.name;
        headerName.onclick = () => window.visitUserProfile(user.name, user.img || DEFAULT_IMG);
    }
    if(headerImg) headerImg.src = user.img || DEFAULT_IMG;
    if(document.getElementById('inputArea')) document.getElementById('inputArea').style.display = 'flex';

    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages');
    if(msgContainer) {
        msgContainer.innerHTML = "";
        onChildAdded(query(ref(db, 'chats/' + chatId), limitToLast(50)), (snapshot) => {
            const msg = snapshot.val();
            const div = document.createElement('div');
            div.className = `message ${msg.sender === localStorage.getItem('hobbyName') ? 'sent' : 'received'}`;
            div.style.padding = "8px 12px";
            div.style.margin = "5px";
            div.style.borderRadius = "10px";
            div.style.maxWidth = "70%";
            div.style.backgroundColor = msg.sender === localStorage.getItem('hobbyName') ? "#4CAF50" : "#ddd";
            div.style.color = msg.sender === localStorage.getItem('hobbyName') ? "#fff" : "#000";
            div.style.alignSelf = msg.sender === localStorage.getItem('hobbyName') ? "flex-end" : "flex-start";
            div.innerText = msg.text;
            msgContainer.appendChild(div);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
    }
}

window.sendChatMessage = function() {
    const input = document.getElementById('msgInput');
    const txt = input.value;
    if(!txt || !currentChatPartner) return;
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    push(ref(db, 'chats/' + chatId), { 
        sender: localStorage.getItem('hobbyName'), 
        text: txt, timestamp: serverTimestamp() 
    }).then(() => { input.value = ""; });
}

window.backToUsers = function() {
    if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'block';
    if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'none';
}


// --- الوظائف العامة ---
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
            fileUrl = await uploadToImgBB(file);
            if (!fileUrl) { if(btn) { btn.innerText = "نشر"; btn.disabled = false; } return; }
        } else { alert("الفيديو غير مدعوم مباشرة"); if(btn) { btn.innerText = "نشر"; btn.disabled = false; } return; }
    }

    push(postsRef, {
        title: title || "بدون عنوان", content: content || "", postImg: fileUrl,
        author: localStorage.getItem('hobbyName'), authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
        timestamp: serverTimestamp(), likes: 0
    }).then(() => { alert("✅ تم النشر!"); window.closeAddPost(); location.reload(); });
}

window.toggleLike = function(postId, postAuthor) {
    const uid = getSafeName(localStorage.getItem('hobbyName'));
    const btn = document.getElementById(`like-btn-${postId}`);
    const countSpan = btn.querySelector('.like-count');
    let currentCount = parseInt(countSpan.innerText) || 0;
    if (btn.classList.contains('active')) { btn.classList.remove('active'); countSpan.innerText = currentCount > 0 ? currentCount - 1 : 0; } 
    else { btn.classList.add('active'); countSpan.innerText = currentCount + 1; }
    runTransaction(ref(db, `posts/${postId}`), (p) => {
        if(p) { if(!p.likedBy) p.likedBy={}; if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } else { p.likes++; p.likedBy[uid]=true; } } return p;
    });
}

window.visitMyProfile = function() {
    const myName = localStorage.getItem('hobbyName');
    localStorage.setItem('viewingProfile', JSON.stringify({ name: myName, img: localStorage.getItem('hobbyImage')||DEFAULT_IMG, isMe: true }));
    window.location.href = 'profile-view.html';
}
window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img || DEFAULT_IMG, isMe: (name === myName) }));
    window.location.href = 'profile-view.html';
}
window.sendComment = function(postId, postAuthor) {
    const t = document.getElementById(`comment-input-${postId}`).value;
    if(!t) return;
    push(ref(db, `posts/${postId}/comments`), {text:t, author:localStorage.getItem('hobbyName'), authorImg:localStorage.getItem('hobbyImage') || DEFAULT_IMG, timestamp:serverTimestamp()});
}
window.togglePostMenu = function(id) { document.getElementById(`menu-${id}`).classList.toggle('active'); }
window.hidePost = function(id) { document.getElementById(`post-card-${id}`).style.display='none'; }
window.deletePost = function(id) { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)).then(()=>document.getElementById(`post-card-${id}`).remove()); }
window.toggleComments = function(id) { document.getElementById(`comments-section-${id}`).classList.toggle('active'); }
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
window.logout = function() { if(confirm("خروج؟")) { localStorage.clear(); window.location.href = 'index.html'; } }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.addLink = function() { prompt("الرابط:"); }

window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }
window.uploadNewProfileImg = async function() {
    const file = document.getElementById('profileImgInput').files[0];
    if(file) {
        alert("جاري الرفع... ⏳");
        const newUrl = await uploadToImgBB(file);
        if (newUrl) {
            const myName = localStorage.getItem('hobbyName');
            update(ref(db, `users/${getSafeName(myName)}`), { img: newUrl })
            .then(() => { localStorage.setItem('hobbyImage', newUrl); alert("✅ تم التحديث!"); });
        }
    }
}
window.openEditModal = function(type) { if(type === 'bio') { document.getElementById('editProfileModal').style.display = 'flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; } }
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display = 'none'; }
window.saveProfileChanges = function() { const myName = localStorage.getItem('hobbyName'); const newBio = document.getElementById('editBioInput').value; update(ref(db, `users/${getSafeName(myName)}`), { bio: newBio }).then(() => window.closeEditModal()); }

window.editProfileName = function() {
    const oldName = localStorage.getItem('hobbyName');
    const newName = prompt("أدخل اسمك الجديد:", oldName);
    if (newName && newName !== oldName && newName.trim() !== "") {
        const safeOld = getSafeName(oldName);
        update(ref(db, `users/${safeOld}`), { name: newName })
        .then(() => {
            localStorage.setItem('hobbyName', newName);
            document.getElementById('p-name').innerText = newName;
            alert("تم تغيير الاسم!");
        });
    }
}

// دوال المتابعة والمراسلة
window.toggleFollow = function(targetName) {
    const myName = localStorage.getItem('hobbyName');
    const mySafe = getSafeName(myName);
    const targetSafe = getSafeName(targetName);
    const followingRef = ref(db, `users/${mySafe}/following/${targetSafe}`);
    const followersRef = ref(db, `users/${targetSafe}/followers/${mySafe}`);
    const btn = document.getElementById('followBtn');
    if(btn) {
        if(btn.classList.contains('following')) {
            btn.innerHTML = '<i class="fas fa-user-plus"></i> متابعة';
            btn.classList.remove('following');
        } else {
            btn.innerHTML = '<i class="fas fa-check"></i> أتابعه';
            btn.classList.add('following');
        }
    }
    get(followingRef).then((snapshot) => {
        if (snapshot.exists()) { remove(followingRef); remove(followersRef); } else { set(followingRef, true); set(followersRef, true); }
    });
}
function checkFollowStatus(targetName) {
    const myName = localStorage.getItem('hobbyName');
    onValue(ref(db, `users/${getSafeName(myName)}/following/${getSafeName(targetName)}`), (snap) => {
        const btn = document.getElementById('followBtn');
        if(btn) {
            if (snap.exists()) { btn.innerHTML = '<i class="fas fa-check"></i> أتابعه'; btn.classList.add('following'); } 
            else { btn.innerHTML = '<i class="fas fa-user-plus"></i> متابعة'; btn.classList.remove('following'); }
        }
    });
}
window.messageFromProfile = function(targetName, targetImg) {
    const chatData = { name: targetName, img: targetImg };
    localStorage.setItem('pendingChat', JSON.stringify(chatData));
    window.location.href = 'messages.html';
}
function loadProfileStats(targetName) {
    const safeTarget = getSafeName(targetName);
    onValue(ref(db, `users/${safeTarget}/followers`), (snap) => document.getElementById('p-followers-count').innerText = snap.size);
    onValue(ref(db, `users/${safeTarget}/following`), (snap) => document.getElementById('p-following-count').innerText = snap.size);
}

if (document.getElementById('profileContent')) {
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    const myName = localStorage.getItem('hobbyName');
    if (viewingData) {
        onValue(ref(db, `users/${getSafeName(viewingData.name)}`), (snapshot) => {
            const userData = snapshot.val() || {};
            const finalImg = userData.img || viewingData.img;
            document.getElementById('p-name').innerText = userData.name || viewingData.name;
            document.getElementById('p-img').src = finalImg || DEFAULT_IMG;
            document.getElementById('p-bio').innerText = userData.bio || "لا توجد نبذة";
            
            const actionsDiv = document.getElementById('profileActionsBtns');
            actionsDiv.innerHTML = "";
            
            if (viewingData.name === myName) {
                 if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex';
                 if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block';
                 if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'inline-block';
                 actionsDiv.innerHTML = `<button class="action-btn-profile btn-message" onclick="location.href='settings.html'"><i class="fas fa-cog"></i> الإعدادات</button>`;
            } else {
                if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none';
                if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none';
                if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'none';
                actionsDiv.innerHTML = `
                    <button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${viewingData.name}')"><i class="fas fa-user-plus"></i> متابعة</button>
                    <button class="action-btn-profile btn-message" onclick="messageFromProfile('${viewingData.name}', '${finalImg}')"><i class="far fa-envelope"></i> مراسلة</button>
                `;
                checkFollowStatus(viewingData.name);
            }
        });
        loadProfileStats(viewingData.name);
    }
}

window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
