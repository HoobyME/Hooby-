/* --- main.js: النسخة المفصلة والمصححة (لإصلاح القوائم والبروفايل) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    update, 
    onValue, 
    serverTimestamp, 
    runTransaction, 
    remove, 
    query, 
    limitToLast, 
    get, 
    onChildAdded, 
    onChildChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, 
    signOut, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =========================================================
// 🔑 إعدادات BunnyCDN
// =========================================================
const BUNNY_STORAGE_NAME = "hoooyp"; 
const BUNNY_API_KEY = "1d3c3073-83f3-4e01-9bc3d8159405-255b-442d"; 
const BUNNY_CDN_URL = "https://hoooyp-images.b-cdn.net"; 

const STREAM_LIB_ID = "570600";
const STREAM_API_KEY = "d3eab474-337a-4424-bf5f2947347c-d1fa-431c"; 

// =========================================================
// 🔥 إعدادات Firebase (المفتاح الصحيح)
// =========================================================
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

// المراجع
const postsRef = ref(db, 'posts');
const usersRef = ref(db, 'users');

const DEFAULT_IMG = "default.jpg";
const NOTIFICATION_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
let userXPCache = {};
let currentUserUID = null; // سيتم تعبئته عند الدخول

// =========================================================
// 🔐 التحقق من الدخول (Google Auth)
// =========================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // المستخدم مسجل دخول بجوجل
        currentUserUID = user.uid;
        localStorage.setItem('hobbyName', user.displayName);
        localStorage.setItem('hobbyImage', user.photoURL);
        localStorage.setItem('hobbyUID', user.uid); // تخزين المعرف للمقارنة
        localStorage.setItem('hobbyLoggedIn', 'true');
        
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            window.location.href = 'home.html';
        }
        
        registerUserPresence(user);
        monitorNotifications();
        
    } else {
        // المستخدم غير مسجل، لكن قد يكون لديه بيانات قديمة
        // نتحقق إذا كان في صفحة داخلية
        if (!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')) {
            // إذا لم يكن مسجلاً بجوجل، نسمح له بالبقاء إذا كان النظام القديم
            // لكن الميزات التي تتطلب UID ستتوقف
            console.warn("أنت تعمل بالنظام القديم أو لم يتم تحميل الدخول بعد.");
        }
    }
});

// دالة الدخول
window.loginWithGoogle = function() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Logged in:", result.user.displayName);
            // التوجيه سيحدث تلقائياً عبر onAuthStateChanged
        }).catch((error) => {
            alert("خطأ في الدخول: " + error.message);
        });
}

function registerUserPresence(user) {
    if(!user) return;
    const safeName = getSafeName(user.displayName);
    update(ref(db, 'users/' + safeName), { 
        name: user.displayName, 
        img: user.photoURL, 
        uid: user.uid, 
        lastActive: serverTimestamp() 
    }).catch(e=>{});
}

// =========================================================
// 🛠️ دوال مساعدة
// =========================================================
function getSafeName(name) {
    if(!name) return "User";
    return name.replace(/[.#$\[\]]/g, "_");
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
    return new Date(timestamp).toLocaleDateString('ar-EG');
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
// 🏆 XP System
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
// 🔄 قائمة المستخدمين (شات)
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
    }
    Object.values(users).forEach(user => {
        userXPCache[user.name] = user.xp || 0;
        const newLevelClass = getLevelClass(user.xp || 0);
        document.querySelectorAll(`.avatar-wrapper[data-author="${user.name}"]`).forEach(el => el.className = `avatar-wrapper ${newLevelClass}`);
    });
});

// =========================================================
// 🚀 رفع الملفات
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
        // تأكد أن المرسل ليس أنا (لتفادي إشعاراتي لنفسي)
        if (d.timestamp && (Date.now() - d.timestamp < 10000) && d.senderName !== localStorage.getItem('hobbyName')) {
            showSystemNotification(d.senderName, d.text, d.senderImg);
        }
    });
}

// =========================================================
// 💬 المنشورات (Posts)
// =========================================================
function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    
    // التحقق من اللايك: ندعم الطريقتين (UID و الاسم) لضمان العمل
    let isLiked = false;
    if (post.likedBy) {
        if (currentUserUID && post.likedBy[currentUserUID]) isLiked = true;
        else if (post.likedBy[getSafeName(myName)]) isLiked = true; // دعم النظام القديم
    }
    
    const activeClass = isLiked ? 'active' : '';
    
    // السماح بالحذف إذا كان الـ UID مطابق أو الاسم مطابق (مؤقتاً)
    const isOwner = (post.authorUID && post.authorUID === currentUserUID) || (post.author === myName);
    let delHTML = isOwner ? `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';

    let titleHTML = post.title ? `<h3>${formatText(post.title)}</h3>` : "";
    let contentHTML = formatText(post.content);
    let mediaHTML = "";
    if (post.postImg && post.postImg.includes("iframe.mediadelivery.net")) {
        mediaHTML = `<div style="position:relative; padding-top:56.25%; margin-top:10px;"><iframe src="${post.postImg}?autoplay=false" style="border:none; position:absolute; top:0; height:100%; width:100%; border-radius:10px;" allowfullscreen></iframe></div>`;
    } else if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }
    
    // يوتيوب
    if (contentHTML && (contentHTML.includes('youtube.com') || contentHTML.includes('youtu.be'))) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
        const match = contentHTML.match(youtubeRegex);
        if (match && match[1]) mediaHTML += `<iframe loading="lazy" style="width:100%; height:250px; border-radius:10px; margin-top:10px;" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe>`;
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
    onChildChanged(postsRef, (snapshot) => {
        const p = snapshot.val();
        const span = document.getElementById(`like-count-${snapshot.key}`);
        if(span) span.innerText = p.likes || 0;
        
        // تحديث زر اللايك
        const myName = localStorage.getItem('hobbyName');
        let isLiked = false;
        if (p.likedBy) {
            if (currentUserUID && p.likedBy[currentUserUID]) isLiked = true;
            else if (p.likedBy[getSafeName(myName)]) isLiked = true;
        }
        const likeBtn = document.getElementById(`like-btn-${snapshot.key}`);
        if(likeBtn) {
            if(isLiked) likeBtn.classList.add('active'); else likeBtn.classList.remove('active');
        }
    });
}

// =========================================================
// 🔥 دالة النشر (المصححة)
// =========================================================
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
        const user = auth.currentUser;
        
        let currentXP = 0;
        const safeName = getSafeName(myName);
        try { const xpSnap = await get(ref(db, `users/${safeName}/xp`)); currentXP = xpSnap.val() || 0; } catch(e){}
        
        await push(postsRef, {
            title: title || "", 
            content: content || "", 
            postImg: fileUrl,
            author: myName, 
            authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
            authorUID: user ? user.uid : null, // نرسل الـ UID إذا وجد
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
    
    const myName = localStorage.getItem('hobbyName');
    // السماح بالحذف إذا كان المالك (UID أو الاسم)
    const canDelete = (c.authorUID && c.authorUID === currentUserUID) || (c.author === myName);
    const deleteBtn = canDelete ? `<span onclick="deleteComment('${postId}','${commentId}', ${isReply}, ${parentIdParam})" style="color:red; cursor:pointer; font-size:10px; margin-right:5px;">حذف</span>` : '';

    // التحقق من الإعجاب بالتعليق
    let likeActive = '';
    let dislikeActive = '';
    if (c.votes) {
        if (currentUserUID && c.votes[currentUserUID]) {
            if (c.votes[currentUserUID] === 'like') likeActive = 'active-like';
            else dislikeActive = 'active-dislike';
        } else if (c.votes[getSafeName(myName)]) {
            if (c.votes[getSafeName(myName)] === 'like') likeActive = 'active-like';
            else dislikeActive = 'active-dislike';
        }
    }

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
                    <div id="btn-like-${commentId}" class="action-icon-btn ${likeActive}" onclick="voteComment(${voteArgs} 'like', ${isReply}, ${parentIdParam})">
                        <i class="far fa-thumbs-up"></i> <span id="likes-${commentId}">${c.likesCount||0}</span>
                    </div>
                    <div id="btn-dislike-${commentId}" class="action-icon-btn ${dislikeActive}" onclick="voteComment(${voteArgs} 'dislike', ${isReply}, ${parentIdParam})">
                        <i class="far fa-thumbs-down"></i> <span id="dislikes-${commentId}">${c.dislikesCount||0}</span>
                    </div>
                    <div class="action-icon-btn" onclick="${!isReply ? `toggleReplyBox('${postId}','${commentId}')` : `prepareReply('${postId}','${c.parentId}','${cSafe}')`}"><i class="fas fa-reply"></i></div>
                    ${deleteBtn}
                </div>
                ${!isReply ? `
                <div id="reply-box-${commentId}" class="reply-input-box">
                    <input type="text" id="reply-input-${commentId}" class="reply-field" placeholder="رد...">
                    <button onclick="sendReply('${postId}','${commentId}','${cSafe}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="show-replies-btn-${commentId}" class="show-replies-btn" style="display:none;" onclick="toggleReplies('${commentId}')">
                    <span>عرض الردود</span> <i class="fas fa-chevron-down"></i>
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
        
        const repliesRef = ref(db, `posts/${postId}/comments/${snap.key}/replies`);
        onValue(repliesRef, (rSnap) => {
            const repliesCount = rSnap.size;
            const btn = document.getElementById(`show-replies-btn-${snap.key}`);
            const wrapper = document.getElementById(`replies-wrapper-${snap.key}`);
            if (btn && repliesCount > 0) {
                btn.style.display = 'flex';
                btn.querySelector('span').innerText = `عرض ${repliesCount} ردود`;
                wrapper.innerHTML = "";
                rSnap.forEach((childSnap) => {
                    const r = childSnap.val(); r.parentId = snap.key;
                    wrapper.insertAdjacentHTML('beforeend', createCommentHTML(r, childSnap.key, postId, true));
                });
            } else if (btn) { btn.style.display = 'none'; }
        });
    });
}

// دوال التصويت والرد (معدلة لتقبل عدم وجود UID مؤقتاً)
window.voteComment = function(postId, commentId, authorName, type, isReply, parentId) {
    const myName = getSafeName(localStorage.getItem('hobbyName'));
    const uid = currentUserUID || myName; // استخدام الاسم إذا لم يوجد UID
    let path = `posts/${postId}/comments/${commentId}`;
    if(isReply && parentId) path = `posts/${postId}/comments/${parentId}/replies/${commentId}`;

    runTransaction(ref(db, path), (comment) => {
        if (comment) {
            if (!comment.votes) comment.votes = {};
            if (!comment.likesCount) comment.likesCount = 0;
            if (!comment.dislikesCount) comment.dislikesCount = 0;
            const currentVote = comment.votes[uid];
            
            if (currentVote === type) {
                if(type === 'like') comment.likesCount--; else comment.dislikesCount--;
                comment.votes[uid] = null;
            } else {
                if (currentVote === 'like') comment.likesCount--;
                if (currentVote === 'dislike') comment.dislikesCount--;
                if (type === 'like') comment.likesCount++; else comment.dislikesCount++;
                comment.votes[uid] = type;
            }
        }
        return comment;
    }).then(() => {
        // تحديث الواجهة ليس هنا، بل عبر onChildChanged أو التحديث المباشر
        // لكن بما أننا نستخدم HTML ثابت، يمكننا تحديث الأرقام يدوياً إذا لزم
        if(type==='like' && document.getElementById(`btn-like-${commentId}`)) {
             sendNotification(authorName, (isReply?"أعجب بردك":"أعجب بتعليقك"), 'like');
        }
    });
}

window.sendComment = function(postId, postAuthor) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    if(!text) return;

    const myName = localStorage.getItem('hobbyName');
    const user = auth.currentUser;

    push(ref(db, `posts/${postId}/comments`), {
        text: text, author: myName, authorImg: localStorage.getItem('hobbyImage'), 
        authorUID: user ? user.uid : null,
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
        text: text, author: myName, authorImg: localStorage.getItem('hobbyImage'),
        authorUID: user ? user.uid : null,
        authorXP: 5, timestamp: serverTimestamp(), likesCount: 0
    });
    input.value = "";
    sendNotification(commentAuthor, `رد على تعليقك: ${text}`, 'reply');
    addXP(myName, 5);
}

// =========================================================
// 🌐 دوال الواجهة العامة (UI) - تم إصلاح القائمة والبروفايل
// =========================================================

// ✅ إصلاح مشكلة قائمة الهمبرجر
window.toggleMenu = function() { 
    const sidebar = document.getElementById('sidebar');
    if(sidebar) {
        sidebar.classList.toggle('active'); 
    } else {
        console.error("عنصر القائمة (sidebar) غير موجود في HTML");
    }
}

// ✅ إصلاح مشكلة اللايك (التأكد من التحديث)
window.toggleLike = function(pid, author) {
    const uid = currentUserUID || getSafeName(localStorage.getItem('hobbyName'));
    
    // إذا لم يكن هناك هوية، اطلب تسجيل الدخول
    if (!uid) {
        alert("يرجى تسجيل الدخول مرة أخرى لتفعيل هذه الميزة.");
        return;
    }

    runTransaction(ref(db, `posts/${pid}`), (p) => {
        if(p) { 
            if(!p.likedBy) p.likedBy={};
            if(p.likedBy[uid]) { p.likes--; p.likedBy[uid]=null; }
            else { p.likes++; p.likedBy[uid]=true; }
        } return p;
    });
    
    const btn = document.getElementById(`like-btn-${pid}`);
    if(btn && !btn.classList.contains('active')) sendNotification(author, "أعجب بمنشورك", 'like');
};

window.togglePostMenu = (id) => document.getElementById(`menu-${id}`).classList.toggle('active');
window.hidePost = (id) => document.getElementById(`post-card-${id}`).style.display='none';
window.deletePost = (id) => { if(confirm("حذف؟")) remove(ref(db, `posts/${id}`)); };
window.toggleComments = (id) => document.getElementById(`comments-section-${id}`).classList.toggle('active');
window.toggleReplyBox = (pid, cid) => document.getElementById(`reply-box-${cid}`).classList.toggle('active');
window.toggleReplies = (cid) => {
    const w = document.getElementById(`replies-wrapper-${cid}`);
    const b = document.getElementById(`show-replies-btn-${cid}`);
    if(w.style.display==='none'){w.style.display='block'; b.querySelector('i').className="fas fa-chevron-up";}
    else{w.style.display='none'; b.querySelector('i').className="fas fa-chevron-down";}
};
window.prepareReply = (pid, parentId, name) => { 
    const b = document.getElementById(`reply-box-${parentId}`); b.classList.add('active'); 
    document.getElementById(`reply-input-${parentId}`).value = `@${name} `; 
};

// =========================================================
// 👤 البروفايل (تم إصلاح أقلام التعديل)
// =========================================================
window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    // ✅ مقارنة بالاسم لإظهار الأقلام فوراً (حل للمشكلة)
    if (name.trim() === myName) { 
        visitMyProfile(); 
        return; 
    }
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img||DEFAULT_IMG })); 
    window.location.href = 'profile-view.html'; 
}

window.visitMyProfile = function() { 
    localStorage.setItem('viewingProfile', JSON.stringify({ name: localStorage.getItem('hobbyName'), img: localStorage.getItem('hobbyImage') })); 
    window.location.href = 'profile-view.html'; 
}

window.logout = () => { if(confirm("خروج؟")) signOut(auth).then(()=>location.href='index.html'); };
window.openAddPost = () => document.getElementById('addPostOverlay').style.display='flex';
window.closeAddPost = () => document.getElementById('addPostOverlay').style.display='none';
window.triggerFileUpload = () => document.getElementById('postImageInput').click();
window.previewFile = () => {
    const f = document.getElementById('postImageInput').files[0];
    if(f) { const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }
};
window.triggerImgUpload = () => document.getElementById('profileImgInput').click();
window.uploadNewProfileImg = async function() { const f = document.getElementById('profileImgInput').files[0]; if(f) { alert("جاري الرفع..."); const url = await uploadToBunny(f); if(url) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {img:url}).then(()=>{localStorage.setItem('hobbyImage', url); alert("تم!"); location.reload();}); } }
window.editProfileName = function() { const n = prompt("الاسم الجديد:"); if(n) update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {name:n}).then(()=>{localStorage.setItem('hobbyName', n); location.reload();}); }
window.openEditModal = function(t) { if(t==='bio'){ document.getElementById('editProfileModal').style.display='flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; }}
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display='none'; }
window.saveProfileChanges = function() { update(ref(db, `users/${getSafeName(localStorage.getItem('hobbyName'))}`), {bio:document.getElementById('editBioInput').value}).then(()=>window.closeEditModal()); }

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

// كود صفحة البروفايل (عرض البيانات)
if(document.getElementById('profileContent')) { 
    let v = JSON.parse(localStorage.getItem('viewingProfile'));
    const m = localStorage.getItem('hobbyName'); 
    if(!v) v = { name: m, img: localStorage.getItem('hobbyImage') };
    
    onValue(ref(db, `users/${getSafeName(v.name)}`), s => { 
        const u = s.val()||{}; 
        document.getElementById('p-name').innerText = u.name||v.name; 
        document.getElementById('p-img').src = u.img||v.img||DEFAULT_IMG; 
        document.getElementById('p-bio').innerText = u.bio || "لا توجد نبذة";
        document.getElementById('p-img-wrapper').className = `profile-avatar-large-wrapper ${getLevelClass(u.xp)}`;
        
        // ✅ الشرط الذي يظهر الأقلام: إذا كان الاسم مطابقاً لاسمك
        const isMe = (v.name === m);
        
        const d = document.getElementById('profileActionsBtns');
        if(isMe) {
            d.innerHTML = `<button class="action-btn-profile btn-message" onclick="logout()" style="background:#ff4444;">خروج</button>`;
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block';
            if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'inline-block';
        } else {
            d.innerHTML = `<button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${v.name}')">متابعة</button><button class="action-btn-profile btn-message" onclick="startChat({name:'${v.name}', img:'${v.img}'})">مراسلة</button>`;
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none';
            if(document.getElementById('edit-name-icon')) document.getElementById('edit-name-icon').style.display = 'none';
            
            onValue(ref(db, `users/${getSafeName(m)}/following/${getSafeName(v.name)}`), s => { const b = document.getElementById('followBtn'); if(b) { if(s.exists()){ b.innerHTML='<i class="fas fa-check"></i> أتابعه'; b.classList.add('following'); } else { b.innerHTML='<i class="fas fa-user-plus"></i> متابعة'; b.classList.remove('following'); } } });
        }
        
        onValue(ref(db, `users/${getSafeName(v.name)}/followers`), s => document.getElementById('p-followers-count').innerText = s.size);
        onValue(ref(db, `users/${getSafeName(v.name)}/following`), s => document.getElementById('p-following-count').innerText = s.size);
        
        onValue(postsRef, (sn) => {
            const pc = document.getElementById('profilePostsContainer'); pc.innerHTML="";
            let c=0;
            sn.forEach(ch => { if(ch.val().author===v.name){ c++; pc.insertAdjacentHTML('afterbegin', getPostHTML(ch.val(), ch.key)); } });
            document.getElementById('p-posts-count').innerText = c;
        });
    }); 
}

// شات
let currentChatPartner = null;
window.startChat = function(user) {
    currentChatPartner = user.name;
    if(window.innerWidth <= 768) { 
        if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none'; 
        if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex'; 
    }
    const headerName = document.getElementById('chatHeaderName');
    const headerImg = document.getElementById('chatHeaderImg');
    headerName.innerText = user.name;
    headerImg.src = user.img || DEFAULT_IMG;
    document.getElementById('chatHeaderImgWrapper').className = `avatar-wrapper ${getLevelClass(user.xp||0)}`;
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
window.sendChatMessage = function() { 
    const inp = document.getElementById('msgInput'); 
    const txt = inp.value; 
    if(!txt || !currentChatPartner) return; 
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_"); 
    push(ref(db, 'chats/' + chatId), { sender: localStorage.getItem('hobbyName'), text: txt, timestamp: serverTimestamp() }); 
    sendNotification(currentChatPartner, txt, 'message');
    inp.value=""; 
}
window.backToUsers = function() { document.getElementById('usersList').style.display = 'block'; document.getElementById('chatArea').style.display = 'none'; }

window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
