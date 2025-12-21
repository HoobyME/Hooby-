/* --- main.js: النسخة الشاملة والنهائية --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

// 1. الأمان
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
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        update(ref(db, 'users/' + getSafeName(myName)), { 
            name: myName, img: myImg, lastActive: serverTimestamp() 
        });
    }
}
registerUserPresence();


// =========================================================
// 2. منطق البروفايل والأقلام (Profile Logic)
// =========================================================
if (document.getElementById('profileContent')) {
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    const myName = localStorage.getItem('hobbyName');
    
    if (viewingData) {
        const userRef = ref(db, `users/${getSafeName(viewingData.name)}`);
        
        onValue(userRef, (snapshot) => {
            const userData = snapshot.val() || {};
            const finalImg = userData.img || viewingData.img;
            const finalBio = userData.bio || "لا توجد نبذة شخصية.";

            document.getElementById('p-name').innerText = viewingData.name;
            document.getElementById('p-img').src = finalImg;
            document.getElementById('p-bio').innerText = finalBio;
            
            const actionsDiv = document.getElementById('profileActionsBtns');
            actionsDiv.innerHTML = "";

            // التحكم في الأيقونات
            if (viewingData.name === myName) {
                // أنا: أظهر الأقلام
                document.getElementById('edit-img-icon').style.display = 'flex';
                document.getElementById('edit-name-icon').style.display = 'inline-block';
                document.getElementById('edit-bio-icon').style.display = 'inline-block';
            } else {
                // شخص آخر: أخفِ الأقلام وأظهر أزرار المتابعة
                document.getElementById('edit-img-icon').style.display = 'none';
                document.getElementById('edit-name-icon').style.display = 'none';
                document.getElementById('edit-bio-icon').style.display = 'none';
                
                const followBtn = document.createElement('button');
                followBtn.id = 'followBtn';
                followBtn.className = 'action-btn-profile btn-follow';
                followBtn.innerText = 'متابعة';
                followBtn.onclick = () => toggleFollow(viewingData.name);
                
                const msgBtn = document.createElement('button');
                msgBtn.className = 'action-btn-profile btn-message';
                msgBtn.innerHTML = '<i class="far fa-envelope"></i> مراسلة';
                msgBtn.onclick = () => messageFromProfile(viewingData.name, finalImg);
                
                actionsDiv.appendChild(followBtn);
                actionsDiv.appendChild(msgBtn);
                
                checkFollowStatus(viewingData.name);
            }
        });
        loadProfileStats(viewingData.name);
    }
}

// دوال التعديل
window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }

window.uploadNewProfileImg = function() {
    const file = document.getElementById('profileImgInput').files[0];
    if(file) {
        if(file.size > 1024*1024) return alert("الصورة كبيرة جداً");
        const reader = new FileReader();
        reader.onload = function(e) {
            const newUrl = e.target.result;
            const myName = localStorage.getItem('hobbyName');
            update(ref(db, `users/${getSafeName(myName)}`), { img: newUrl })
            .then(() => {
                localStorage.setItem('hobbyImage', newUrl); 
                alert("تم تحديث الصورة!");
            });
        };
        reader.readAsDataURL(file);
    }
}

window.openEditModal = function(type) {
    if(type === 'bio') {
        document.getElementById('editProfileModal').style.display = 'flex';
        document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText;
    }
}
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display = 'none'; }

window.saveProfileChanges = function() {
    const myName = localStorage.getItem('hobbyName');
    const newBio = document.getElementById('editBioInput').value;
    update(ref(db, `users/${getSafeName(myName)}`), { bio: newBio }).then(() => {
        window.closeEditModal();
    });
}


// =========================================================
// 3. التنقل والوظائف العامة
// =========================================================
window.visitMyProfile = function() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    const myProfileData = { name: myName, img: myImg, isMe: true };
    localStorage.setItem('viewingProfile', JSON.stringify(myProfileData));
    window.location.href = 'profile-view.html';
}

window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    const isMe = (name === myName);
    const profileData = { name: name, img: img || "side.png", isMe: isMe };
    localStorage.setItem('viewingProfile', JSON.stringify(profileData));
    window.location.href = 'profile-view.html';
}

window.messageFromProfile = function(targetName, targetImg) {
    const chatData = { name: targetName, img: targetImg };
    localStorage.setItem('pendingChat', JSON.stringify(chatData));
    window.location.href = 'messages.html';
}

// =========================================================
// 4. المتابعة والإحصائيات
// =========================================================
window.toggleFollow = function(targetName) {
    const myName = localStorage.getItem('hobbyName');
    const mySafe = getSafeName(myName);
    const targetSafe = getSafeName(targetName);
    const followingRef = ref(db, `users/${mySafe}/following/${targetSafe}`);
    const followersRef = ref(db, `users/${targetSafe}/followers/${mySafe}`);
    
    get(followingRef).then((snapshot) => {
        if (snapshot.exists()) {
            remove(followingRef); remove(followersRef);
        } else {
            set(followingRef, true); set(followersRef, true);
            sendNotification(targetName, 'follow', null);
        }
    });
}
function checkFollowStatus(targetName) {
    const myName = localStorage.getItem('hobbyName');
    onValue(ref(db, `users/${getSafeName(myName)}/following/${getSafeName(targetName)}`), (snap) => {
        const btn = document.getElementById('followBtn');
        if(btn) {
            if (snap.exists()) { btn.innerText = "أتابعه"; btn.classList.add('following'); }
            else { btn.innerText = "متابعة"; btn.classList.remove('following'); }
        }
    });
}
function loadProfileStats(targetName) {
    const safeTarget = getSafeName(targetName);
    onValue(ref(db, `users/${safeTarget}/followers`), (snap) => document.getElementById('p-followers-count').innerText = snap.size);
    onValue(ref(db, `users/${safeTarget}/following`), (snap) => document.getElementById('p-following-count').innerText = snap.size);
}
function sendNotification(toUser, type, postId) {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if (!toUser || toUser === myName) return;
    push(ref(db, `notifications/${getSafeName(toUser)}`), {
        fromName: myName, fromImg: myImg, type: type, postId: postId || "", timestamp: serverTimestamp(), read: false
    });
}


// =========================================================
// 5. المنشورات (Speed Optimized)
// =========================================================
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 
    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => { container.prepend(createPostCard(snapshot.val(), snapshot.key)); });
}
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;
    container.innerHTML = "";
    let postCount = 0;
    onChildAdded(postsRef, (snapshot) => {
        if (snapshot.val().author === viewingName) {
            container.prepend(createPostCard(snapshot.val(), snapshot.key));
            postCount++;
            if(document.getElementById('p-posts-count')) document.getElementById('p-posts-count').innerText = postCount;
        }
    });
}

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

// =========================================================
// 6. الرسائل وبقية الأدوات
// =========================================================
let currentChatPartner = null;
if (window.location.href.includes('messages.html')) {
    const pendingChat = localStorage.getItem('pendingChat');
    if (pendingChat) {
        const user = JSON.parse(pendingChat);
        setTimeout(() => { startChat(user); localStorage.removeItem('pendingChat'); }, 300);
    }
}
if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 
    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        if (user.name === localStorage.getItem('hobbyName')) return;
        userListContainer.innerHTML += `<div class="user-item" onclick='startChat(${JSON.stringify(user)})'><img src="${user.img||'side.png'}"><div class="user-item-info"><h4>${user.name}</h4><span>مراسلة</span></div></div>`;
    });
}
window.startChat = function(user) {
    currentChatPartner = user.name;
    document.getElementById('chatHeaderName').innerText = user.name;
    document.getElementById('chatHeaderImg').src = user.img || 'side.png';
    document.getElementById('chatHeaderName').onclick = () => window.visitUserProfile(user.name, user.img);
    document.getElementById('inputArea').style.display = 'flex';
    if(window.innerWidth <= 600) { document.getElementById('chatArea').classList.add('active'); document.getElementById('usersList').style.display='none'; }
    
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages');
    msgContainer.innerHTML = "";
    onChildAdded(query(ref(db, 'chats/' + chatId), limitToLast(20)), (snapshot) => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        div.className = `message ${msg.sender === localStorage.getItem('hobbyName') ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });
}
window.sendChatMessage = function() {
    const txt = document.getElementById('msgInput').value;
    if(!txt || !currentChatPartner) return;
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    push(ref(db, 'chats/' + chatId), { sender: localStorage.getItem('hobbyName'), text: txt, timestamp: serverTimestamp() }).then(()=>document.getElementById('msgInput').value="");
}

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
