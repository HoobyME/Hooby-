/* --- main.js: النسخة الكاملة (متابعة + مراسلة من البروفايل + تنسيق) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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
// 1. الأمان والوظائف المساعدة
// =========================================================
function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    const userName = localStorage.getItem('hobbyName');
    if (path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html')) return;
    if (!isLoggedIn || !userName || userName === "null") window.location.href = 'index.html';
}
checkAuth(); 

function getSafeName(name) {
    if(!name) return null;
    return name.replace(/[.#$\[\]]/g, "_");
}

function registerUserPresence() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        set(ref(db, 'users/' + getSafeName(myName)), { name: myName, img: myImg, lastActive: serverTimestamp() });
    }
}
registerUserPresence();


// =========================================================
// 2. منطق البروفايل (Profile Logic) - المعدل
// =========================================================

// هذه الدالة تعمل فقط داخل صفحة profile-view.html
if (document.getElementById('profileContent')) {
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    const myName = localStorage.getItem('hobbyName');
    
    if (viewingData) {
        // 1. عرض البيانات الأساسية
        document.getElementById('p-name').innerText = viewingData.name;
        document.getElementById('p-img').src = viewingData.img;
        
        // 2. إعداد الأزرار
        const actionsDiv = document.getElementById('profileActionsBtns');
        actionsDiv.innerHTML = ""; // تنظيف

        if (viewingData.name === myName) {
            // هذا بروفايلي أنا
            actionsDiv.innerHTML = `<button class="action-btn-profile btn-message" onclick="alert('هذا ملفك الشخصي')">تعديل الملف</button>`;
        } else {
            // هذا بروفايل شخص آخر
            // زر المتابعة (سيتم تحديث نصه لاحقاً)
            const followBtn = document.createElement('button');
            followBtn.id = 'followBtn';
            followBtn.className = 'action-btn-profile btn-follow';
            followBtn.innerText = 'متابعة';
            followBtn.onclick = () => toggleFollow(viewingData.name);
            
            // زر المراسلة
            const msgBtn = document.createElement('button');
            msgBtn.className = 'action-btn-profile btn-message';
            msgBtn.innerHTML = '<i class="far fa-envelope"></i> مراسلة';
            msgBtn.onclick = () => messageFromProfile(viewingData.name, viewingData.img);
            
            actionsDiv.appendChild(followBtn);
            actionsDiv.appendChild(msgBtn);
            
            // التحقق من حالة المتابعة
            checkFollowStatus(viewingData.name);
        }

        // 3. تحميل الإحصائيات (عدد المتابعين)
        loadProfileStats(viewingData.name);
    }
}

// دالة المراسلة من البروفايل (تنقلك لصفحة الرسائل)
window.messageFromProfile = function(targetName, targetImg) {
    // نحفظ بيانات الشخص الذي نريد مراسلته
    const chatData = { name: targetName, img: targetImg };
    localStorage.setItem('pendingChat', JSON.stringify(chatData));
    // نذهب لصفحة الرسائل
    window.location.href = 'messages.html';
}

// دالة المتابعة / إلغاء المتابعة
window.toggleFollow = function(targetName) {
    const myName = localStorage.getItem('hobbyName');
    const mySafe = getSafeName(myName);
    const targetSafe = getSafeName(targetName);
    
    const followingRef = ref(db, `users/${mySafe}/following/${targetSafe}`);
    const followersRef = ref(db, `users/${targetSafe}/followers/${mySafe}`);
    
    get(followingRef).then((snapshot) => {
        if (snapshot.exists()) {
            // إلغاء المتابعة
            remove(followingRef);
            remove(followersRef);
            document.getElementById('followBtn').innerText = "متابعة";
            document.getElementById('followBtn').classList.remove('following');
        } else {
            // متابعة
            set(followingRef, true);
            set(followersRef, true);
            document.getElementById('followBtn').innerText = "أتابعه";
            document.getElementById('followBtn').classList.add('following');
            // إرسال إشعار
            sendNotification(targetName, 'follow', null);
        }
        // تحديث الأرقام
        setTimeout(() => loadProfileStats(targetName), 500);
    });
}

function checkFollowStatus(targetName) {
    const myName = localStorage.getItem('hobbyName');
    const followingRef = ref(db, `users/${getSafeName(myName)}/following/${getSafeName(targetName)}`);
    onValue(followingRef, (snapshot) => {
        const btn = document.getElementById('followBtn');
        if(btn) {
            if (snapshot.exists()) {
                btn.innerText = "أتابعه";
                btn.classList.add('following');
            } else {
                btn.innerText = "متابعة";
                btn.classList.remove('following');
            }
        }
    });
}

function loadProfileStats(targetName) {
    const safeTarget = getSafeName(targetName);
    // عدد المتابعين
    onValue(ref(db, `users/${safeTarget}/followers`), (snap) => {
        document.getElementById('p-followers-count').innerText = snap.size;
    });
    // عدد الذين يتابعهم
    onValue(ref(db, `users/${safeTarget}/following`), (snap) => {
        document.getElementById('p-following-count').innerText = snap.size;
    });
    // (عدد المنشورات يتم حسابه عند تحميل المنشورات)
}


// =========================================================
// 3. منطق الرسائل (Messages Logic)
// =========================================================
let currentChatPartner = null;

// عند فتح صفحة الرسائل، نتحقق هل جئنا من البروفايل؟
if (window.location.href.includes('messages.html')) {
    const pendingChat = localStorage.getItem('pendingChat');
    if (pendingChat) {
        const user = JSON.parse(pendingChat);
        // تأخير بسيط لضمان تحميل الصفحة
        setTimeout(() => {
            startChat(user);
            localStorage.removeItem('pendingChat'); // مسح الأمر
        }, 300);
    }
}

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
    const headerName = document.getElementById('chatHeaderName');
    const headerImg = document.getElementById('chatHeaderImg');
    
    headerName.innerText = user.name;
    headerImg.src = user.img || 'side.png';
    
    headerName.onclick = () => window.visitUserProfile(user.name, user.img);
    headerImg.onclick = () => window.visitUserProfile(user.name, user.img);

    document.getElementById('inputArea').style.display = 'flex';
    const chatArea = document.getElementById('chatArea');
    const userList = document.getElementById('usersList');
    
    // إخفاء القائمة في الجوال وإظهار الشات
    if(window.innerWidth <= 600 && chatArea) { 
        chatArea.classList.add('active'); 
        if(userList) userList.style.display = 'none'; 
    }
    loadMessages();
}

function loadMessages() {
    const myName = localStorage.getItem('hobbyName');
    const partner = currentChatPartner;
    const chatId = [myName, partner].sort().join("_");
    const messagesQuery = query(ref(db, 'chats/' + chatId), limitToLast(20));
    const msgContainer = document.getElementById('chatMessages');
    msgContainer.innerHTML = "";
    
    onChildAdded(messagesQuery, (snapshot) => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        const isMe = msg.sender === myName;
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
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
// 4. منطق الإشعارات والتنقل
// =========================================================
window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    const isMe = (name === myName);
    const profileData = { name: name, img: img || "side.png", isMe: isMe };
    localStorage.setItem('viewingProfile', JSON.stringify(profileData));
    window.location.href = 'profile-view.html';
}
window.visitMyProfile = function() {
    window.visitUserProfile(localStorage.getItem('hobbyName'), localStorage.getItem('hobbyImage'));
}

function sendNotification(toUser, type, postId) {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if (!toUser || toUser === myName) return;
    const safeToUser = getSafeName(toUser);
    push(ref(db, `notifications/${safeToUser}`), {
        fromName: myName, fromImg: myImg, type: type, postId: postId || "", timestamp: serverTimestamp(), read: false
    });
}

if (document.getElementById('notificationsList')) {
    const container = document.getElementById('notificationsList');
    const myName = localStorage.getItem('hobbyName');
    if (myName) {
        const notifQuery = query(ref(db, `notifications/${getSafeName(myName)}`), limitToLast(10));
        let isFirst = true;
        onChildAdded(notifQuery, (snapshot) => {
            if(isFirst) { container.innerHTML = ""; isFirst = false; }
            const notif = snapshot.val();
            const div = document.createElement('div');
            div.className = 'notification-item';
            div.onclick = () => window.visitUserProfile(notif.fromName, notif.fromImg);
            
            let icon = '', text = '';
            if (notif.type === 'like') { icon = '<i class="fas fa-heart" style="color:#4CAF50;"></i>'; text = `قام <strong>${notif.fromName}</strong> بإفادة منشورك.`; } 
            else if (notif.type === 'comment') { icon = '<i class="fas fa-comment" style="color:#2196F3;"></i>'; text = `علق <strong>${notif.fromName}</strong> على منشورك.`; }
            else if (notif.type === 'follow') { icon = '<i class="fas fa-user-plus" style="color:#FF9800;"></i>'; text = `بدأ <strong>${notif.fromName}</strong> بمتابعتك.`; }

            div.innerHTML = `<img src="${notif.fromImg}" class="notif-img"><div class="notif-content"><p class="notif-text">${text}</p><span class="notif-time">جديد</span></div>${icon}`;
            container.prepend(div);
        });
        setTimeout(() => { if(isFirst) container.innerHTML = '<div class="empty-state">لا توجد إشعارات جديدة</div>'; }, 3000);
    }
}


// =========================================================
// 5. المنشورات (Posts)
// =========================================================
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 
    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => {
        container.prepend(createPostCard(snapshot.val(), snapshot.key));
    });
}
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    container.innerHTML = "";
    
    let postCount = 0;
    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        if (post.author === viewingName) {
            container.prepend(createPostCard(post, snapshot.key));
            postCount++;
            if(document.getElementById('p-posts-count')) document.getElementById('p-posts-count').innerText = postCount;
        }
    });
}

// دالة بناء البطاقة (مختصرة للنسخ)
function createPostCard(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author.replace(/'/g, "\\'");
    let isLiked = (post.likedBy && post.likedBy[getSafeName(myName)]);
    
    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-card-${postId}`;
    
    let imgHTML = post.postImg && post.postImg.length > 20 ? `<img src="${post.postImg}" style="width:100%; border-radius:10px; margin-top:10px;">` : '';
    let delHTML = (post.author === myName) ? `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorImg}" class="user-avatar-small" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer">
            <div class="user-info-text" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer"><h4>${post.author}</h4><span>الآن</span></div>
            <div class="options-btn" onclick="togglePostMenu('${postId}')"><i class="fas fa-ellipsis-h"></i></div>
            <div id="menu-${postId}" class="options-menu"><div class="menu-option" onclick="hidePost('${postId}')">إخفاء</div>${delHTML}</div>
        </div>
        <div class="post-body"><h3>${post.title}</h3><p>${post.content}</p>${imgHTML}</div>
        <div class="post-actions">
            <div id="like-btn-${postId}" class="action-btn ${isLiked?'active':''}" onclick="toggleLike('${postId}', '${safeAuthor}')"><img src="logo.png" class="efada-icon"><span>إفادة</span><span class="like-count">${post.likes||0}</span></div>
            <div class="action-btn" onclick="toggleComments('${postId}')"><i class="far fa-comment"></i> تعليق</div>
        </div>
        <div id="comments-section-${postId}" class="comments-section"><div class="comments-list"></div><div class="comment-input-area"><input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً..."><button onclick="sendComment('${postId}', '${safeAuthor}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button></div></div>
    `;
    onChildAdded(ref(db, `posts/${postId}/comments`), (snap) => {
        const c = snap.val();
        const cSafe = c.author.replace(/'/g, "\\'");
        card.querySelector('.comments-list').innerHTML += `<div class="comment-item"><img src="${c.authorImg}" class="comment-avatar" onclick="visitUserProfile('${cSafe}','${c.authorImg}')"><div class="comment-content"><span class="comment-author" onclick="visitUserProfile('${cSafe}','${c.authorImg}')">${c.author}</span><span>${c.text}</span></div></div>`;
    });
    return card;
}

// الوظائف المساعدة
window.saveNewPost = function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    if(!title || !content) { alert("أدخل البيانات"); return; }
    const send = (url) => {
        push(postsRef, {title, content, postImg: url||"", author: localStorage.getItem('hobbyName'), authorImg: localStorage.getItem('hobbyImage')||"side.png", timestamp: serverTimestamp(), likes:0}).then(()=>{window.closeAddPost(); location.reload();});
    };
    if(file) { const r = new FileReader(); r.onload=e=>send(e.target.result); r.readAsDataURL(file); } else send(null);
}

window.toggleLike = function(postId, postAuthor) {
    const uid = getSafeName(localStorage.getItem('hobbyName'));
    runTransaction(ref(db, `posts/${postId}`), (p) => {
        if(p) { if(!p.likedBy) p.likedBy={}; if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; } else { p.likes++; p.likedBy[uid]=true; } } return p;
    }).then(() => { if(postAuthor) sendNotification(postAuthor, 'like', postId); });
}
window.sendComment = function(postId, postAuthor) {
    const t = document.getElementById(`comment-input-${postId}`).value;
    if(!t) return;
    push(ref(db, `posts/${postId}/comments`), {text:t, author:localStorage.getItem('hobbyName'), authorImg:localStorage.getItem('hobbyImage'), timestamp:serverTimestamp()}).then(()=>{ if(postAuthor) sendNotification(postAuthor, 'comment', postId); });
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
window.addHashtagInput = function() { document.getElementById('postHashtags').style.display = 'block'; }
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.addLink = function() { prompt("الرابط:"); }

window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
