/* --- main.js: النسخة النهائية الآمنة (Google Auth) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signOut, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =========================================================
// 🔑 الإعدادات (BunnyCDN + Firebase)
// =========================================================
const BUNNY_STORAGE_NAME = "hoooyp"; 
const BUNNY_API_KEY = "1d3c3073-83f3-4e01-9bc3d8159405-255b-442d"; 
const BUNNY_CDN_URL = "https://hoooyp-images.b-cdn.net"; 
const STREAM_LIB_ID = "570600";
const STREAM_API_KEY = "d3eab474-337a-4424-bf5f2947347c-d1fa-431c"; 

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
let currentUserUID = null; // لتخزين معرف المستخدم الحالي

// =========================================================
// 🔐 نظام الدخول الآمن (Google Auth)
// =========================================================

// مراقبة حالة المستخدم (هل هو متصل؟)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUID = user.uid;
        localStorage.setItem('hobbyName', user.displayName);
        localStorage.setItem('hobbyImage', user.photoURL);
        localStorage.setItem('hobbyLoggedIn', 'true');
        
        // إذا كنا في صفحة الدخول، حولنا للرئيسية
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            window.location.href = 'home.html';
        }
        
        // تسجيل التواجد وتحديث البيانات
        registerUserPresence(user);
        monitorNotifications();
    } else {
        // إذا لم يكن متصلاً وكنا في صفحة داخلية، ارجع للدخول
        if (!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
        }
    }
});

// دالة زر الدخول
window.loginWithGoogle = function() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            // النجاح: onAuthStateChanged ستتولى الباقي
            console.log("Logged in:", result.user.displayName);
        }).catch((error) => {
            alert("فشل الدخول: " + error.message);
        });
}

function registerUserPresence(user) {
    if(!user) return;
    const safeName = getSafeName(user.displayName);
    update(ref(db, 'users/' + safeName), { 
        name: user.displayName, 
        img: user.photoURL, 
        uid: user.uid, // ✅ حفظ الـ UID للحماية
        lastActive: serverTimestamp() 
    }).catch(e=>{});
}

// =========================================================
// 🛠️ دوال مساعدة
// =========================================================
function getSafeName(name) {
    if(!name) return "User";
    return name.replace(/[.#$\[\]]/g, "_"); // تنظيف الاسم
}

function formatText(text) {
    if (!text) return "";
    return text.replace(/@([\u0600-\u06FFa-zA-Z0-9._]+)/g, (match, username) => {
        const safeUsername = username.replace(/'/g, "\\'");
        return `<span class="user-mention" onclick="event.stopPropagation(); visitUserProfile('${safeUsername}')">${match}</span>`;
    });
}

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

function sendNotification(targetUser, text, type) {
    const myName = localStorage.getItem('hobbyName');
    if (!targetUser || targetUser === myName) return;
    const safeTarget = getSafeName(targetUser);
    push(ref(db, `notifications/${safeTarget}`), {
        senderName: myName,
        senderImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
        text: text, type: type, timestamp: serverTimestamp()
    });
}

// =========================================================
// 🏆 نظام المستويات
// =========================================================
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

// =========================================================
// 🚀 وظائف الرفع
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
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText||'{}'));
            else reject(new Error(`Server Error: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(body);
    });
}

async function uploadToBunny(file) {
    const rawName = Date.now() + "_" + file.name.replace(/\s/g, "_");
    const fileName = encodeURIComponent(rawName);
    const endpoints = [
        `https://uk.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`,
        `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`,
        `https://ny.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`
    ];
    console.log("جاري الرفع...");
    for (let url of endpoints) {
        try {
            await uploadWithProgress(url, 'PUT', { 'AccessKey': BUNNY_API_KEY, 'Content-Type': 'application/octet-stream' }, file);
            return `${BUNNY_CDN_URL}/${rawName}`;
        } catch (e) { console.warn(`فشل السيرفر ${url}`); }
    }
    throw new Error("فشل الرفع.");
}

async function uploadVideoToBunnyStream(file) {
    try {
        const createRes = await fetch(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos`, { 
            method: 'POST', headers: { 'AccessKey': STREAM_API_KEY, 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ title: file.name }) 
        });
        if (!createRes.ok) throw new Error("Video Create Failed");
        const vid = (await createRes.json()).guid;
        await uploadWithProgress(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos/${vid}`, 'PUT', { 'AccessKey': STREAM_API_KEY }, file);
        return `https://iframe.mediadelivery.net/embed/${STREAM_LIB_ID}/${vid}`;
    } catch (e) { console.error(e); throw e; }
}

// =========================================================
// 🔔 الإشعارات
// =========================================================
function requestNotificationPermission() { if ("Notification" in window) Notification.requestPermission(); }
function showSystemNotification(sender, message, img) {
    NOTIFICATION_SOUND.play().catch(()=>{});
    if (Notification.permission === "granted") {
        const n = new Notification(`رسالة من ${sender}`, { body: message, icon: img || DEFAULT_IMG });
        n.onclick = () => { window.focus(); window.location.href = 'messages.html'; };
    }
    const b = document.getElementById('msgBadge');
    if (b && !window.location.href.includes('messages.html')) { b.classList.add('active'); localStorage.setItem('hasUnreadMessages', 'true'); }
}
function monitorNotifications() {
    const myName = getSafeName(localStorage.getItem('hobbyName'));
    if (!myName) return;
    if (localStorage.getItem('hasUnreadMessages') === 'true') { const b = document.getElementById('msgBadge'); if(b) b.classList.add('active'); }
    onChildAdded(query(ref(db, `notifications/${myName}`), limitToLast(1)), (s) => {
        const d = s.val();
        if (d.timestamp && (Date.now() - d.timestamp < 10000) && currentUserUID !== d.senderUID) showSystemNotification(d.senderName, d.text, d.senderImg);
    });
}

// =========================================================
// 💬 المنشورات
// =========================================================
function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    let isLiked = (post.likedBy && currentUserUID && post.likedBy[currentUserUID]);
    const activeClass = isLiked ? 'active' : '';
    
    // إظهار زر الحذف فقط لصاحب المنشور (بالتحقق من الـ UID)
    let delHTML = (post.authorUID === currentUserUID) ? `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';

    let titleHTML = post.title ? `<h3>${formatText(post.title)}</h3>` : "";
    let contentHTML = formatText(post.content);
    let mediaHTML = "";
    if (post.postImg && post.postImg.includes("iframe.mediadelivery.net")) {
        mediaHTML = `<div style="position:relative; padding-top:56.25%; margin-top:10px;"><iframe src="${post.postImg}?autoplay=false" style="border:none; position:absolute; top:0; height:100%; width:100%; border-radius:10px;" allowfullscreen></iframe></div>`;
    } else if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }

    const currentXP = userXPCache[post.author] || (post.authorXP || 0);
    const levelClass = getLevelClass(currentXP);

    return `
        <div class="post-card" id="post-card-${postId}">
            <div class="post-header">
                <div class="avatar-wrapper ${levelClass}" data-author="${post.author}" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer">
                    <img src="${post.authorImg || DEFAULT_IMG}" class="user-avatar-small" loading="lazy">
                </div>
                <div class="user-info-text" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer">
                    <h4>${post.author}</h4>
                    <span>${timeAgo(post.timestamp)}</span>
                </div>
                <div class="options-btn" onclick="togglePostMenu('${postId}')"><i class="fas fa-ellipsis-h"></i></div>
                <div id="menu-${postId}" class="options-menu"><div class="menu-option" onclick="hidePost('${postId}')">إخفاء</div>${delHTML}</div>
            </div>
            <div class="post-body">${titleHTML}<p>${contentHTML}</p>${mediaHTML}</div>
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

if (document.getElementById('postsContainer')) {
    onChildAdded(query(postsRef, limitToLast(20)), (snapshot) => {
        document.getElementById('pageLoader').style.display = 'none';
        const post = snapshot.val();
        document.getElementById('postsContainer').insertAdjacentHTML('afterbegin', getPostHTML(post, snapshot.key));
        loadCommentsForPost(snapshot.key);
    });
    // Live update for likes
    onChildChanged(postsRef, (snapshot) => {
        const p = snapshot.val();
        const span = document.getElementById(`like-count-${snapshot.key}`);
        if(span) span.innerText = p.likes || 0;
    });
}

// ✅ دالة النشر (ترسل الـ authorUID للحماية)
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 

    if(!title && !content && !file) { alert("ضع صورة أو اكتب كلمة واحدة على الأقل!"); return; }
    if(btn) { btn.disabled = true; btn.innerText = "جاري النشر..."; }

    let fileUrl = "";
    try {
        if (file) {
            if (file.type.startsWith('image/')) fileUrl = await uploadToBunny(file);
            else fileUrl = await uploadVideoToBunnyStream(file);
        }

        const myName = localStorage.getItem('hobbyName');
        const user = auth.currentUser; // المستخدم الحالي من جوجل
        
        // جلب الـ XP
        let currentXP = 0;
        try { const xpSnap = await get(ref(db, `users/${getSafeName(myName)}/xp`)); currentXP = xpSnap.val() || 0; } catch(e){}
        
        await push(postsRef, {
            title: title || "", 
            content: content || "", 
            postImg: fileUrl,
            author: myName, 
            authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
            authorUID: user.uid, // 🛡️ هذا هو المفتاح للحماية!
            authorXP: currentXP + 10,
            timestamp: serverTimestamp(), 
            likes: 0
        });

        addXP(myName, 10);
        hideProgressBar(); 
        alert("✅ تم النشر!"); 
        window.closeAddPost(); 
        location.reload();
    } catch (error) {
        hideProgressBar();
        console.error(error);
        alert("❌ فشل النشر: " + error.message);
        if(btn) { btn.disabled = false; btn.innerText = "نشر"; }
    }
}

// =========================================================
// 💬 التعليقات والردود
// =========================================================
function createCommentHTML(c, commentId, postId, isReply = false) {
    const cSafe = c.author ? c.author.replace(/'/g, "\\'") : "مجهول";
    const parentIdParam = isReply ? `'${c.parentId}'` : 'null';
    const voteArgs = `'${postId}', '${commentId}', '${cSafe}',`;
    const levelClass = getLevelClass(userXPCache[c.author] || c.authorXP || 0);
    
    // زر الحذف للتعليق (فقط لصاحبه)
    const canDelete = (c.authorUID === currentUserUID);
    const deleteBtn = canDelete ? `<span onclick="deleteComment('${postId}','${commentId}', ${isReply}, ${parentIdParam})" style="color:red; cursor:pointer; font-size:10px; margin-right:5px;">حذف</span>` : '';

    return `
        <div class="comment-item" id="comment-${commentId}">
            <div class="avatar-wrapper ${levelClass}" onclick="visitUserProfile('${cSafe}','${c.authorImg}')">
                <img src="${c.authorImg}" class="comment-avatar">
            </div>
            <div style="flex:1;">
                <div class="comment-bubble">
                    <div class="comment-author">${c.author}</div>
                    <div class="comment-text-content">${formatText(c.text)}</div>
                </div>
                <div class="comment-actions-side">
                    <span>${timeAgo(c.timestamp)}</span>
                    <div id="btn-like-${commentId}" class="action-icon-btn" onclick="voteComment(${voteArgs} 'like', ${isReply}, ${parentIdParam})">
                        <i class="far fa-thumbs-up"></i> <span id="likes-${commentId}">${c.likesCount||0}</span>
                    </div>
                    <div class="action-icon-btn" onclick="${!isReply ? `toggleReplyBox('${postId}','${commentId}')` : `prepareReply('${postId}','${c.parentId}','${cSafe}')`}"><i class="fas fa-reply"></i></div>
                    ${deleteBtn}
                </div>
                ${!isReply ? `
                <div id="reply-box-${commentId}" class="reply-input-box">
                    <input type="text" id="reply-input-${commentId}" class="reply-field" placeholder="رد...">
                    <button onclick="sendReply('${postId}','${commentId}','${cSafe}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="replies-wrapper-${commentId}" class="replies-wrapper"></div>
                ` : ''}
            </div>
        </div>
    `;
}

function loadCommentsForPost(postId) {
    onChildAdded(ref(db, `posts/${postId}/comments`), (snap) => {
        const c = snap.val();
        document.getElementById(`comments-list-${postId}`)?.insertAdjacentHTML('beforeend', createCommentHTML(c, snap.key, postId));
        
        onChildAdded(ref(db, `posts/${postId}/comments/${snap.key}/replies`), (rSnap) => {
            const r = rSnap.val(); r.parentId = snap.key;
            document.getElementById(`replies-wrapper-${snap.key}`)?.insertAdjacentHTML('beforeend', createCommentHTML(r, rSnap.key, postId, true));
        });
    });
}

window.sendComment = function(postId, postAuthor) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    if(!text) return;

    const myName = localStorage.getItem('hobbyName');
    const user = auth.currentUser;

    push(ref(db, `posts/${postId}/comments`), {
        text: text, author: myName, authorImg: localStorage.getItem('hobbyImage'), authorUID: user.uid,
        authorXP: 10, timestamp: serverTimestamp(), likesCount: 0
    });
    input.value = "";
    sendNotification(postAuthor, `علق على منشورك: ${text}`, 'comment');
    addXP(myName, 10);
}

window.sendReply = function(postId, commentId, commentAuthor) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const text = input.value;
    if(!text) return;

    const myName = localStorage.getItem('hobbyName');
    const user = auth.currentUser;

    push(ref(db, `posts/${postId}/comments/${commentId}/replies`), {
        text: text, author: myName, authorImg: localStorage.getItem('hobbyImage'), authorUID: user.uid,
        authorXP: 5, timestamp: serverTimestamp(), likesCount: 0
    });
    input.value = "";
    sendNotification(commentAuthor, `رد على تعليقك: ${text}`, 'reply');
    addXP(myName, 5);
}

// دوال الواجهة (UI)
window.togglePostMenu = (id) => document.getElementById(`menu-${id}`).classList.toggle('active');
window.hidePost = (id) => document.getElementById(`post-card-${id}`).style.display='none';
window.deletePost = (id) => { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)); };
window.toggleComments = (id) => document.getElementById(`comments-section-${id}`).classList.toggle('active');
window.toggleReplyBox = (pid, cid) => document.getElementById(`reply-box-${cid}`).classList.toggle('active');
window.prepareReply = (pid, parentId, name) => { 
    const b = document.getElementById(`reply-box-${parentId}`); b.classList.add('active'); 
    document.getElementById(`reply-input-${parentId}`).value = `@${name} `; 
};
window.toggleLike = (pid, author) => {
    const uid = currentUserUID;
    runTransaction(ref(db, `posts/${pid}`), (p) => {
        if(p) { 
            if(!p.likedBy) p.likedBy={};
            if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; }
            else { p.likes++; p.likedBy[uid]=true; }
        } return p;
    });
    if(!document.getElementById(`like-btn-${pid}`).classList.contains('active')) sendNotification(author, "أعجب بمنشورك", 'like');
};

// =========================================================
// 🌐 الدوال العامة
// =========================================================
window.logout = () => { if(confirm("خروج؟")) signOut(auth).then(()=>location.href='index.html'); };
window.openAddPost = () => document.getElementById('addPostOverlay').style.display='flex';
window.closeAddPost = () => document.getElementById('addPostOverlay').style.display='none';
window.triggerFileUpload = () => document.getElementById('postImageInput').click();
window.previewFile = () => {
    const f = document.getElementById('postImageInput').files[0];
    if(f) { const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }
};

window.visitUserProfile = function(name, img) {
    if (name.trim() === localStorage.getItem('hobbyName')) { visitMyProfile(); return; }
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG })); 
    window.location.href = 'profile-view.html'; 
}
window.visitMyProfile = function() { 
    localStorage.setItem('viewingProfile', JSON.stringify({ name: localStorage.getItem('hobbyName'), img: localStorage.getItem('hobbyImage') })); 
    window.location.href = 'profile-view.html'; 
}

// كود صفحة البروفايل
if(document.getElementById('profileContent')) { 
    let v = JSON.parse(localStorage.getItem('viewingProfile'));
    const m = localStorage.getItem('hobbyName'); 
    if(!v) v = { name: m, img: localStorage.getItem('hobbyImage') };
    
    onValue(ref(db, `users/${getSafeName(v.name)}`), s => { 
        const u = s.val()||{}; 
        document.getElementById('p-name').innerText = u.name||v.name; 
        document.getElementById('p-img').src = u.img||v.img||DEFAULT_IMG; 
        document.getElementById('p-img-wrapper').className = `profile-avatar-large-wrapper ${getLevelClass(u.xp)}`;
        
        // الأزرار حسب الزائر
        const d = document.getElementById('profileActionsBtns');
        if(v.name===m) d.innerHTML = `<button class="action-btn-profile btn-message" onclick="logout()">خروج</button>`; 
        else d.innerHTML = `<button class="action-btn-profile btn-message">مراسلة</button>`;
        
        // تحميل منشورات هذا الشخص فقط
        onValue(postsRef, (sn) => {
            const pc = document.getElementById('profilePostsContainer'); pc.innerHTML="";
            sn.forEach(ch => { if(ch.val().author===v.name) pc.insertAdjacentHTML('afterbegin', getPostHTML(ch.val(), ch.key)); });
        });
    }); 
}
