/* --- main.js: شامل (شات + منشورات + إشعارات + حذف وإخفاء) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, serverTimestamp, runTransaction, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// =========================================================
// 1. الأمان
// =========================================================
function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    const userName = localStorage.getItem('hobbyName');
    if (path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html')) return;
    if (!isLoggedIn || !userName || userName === "null") window.location.href = 'index.html';
}
checkAuth(); 

function registerUserPresence() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        const safeName = myName.replace(/[.#$\[\]]/g, "_");
        set(ref(db, 'users/' + safeName), { name: myName, img: myImg, lastActive: serverTimestamp() });
    }
}
registerUserPresence();
function getSafeUserId() {
    let name = localStorage.getItem('hobbyName');
    if(!name) return null;
    return name.replace(/[.#$\[\]]/g, "_");
}


// =========================================================
// 2. حذف وإخفاء المنشورات (NEW)
// =========================================================

// إظهار/إخفاء قائمة الخيارات
window.togglePostMenu = function(postId) {
    const menu = document.getElementById(`menu-${postId}`);
    if(menu) {
        // إغلاق أي قائمة أخرى مفتوحة
        document.querySelectorAll('.options-menu').forEach(m => {
            if(m.id !== `menu-${postId}`) m.classList.remove('active');
        });
        menu.classList.toggle('active');
    }
}

// إخفاء المنشور (محلياً فقط)
window.hidePost = function(postId) {
    const card = document.getElementById(`post-card-${postId}`);
    if(card) {
        card.style.display = 'none';
        alert("تم إخفاء المنشور من واجهتك.");
    }
}

// حذف المنشور (من قاعدة البيانات)
window.deletePost = function(postId) {
    if(confirm("هل أنت متأكد من حذف هذا المنشور نهائياً؟ لا يمكن التراجع.")) {
        remove(ref(db, `posts/${postId}`))
        .then(() => {
            alert("تم الحذف بنجاح.");
            const card = document.getElementById(`post-card-${postId}`);
            if(card) card.remove(); // إزالة من الشاشة فوراً
        })
        .catch(err => alert("خطأ: " + err.message));
    }
}


// =========================================================
// 3. الإشعارات والرسائل
// =========================================================
function sendNotification(toUser, type, postId) {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if (!toUser || toUser === myName) return;
    const safeToUser = toUser.replace(/[.#$\[\]]/g, "_");
    push(ref(db, `notifications/${safeToUser}`), {
        fromName: myName, fromImg: myImg, type: type, postId: postId, timestamp: serverTimestamp(), read: false
    });
}

if (document.getElementById('notificationsList')) {
    const container = document.getElementById('notificationsList');
    const myName = localStorage.getItem('hobbyName');
    if (myName) {
        const safeName = myName.replace(/[.#$\[\]]/g, "_");
        let isFirst = true;
        onChildAdded(ref(db, `notifications/${safeName}`), (snapshot) => {
            if(isFirst) { container.innerHTML = ""; isFirst = false; }
            const notif = snapshot.val();
            const div = document.createElement('div');
            div.className = 'notification-item';
            let icon = '', text = '';
            if (notif.type === 'like') { icon = '<i class="fas fa-heart" style="color:#4CAF50;"></i>'; text = `قام <strong>${notif.fromName}</strong> بإفادة منشورك.`; } 
            else if (notif.type === 'comment') { icon = '<i class="fas fa-comment" style="color:#2196F3;"></i>'; text = `علق <strong>${notif.fromName}</strong> على منشورك.`; }
            div.innerHTML = `<img src="${notif.fromImg}" class="notif-img"><div class="notif-content"><p class="notif-text">${text}</p><span class="notif-time">جديد</span></div>${icon}`;
            container.prepend(div);
        });
        setTimeout(() => { if(isFirst) container.innerHTML = '<div class="empty-state">لا توجد إشعارات جديدة</div>'; }, 3000);
    }
}


// =========================================================
// 4. الدردشة
// =========================================================
let currentChatPartner = null;
if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        const myName = localStorage.getItem('hobbyName');
        if (user.name === myName) return;
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => startChat(user);
        div.innerHTML = `<img src="${user.img || 'side.png'}"><div class="user-item-info"><h4>${user.name}</h4><span>اضغط للمراسلة</span></div>`;
        userListContainer.appendChild(div);
    });
}
window.startChat = function(user) {
    currentChatPartner = user.name;
    document.getElementById('chatHeaderName').innerText = user.name;
    document.getElementById('chatHeaderImg').src = user.img || 'side.png';
    document.getElementById('inputArea').style.display = 'flex';
    document.getElementById('chatMessages').innerHTML = ""; 
    const chatArea = document.getElementById('chatArea');
    const userList = document.getElementById('usersList');
    if(window.innerWidth <= 600 && chatArea) { chatArea.classList.add('active'); if(userList) userList.style.display = 'none'; }
    loadMessages();
}
function loadMessages() {
    const myName = localStorage.getItem('hobbyName');
    const partner = currentChatPartner;
    const chatId = [myName, partner].sort().join("_");
    const messagesRef = ref(db, 'chats/' + chatId);
    document.getElementById('chatMessages').innerHTML = "";
    onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        const isMe = msg.sender === myName;
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        const container = document.getElementById('chatMessages');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });
}
window.sendChatMessage = function() {
    const input = document.getElementById('msgInput');
    const text = input.value;
    const myName = localStorage.getItem('hobbyName');
    if (!text || !currentChatPartner) return;
    const chatId = [myName, currentChatPartner].sort().join("_");
    push(ref(db, 'chats/' + chatId), { sender: myName, text: text, timestamp: serverTimestamp() }).then(() => { input.value = ""; });
}


// =========================================================
// 5. المنشورات والتفاعل
// =========================================================
window.saveNewPost = function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const fileInput = document.getElementById('postImageInput');
    const file = fileInput.files[0]; 
    const authorName = localStorage.getItem('hobbyName');
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";
    if(!title || !content) { alert("اكتب شيئاً!"); return; }
    const sendData = (imageUrl) => {
        push(postsRef, {
            title: title, content: content, postImg: imageUrl || "", author: authorName, authorImg: authorImg, timestamp: serverTimestamp(), likes: 0, likedBy: {}
        }).then(() => {
            alert("✅ تم النشر!"); window.closeAddPost();
            document.getElementById('postTitle').value = ''; document.getElementById('postContent').value = '';
            document.getElementById('postImageInput').value = ''; document.getElementById('imagePreview').style.display = 'none';
        });
    };
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { sendData(e.target.result); };
        reader.readAsDataURL(file);
    } else { sendData(null); }
}

window.toggleLike = function(postId, postAuthor) {
    const userId = getSafeUserId();
    if (!userId) return alert("سجل دخولك!");
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likedBy) post.likedBy = {};
            if (post.likedBy[userId]) { post.likes--; post.likedBy[userId] = null; }
            else { post.likes++; post.likedBy[userId] = true; }
        }
        return post;
    }).then(() => {
        const btn = document.getElementById(`like-btn-${postId}`);
        let isLiked = false;
        if(btn) {
            btn.classList.toggle('active');
            const countSpan = btn.querySelector('.like-count');
            let current = parseInt(countSpan.innerText);
            if(btn.classList.contains('active')) { countSpan.innerText = current+1; isLiked = true; }
            else { countSpan.innerText = current-1; }
        }
        if (isLiked && postAuthor) sendNotification(postAuthor, 'like', postId);
    });
}
window.sendComment = function(postId, postAuthor) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    const authorName = localStorage.getItem('hobbyName');
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";
    if(!text) return;
    push(ref(db, `posts/${postId}/comments`), { text: text, author: authorName, authorImg: authorImg, timestamp: serverTimestamp() }).then(() => {
        input.value = "";
        if(postAuthor) sendNotification(postAuthor, 'comment', postId);
    });
}
window.toggleComments = function(postId) { const s = document.getElementById(`comments-section-${postId}`); if(s) s.classList.toggle('active'); }


// =========================================================
// 6. عرض البطاقة (createPostCard) - مع خيارات الحذف
// =========================================================
function createPostCard(post, postId) {
    const userId = getSafeUserId();
    const myName = localStorage.getItem('hobbyName'); // اسم المستخدم الحالي
    let isLikedByMe = false;
    if (post.likedBy && userId && post.likedBy[userId]) isLikedByMe = true;
    const activeClass = isLikedByMe ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-card-${postId}`; // معرف للبطاقة لتسهيل الحذف/الإخفاء

    let imageHTML = "";
    if (post.postImg && post.postImg.length > 20) { imageHTML = `<img src="${post.postImg}" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover; display:block;">`; }

    // تحديد ما إذا كنت أنا المالك
    const isOwner = (post.author === myName);
    
    // بناء قائمة الخيارات
    let deleteOptionHTML = '';
    if (isOwner) {
        deleteOptionHTML = `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف المنشور</div>`;
    }

    const optionsMenuHTML = `
        <div class="options-btn" onclick="togglePostMenu('${postId}')"><i class="fas fa-ellipsis-h"></i></div>
        <div id="menu-${postId}" class="options-menu">
            <div class="menu-option" onclick="hidePost('${postId}')"><i class="fas fa-eye-slash"></i> إخفاء المنشور</div>
            ${deleteOptionHTML}
        </div>
    `;

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorImg}" class="user-avatar-small">
            <div class="user-info-text">
                <h4>${post.author}</h4>
                <span>الآن</span>
            </div>
            ${optionsMenuHTML} </div>
        <div class="post-body"><h3>${post.title}</h3><p>${post.content}</p>${imageHTML}</div>
        <div class="post-actions">
            <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}', '${post.author}')"><img src="logo.png" class="efada-icon"><span>إفادة</span><span class="like-count">${post.likes||0}</span></div>
            <div class="action-btn" onclick="toggleComments('${postId}')"><i class="far fa-comment"></i> تعليق</div>
        </div>
        <div id="comments-section-${postId}" class="comments-section"><div class="comments-list"></div><div class="comment-input-area"><input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً..."><button onclick="sendComment('${postId}', '${post.author}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button></div></div>
    `;
    onChildAdded(ref(db, `posts/${postId}/comments`), (snapshot) => {
        const comment = snapshot.val();
        const list = card.querySelector('.comments-list');
        if(list) list.innerHTML += `<div class="comment-item"><img src="${comment.authorImg}" class="comment-avatar"><div class="comment-content"><span class="comment-author">${comment.author}</span><span>${comment.text}</span></div></div>`;
    });
    return card;
}

if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 
    onChildAdded(postsRef, (snapshot) => { container.prepend(createPostCard(snapshot.val(), snapshot.key)); });
}
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    container.innerHTML = "";
    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        if (post.author === viewingName) container.prepend(createPostCard(post, snapshot.key));
    });
}

// أدوات
window.toggleMenu = function() { const s = document.getElementById('sidebar'); if(s) s.classList.toggle('active'); }
window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
window.logout = function() { if(confirm("خروج؟")) { localStorage.clear(); window.location.href = 'index.html'; } }
window.visitMyProfile = function() { localStorage.setItem('viewingProfile', JSON.stringify({ name: localStorage.getItem('hobbyName') || "أنت", img: localStorage.getItem('hobbyImage') || "side.png", isMe: true })); window.location.href = 'profile-view.html'; }
window.openAddPost = function() { document.getElementById('addPostOverlay').style.display = 'flex'; }
window.closeAddPost = function() { document.getElementById('addPostOverlay').style.display = 'none'; }
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.addHashtagInput = function() { document.getElementById('postHashtags').style.display = 'block'; }
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.handleAudioSelect = function() { alert("تم تحديد الملف الصوتي"); }
window.addLink = function() { prompt("أدخل الرابط:"); }

window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
