/* --- main.js: النسخة الكاملة المفصلة (Google Auth + الحماية + الميزات) --- */

// استيراد المكتبات الضرورية من Firebase
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
// 🔑 إعدادات BunnyCDN (للصور والفيديو)
// =========================================================
const BUNNY_STORAGE_NAME = "hoooyp"; 
const BUNNY_API_KEY = "1d3c3073-83f3-4e01-9bc3d8159405-255b-442d"; 
const BUNNY_CDN_URL = "https://hoooyp-images.b-cdn.net"; 

const STREAM_LIB_ID = "570600";
const STREAM_API_KEY = "d3eab474-337a-4424-bf5f2947347c-d1fa-431c"; 

// =========================================================
// 🔥 إعدادات Firebase (المفتاح الجديد الصحيح)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyBIVXdGJ09zgMxg4WaGU9vbvICY6JURqDM", // ✅ المفتاح الجديد من الصورة
  authDomain: "hooby-7d945.firebaseapp.com",
  databaseURL: "https://hooby-7d945-default-rtdb.firebaseio.com",
  projectId: "hooby-7d945",
  storageBucket: "hooby-7d945.firebasestorage.app",
  messagingSenderId: "522131121638",
  appId: "1:522131121638:web:748f7761f18167fb65e227",
  measurementId: "G-H1F82C1THC"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// مراجع قاعدة البيانات
const postsRef = ref(db, 'posts');
const usersRef = ref(db, 'users');

// متغيرات عامة
const DEFAULT_IMG = "default.jpg";
const NOTIFICATION_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
let userXPCache = {};
let currentUserUID = null; // لتخزين معرف الحماية

// =========================================================
// 🔐 نظام الدخول والحماية (Google Auth Logic)
// =========================================================

// هذه الدالة تعمل تلقائياً عند فتح الموقع لتتأكد من حالة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user) {
        // المستخدم قام بتسجيل الدخول بنجاح
        console.log("المستخدم متصل:", user.displayName);
        currentUserUID = user.uid; // حفظ المعرف الفريد للحماية

        // حفظ البيانات في المتصفح للسرعة
        localStorage.setItem('hobbyName', user.displayName);
        localStorage.setItem('hobbyImage', user.photoURL);
        localStorage.setItem('hobbyLoggedIn', 'true');
        
        // إذا كان المستخدم في صفحة الدخول، يتم تحويله للصفحة الرئيسية
        if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
            window.location.href = 'home.html';
        }
        
        // تشغيل الوظائف الخلفية
        registerUserPresence(user);
        monitorNotifications();
        
        if (window.location.href.includes('messages.html')) {
            localStorage.setItem('hasUnreadMessages', 'false');
        }

    } else {
        // المستخدم غير متصل
        console.log("لا يوجد مستخدم متصل");
        currentUserUID = null;
        
        // إذا كان يحاول دخول صفحة داخلية وهو غير مسجل، نعيده للدخول
        if (!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
        }
    }
});

// دالة زر تسجيل الدخول عبر جوجل
window.loginWithGoogle = function() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            // لا نحتاج لفعل شيء هنا، دالة onAuthStateChanged ستتولى الأمر
            console.log("تمت عملية الدخول بنجاح");
        }).catch((error) => {
            console.error("خطأ في الدخول:", error);
            alert("حدث خطأ أثناء تسجيل الدخول: " + error.message);
        });
}

// تسجيل تواجد المستخدم في قاعدة البيانات
function registerUserPresence(user) {
    if(!user) return;
    const safeName = getSafeName(user.displayName);
    // نحدث البيانات ونضيف الـ UID للحماية
    update(ref(db, 'users/' + safeName), { 
        name: user.displayName, 
        img: user.photoURL, 
        uid: user.uid, // ✅ هذا الرقم مهم جداً لقواعد الحماية
        lastActive: serverTimestamp() 
    }).catch(e => console.error(e));
}

// تحديث التواجد كل دقيقتين
setInterval(() => {
    if(auth.currentUser) registerUserPresence(auth.currentUser);
}, 120000);

// دالة لتنظيف الأسماء (لأن فايربيس لا يقبل نقاطاً في المفاتيح)
function getSafeName(name) {
    if(!name) return "Unknown_User";
    return name.replace(/[.#$\[\]]/g, "_");
}

// دالة حساب الوقت (منذ...)
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

// دالة تنسيق النصوص (للمنشن الأزرق)
function formatText(text) {
    if (!text) return "";
    // البحث عن @ ثم اسم المستخدم وتحويله لرابط
    return text.replace(/@([\u0600-\u06FFa-zA-Z0-9._]+)/g, (match, username) => {
        const safeUsername = username.replace(/'/g, "\\'");
        return `<span class="user-mention" onclick="event.stopPropagation(); visitUserProfile('${safeUsername}')">${match}</span>`;
    });
}

// =========================================================
// 🔔 نظام الإشعارات
// =========================================================
function requestNotificationPermission() { 
    if ("Notification" in window) {
        Notification.requestPermission(); 
    }
}

// دالة مركزية لإرسال الإشعارات لقاعدة البيانات
function sendNotification(targetUser, text, type) {
    const myName = localStorage.getItem('hobbyName');
    // لا ترسل إشعاراً لنفسك
    if (!targetUser || targetUser === myName) return;

    const safeTarget = getSafeName(targetUser);
    const user = auth.currentUser;
    
    // إرسال الإشعار
    push(ref(db, `notifications/${safeTarget}`), {
        senderName: myName,
        senderImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
        senderUID: user ? user.uid : null, // لمنع الإشعار الذاتي بدقة
        text: text,
        type: type, 
        timestamp: serverTimestamp()
    });
}

// مراقبة الإشعارات الواردة
function monitorNotifications() {
    const myName = getSafeName(localStorage.getItem('hobbyName'));
    if (!myName) return;

    const badge = document.getElementById('msgBadge');
    if (localStorage.getItem('hasUnreadMessages') === 'true' && badge) { 
        badge.classList.add('active'); 
    }

    onChildAdded(query(ref(db, `notifications/${myName}`), limitToLast(1)), (snapshot) => {
        const data = snapshot.val();
        // التأكد أن الإشعار جديد (أقل من 10 ثواني) وليس مني
        const isRecent = data.timestamp && (Date.now() - data.timestamp < 10000);
        const isNotMe = currentUserUID !== data.senderUID;

        if (isRecent && isNotMe) {
            showSystemNotification(data.senderName, data.text, data.senderImg);
        }
    });
}

function showSystemNotification(sender, message, img) {
    NOTIFICATION_SOUND.play().catch(()=>{});
    
    if (Notification.permission === "granted") {
        const n = new Notification(`رسالة من ${sender}`, { 
            body: message, 
            icon: img || DEFAULT_IMG 
        });
        n.onclick = () => { 
            window.focus(); 
            window.location.href = 'messages.html'; 
        };
    }
    
    const badge = document.getElementById('msgBadge');
    if (badge && !window.location.href.includes('messages.html')) { 
        badge.classList.add('active'); 
        localStorage.setItem('hasUnreadMessages', 'true'); 
    }
}

// =========================================================
// 🏆 نظام نقاط الخبرة (XP)
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

function addXP(userName, amount) {
    const safeName = getSafeName(userName);
    const userRef = ref(db, 'users/' + safeName + '/xp');
    runTransaction(userRef, (currentXP) => {
        return (currentXP || 0) + amount;
    });
}

// =========================================================
// 🚀 وظائف الرفع (BunnyCDN)
// =========================================================
function updateProgressBar(percent) {
    const overlay = document.getElementById('uploadProgressOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('progressBarFill').style.width = percent + '%';
        document.getElementById('progressText').innerText = `جاري الرفع: ${Math.round(percent)}%`;
    }
}

function hideProgressBar() { 
    const overlay = document.getElementById('uploadProgressOverlay'); 
    if(overlay) overlay.style.display='none'; 
}

function uploadWithProgress(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        
        for (const [key, value] of Object.entries(headers)) {
            xhr.setRequestHeader(key, value);
        }
        
        xhr.upload.onprogress = (e) => { 
            if (e.lengthComputable) {
                updateProgressBar((e.loaded / e.total) * 100); 
            }
        };
        
        xhr.onload = () => { 
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText || '{}'));
            } else {
                reject(new Error(`Server Error: ${xhr.status}`));
            }
        };
        
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(body);
    });
}

async function uploadToBunny(file) {
    const rawName = Date.now() + "_" + file.name.replace(/\s/g, "_");
    const fileName = encodeURIComponent(rawName);
    
    // محاولة الرفع على سيرفرات متعددة
    const endpoints = [
        `https://uk.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`,
        `https://storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`,
        `https://ny.storage.bunnycdn.com/${BUNNY_STORAGE_NAME}/${fileName}`
    ];

    console.log("جاري محاولة رفع الصورة...");

    for (let url of endpoints) {
        try {
            await uploadWithProgress(url, 'PUT', { 
                'AccessKey': BUNNY_API_KEY, 
                'Content-Type': 'application/octet-stream' 
            }, file);
            // إرجاع الرابط
            return `${BUNNY_CDN_URL}/${rawName}`;
        } catch (e) {
            console.warn(`فشل الرفع على السيرفر ${url}، جاري التجربة على التالي...`);
        }
    }
    throw new Error("فشل الرفع على جميع السيرفرات.");
}

async function uploadVideoToBunnyStream(file) {
    try {
        // 1. إنشاء الفيديو
        const createRes = await fetch(`https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos`, { 
            method: 'POST', 
            headers: { 
                'AccessKey': STREAM_API_KEY, 
                'Content-Type': 'application/json' 
            }, 
            body: JSON.stringify({ title: file.name }) 
        });
        
        if (!createRes.ok) throw new Error("Video Create Failed");
        const vidData = await createRes.json();
        const vid = vidData.guid;
        
        // 2. رفع الفيديو
        await uploadWithProgress(
            `https://video.bunnycdn.com/library/${STREAM_LIB_ID}/videos/${vid}`, 
            'PUT', 
            { 'AccessKey': STREAM_API_KEY }, 
            file
        );
        
        return `https://iframe.mediadelivery.net/embed/${STREAM_LIB_ID}/${vid}`;
    } catch (e) { 
        console.error(e); 
        throw e; 
    }
}

// =========================================================
// 📝 دالة النشر (محمية بـ UID)
// =========================================================
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 
    
    // التحقق من المدخلات
    if(!title && !content && !file) { 
        alert("يجب إضافة عنوان أو محتوى أو صورة على الأقل!"); 
        return; 
    }

    if(btn) { 
        btn.disabled = true; 
        btn.innerText = "جاري النشر..."; 
    }

    let fileUrl = "";
    
    try {
        // رفع الملفات إن وجدت
        if (file) {
            if (file.type.startsWith('image/')) {
                fileUrl = await uploadToBunny(file);
            } else if (file.type.startsWith('video/')) {
                fileUrl = await uploadVideoToBunnyStream(file);
            } else { 
                throw new Error("نوع الملف غير مدعوم"); 
            }

            if (!fileUrl) throw new Error("فشل الحصول على رابط الملف");
        }

        const myName = localStorage.getItem('hobbyName');
        const safeName = getSafeName(myName);
        const user = auth.currentUser;

        if (!user) throw new Error("يجب تسجيل الدخول أولاً");
        
        // جلب الـ XP الحالي
        let currentXP = 0;
        try {
            const xpSnap = await get(ref(db, `users/${safeName}/xp`));
            currentXP = xpSnap.val() || 0;
        } catch(e){}
        
        // إضافة المنشور لقاعدة البيانات مع authorUID للحماية
        await push(postsRef, {
            title: title || "", 
            content: content || "", 
            postImg: fileUrl,
            author: myName, 
            authorImg: localStorage.getItem('hobbyImage') || DEFAULT_IMG,
            authorUID: user.uid, // 🛡️ هام جداً للحماية
            authorXP: currentXP + 10,
            timestamp: serverTimestamp(), 
            likes: 0
        });

        // زيادة نقاط المستخدم
        addXP(myName, 10); 
        
        hideProgressBar(); 
        alert("✅ تم النشر بنجاح!"); 
        window.closeAddPost(); 
        location.reload();

    } catch (error) {
        hideProgressBar();
        console.error("خطأ النشر:", error);
        alert("❌ فشل النشر:\n" + error.message);
        if(btn) { 
            btn.disabled = false; 
            btn.innerText = "نشر"; 
        }
    }
}

// =========================================================
// 🖼️ عرض المنشورات
// =========================================================
function getPostHTML(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    
    // التحقق من الإعجاب
    let isLiked = (post.likedBy && currentUserUID && post.likedBy[currentUserUID]);
    const activeClass = isLiked ? 'active' : '';
    const timeString = timeAgo(post.timestamp);

    // تنسيق النصوص (المنشن)
    let titleHTML = post.title ? `<h3>${formatText(post.title)}</h3>` : "";
    let contentHTML = formatText(post.content);

    // تجهيز الوسائط (صورة أو فيديو)
    let mediaHTML = "";
    if (post.postImg && post.postImg.includes("iframe.mediadelivery.net")) {
        mediaHTML = `<div style="position:relative; padding-top:56.25%; margin-top:10px;"><iframe src="${post.postImg}?autoplay=false" style="border:none; position:absolute; top:0; height:100%; width:100%; border-radius:10px;" allowfullscreen></iframe></div>`;
    } else if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" loading="lazy" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }
    
    // التعامل مع روابط يوتيوب
    if (contentHTML && (contentHTML.includes('youtube.com') || contentHTML.includes('youtu.be'))) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
        const match = contentHTML.match(youtubeRegex);
        if (match && match[1]) {
            mediaHTML += `<iframe loading="lazy" style="width:100%; height:250px; border-radius:10px; margin-top:10px;" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
    }
    
    // زر الحذف: يظهر فقط إذا كان authorUID للمنشور يطابق currentUserUID
    let delHTML = (post.authorUID === currentUserUID) ? 
        `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';
    
    // تحديد مستوى الكاتب
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
                    <span>${timeString}</span>
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

// تحميل المنشورات عند بدء الصفحة
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
    
    // تحديث اللايكات بشكل مباشر
    onChildChanged(postsRef, (snapshot) => {
        const post = snapshot.val();
        const postId = snapshot.key;
        const countSpan = document.getElementById(`like-count-${postId}`);
        
        if(countSpan) countSpan.innerText = post.likes || 0;
        
        // تحديث لون الزر للمستخدم الحالي
        const likeBtn = document.getElementById(`like-btn-${postId}`);
        const isLiked = (post.likedBy && currentUserUID && post.likedBy[currentUserUID]);
        
        if(likeBtn) { 
            if(isLiked) likeBtn.classList.add('active'); 
            else likeBtn.classList.remove('active'); 
        }
    });
}

// =========================================================
// 💬 التعليقات (مع authorUID للحماية)
// =========================================================
function createCommentHTML(c, commentId, postId, isReply = false) {
    const cSafe = c.author ? c.author.replace(/'/g, "\\'") : "مجهول";
    const parentIdParam = isReply ? `'${c.parentId}'` : 'null';
    const voteArgs = `'${postId}', '${commentId}', '${cSafe}',`;
    const levelClass = getLevelClass(userXPCache[c.author] || c.authorXP || 0);
    
    // زر الحذف: يظهر فقط لصاحب التعليق
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
        
        // تحميل الردود المتداخلة
        onChildAdded(ref(db, `posts/${postId}/comments/${snap.key}/replies`), (rSnap) => {
            const r = rSnap.val(); 
            r.parentId = snap.key;
            document.getElementById(`replies-wrapper-${snap.key}`)?.insertAdjacentHTML('beforeend', createCommentHTML(r, rSnap.key, postId, true));
        });
    });
}

// إرسال تعليق
window.sendComment = function(postId, postAuthor) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    if(!text) return;

    const myName = localStorage.getItem('hobbyName');
    const user = auth.currentUser;

    if (!user) { alert("يجب تسجيل الدخول!"); return; }

    push(ref(db, `posts/${postId}/comments`), {
        text: text, 
        author: myName, 
        authorImg: localStorage.getItem('hobbyImage'), 
        authorUID: user.uid, // للحماية
        authorXP: 10, 
        timestamp: serverTimestamp(), 
        likesCount: 0
    });
    
    input.value = "";
    sendNotification(postAuthor, `علق على منشورك: ${text}`, 'comment');
    addXP(myName, 10);
}

// إرسال رد على تعليق
window.sendReply = function(postId, commentId, commentAuthor) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const text = input.value;
    if(!text) return;

    const myName = localStorage.getItem('hobbyName');
    const user = auth.currentUser;

    push(ref(db, `posts/${postId}/comments/${commentId}/replies`), {
        text: text, 
        author: myName, 
        authorImg: localStorage.getItem('hobbyImage'), 
        authorUID: user.uid,
        authorXP: 5, 
        timestamp: serverTimestamp(), 
        likesCount: 0
    });
    
    input.value = "";
    sendNotification(commentAuthor, `رد على تعليقك: ${text}`, 'reply');
    addXP(myName, 5);
}

// =========================================================
// ⚙️ وظائف واجهة المستخدم (UI Helpers)
// =========================================================
window.togglePostMenu = function(id) { 
    document.getElementById(`menu-${id}`).classList.toggle('active'); 
}

window.hidePost = function(id) { 
    document.getElementById(`post-card-${id}`).style.display='none'; 
}

window.deletePost = function(id) { 
    if(confirm("هل أنت متأكد من الحذف؟")) {
        remove(ref(db, `posts/${id}`)); 
    }
}

window.toggleComments = function(id) { 
    document.getElementById(`comments-section-${id}`).classList.toggle('active'); 
}

window.toggleReplyBox = function(pid, cid) { 
    document.getElementById(`reply-box-${cid}`).classList.toggle('active'); 
}

window.prepareReply = function(pid, parentId, name) { 
    const b = document.getElementById(`reply-box-${parentId}`); 
    b.classList.add('active'); 
    const input = document.getElementById(`reply-input-${parentId}`);
    input.value = `@${name} `; 
    input.focus();
}

window.toggleLike = function(pid, author) {
    const uid = currentUserUID;
    if (!uid) return;

    const btn = document.getElementById(`like-btn-${pid}`);
    
    // إرسال الإشعار فقط إذا كان يضع لايك (وليس يزيله)
    if(!btn.classList.contains('active')) {
        sendNotification(author, "أعجب بمنشورك", 'like');
    }

    runTransaction(ref(db, `posts/${pid}`), (p) => {
        if(p) { 
            if(!p.likedBy) p.likedBy={};
            if(p.likedBy[uid]) { 
                p.likes--; 
                p.likedBy[uid]=null; 
            } else { 
                p.likes++; 
                p.likedBy[uid]=true; 
            }
        } 
        return p;
    });
}

// =========================================================
// 💬 نظام الدردشة (Chat)
// =========================================================
let currentChatPartner = null;

window.startChat = function(user) {
    currentChatPartner = user.name;
    
    // للموبايل: إخفاء القائمة وإظهار الشات
    if(window.innerWidth <= 768) { 
        if(document.getElementById('usersList')) document.getElementById('usersList').style.display = 'none'; 
        if(document.getElementById('chatArea')) document.getElementById('chatArea').style.display = 'flex'; 
    }
    
    // إعداد رأس الشات
    const headerName = document.getElementById('chatHeaderName');
    const headerImg = document.getElementById('chatHeaderImg');
    headerName.innerText = user.name;
    headerImg.src = user.img || DEFAULT_IMG;
    
    // روابط البروفايل في الشات
    headerName.onclick = () => visitUserProfile(user.name, user.img || DEFAULT_IMG);
    headerImg.onclick = () => visitUserProfile(user.name, user.img || DEFAULT_IMG);
    
    // تحديث إطار المستوى للصورة
    const wrapper = document.getElementById('chatHeaderImgWrapper');
    if(wrapper) wrapper.className = `avatar-wrapper ${getLevelClass(user.xp||0)}`;
    
    if(document.getElementById('inputArea')) document.getElementById('inputArea').style.display = 'flex';
    
    // تحميل الرسائل
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_");
    const msgContainer = document.getElementById('chatMessages'); 
    msgContainer.innerHTML = "";
    
    onChildAdded(query(ref(db, 'chats/' + chatId), limitToLast(50)), (s) => {
        const msg = s.val();
        const div = document.createElement('div');
        const isMe = msg.sender === localStorage.getItem('hobbyName');
        
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        
        // تنسيق سريع (احتياطي للـ CSS)
        div.style.padding="8px"; 
        div.style.margin="5px"; 
        div.style.borderRadius="10px";
        div.style.background = isMe ? "#4CAF50" : "#ddd";
        div.style.alignSelf = isMe ? "flex-end" : "flex-start";
        div.style.color = isMe ? "#fff" : "#000";
        
        msgContainer.appendChild(div); 
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });
}

window.sendChatMessage = function() { 
    const inp = document.getElementById('msgInput'); 
    const txt = inp.value; 
    if(!txt || !currentChatPartner) return; 
    
    const chatId = [localStorage.getItem('hobbyName'), currentChatPartner].sort().join("_"); 
    
    push(ref(db, 'chats/' + chatId), { 
        sender: localStorage.getItem('hobbyName'), 
        text: txt, 
        timestamp: serverTimestamp() 
    }); 
    
    sendNotification(currentChatPartner, txt, 'message');
    inp.value=""; 
}

window.backToUsers = function() { 
    document.getElementById('usersList').style.display = 'block'; 
    document.getElementById('chatArea').style.display = 'none'; 
}

// قائمة المستخدمين النشطين
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
                        <div style="display:flex; align-items:center; margin-top:2px;">
                            <span class="user-status-indicator ${isOnline ? "status-online" : "status-offline"}"></span>
                            <span class="status-text">${isOnline ? "متصل" : "غير متصل"}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
});

// =========================================================
// 🌍 الوظائف العامة (Global Functions)
// =========================================================
window.logout = function() { 
    if(confirm("هل تريد تسجيل الخروج؟")) { 
        signOut(auth).then(() => { 
            localStorage.clear();
            window.location.href = 'index.html'; 
        }); 
    } 
}

window.openAddPost = function() { 
    document.getElementById('addPostOverlay').style.display='flex'; 
}

window.closeAddPost = function() { 
    document.getElementById('addPostOverlay').style.display='none'; 
}

window.triggerFileUpload = function() { 
    document.getElementById('postImageInput').click(); 
}

window.previewFile = function() {
    const f = document.getElementById('postImageInput').files[0];
    if(f) { 
        const r=new FileReader(); 
        r.onload = e => {
            const preview = document.getElementById('imagePreview');
            preview.src = e.target.result;
            preview.style.display='block';
        }; 
        r.readAsDataURL(f); 
    }
}

// دالة الانتقال للملف الشخصي (مع إصلاح المنشن الذاتي)
window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    
    // إذا ضغطت على اسمك، اذهب لملفك القابل للتعديل
    if (name.trim() === myName) { 
        visitMyProfile(); 
        return; 
    }
    
    localStorage.setItem('viewingProfile', JSON.stringify({ 
        name: name, 
        img: img||DEFAULT_IMG 
    })); 
    window.location.href = 'profile-view.html'; 
}

window.visitMyProfile = function() { 
    localStorage.setItem('viewingProfile', JSON.stringify({ 
        name: localStorage.getItem('hobbyName'), 
        img: localStorage.getItem('hobbyImage') 
    })); 
    window.location.href = 'profile-view.html'; 
}

// =========================================================
// 👤 منطق صفحة الملف الشخصي (Profile Page Logic)
// =========================================================
if(document.getElementById('profileContent')) { 
    let v = JSON.parse(localStorage.getItem('viewingProfile'));
    const m = localStorage.getItem('hobbyName'); 
    
    // إذا لم تكن هناك بيانات، اعرض المستخدم الحالي
    if(!v) v = { name: m, img: localStorage.getItem('hobbyImage') };
    
    // جلب البيانات الحية من قاعدة البيانات
    onValue(ref(db, `users/${getSafeName(v.name)}`), s => { 
        const u = s.val()||{}; 
        
        // تحديث عناصر الصفحة
        document.getElementById('p-name').innerText = u.name||v.name; 
        document.getElementById('p-img').src = u.img||v.img||DEFAULT_IMG; 
        document.getElementById('p-bio').innerText = u.bio || "لا توجد نبذة تعريفية";
        
        // تحديث إطار المستوى
        const imgWrapper = document.getElementById('p-img-wrapper');
        if(imgWrapper) imgWrapper.className = `profile-avatar-large-wrapper ${getLevelClass(u.xp)}`;
        
        // الأزرار (تختلف إذا كنت أنت أو زائر)
        const d = document.getElementById('profileActionsBtns');
        d.innerHTML = "";
        
        if(v.name === m) { 
            // إذا كان ملفي الشخصي
            d.innerHTML = `<button class="action-btn-profile btn-message" onclick="location.href='settings.html'"><i class="fas fa-cog"></i> الإعدادات</button> <button class="action-btn-profile btn-message" onclick="logout()" style="background:#ff4444;">خروج</button>`; 
            
            // إظهار أيقونات التعديل
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block';
        } else { 
            // إذا كنت زائراً
            d.innerHTML = `<button id="followBtn" class="action-btn-profile btn-follow" onclick="toggleFollow('${v.name}')">متابعة</button><button class="action-btn-profile btn-message" onclick="startChat({name:'${v.name}', img:'${v.img}'})">مراسلة</button>`; 
            
            // إخفاء أيقونات التعديل
            if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none';
            if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none';
            
            // فحص حالة المتابعة
            onValue(ref(db, `users/${getSafeName(m)}/following/${getSafeName(v.name)}`), s => { 
                const b = document.getElementById('followBtn'); 
                if(b) { 
                    if(s.exists()){ 
                        b.innerHTML='<i class="fas fa-check"></i> أتابعه'; 
                        b.classList.add('following'); 
                    } else { 
                        b.innerHTML='<i class="fas fa-user-plus"></i> متابعة'; 
                        b.classList.remove('following'); 
                    } 
                } 
            }); 
        }
        
        // تحديث العدادات
        onValue(ref(db, `users/${getSafeName(v.name)}/followers`), s => document.getElementById('p-followers-count').innerText = s.size); 
        onValue(ref(db, `users/${getSafeName(v.name)}/following`), s => document.getElementById('p-following-count').innerText = s.size); 

        // تحميل منشورات هذا المستخدم فقط
        onValue(postsRef, (sn) => {
            const pc = document.getElementById('profilePostsContainer');
            if(pc) {
                pc.innerHTML=""; 
                let c=0; 
                let arr=[];
                
                sn.forEach(ch => { 
                    const p=ch.val(); 
                    if(p.author===v.name){ 
                        c++; 
                        arr.push({id:ch.key, data:p}); 
                    } 
                });
                
                document.getElementById('p-posts-count').innerText = c;
                
                if(arr.length>0) {
                    arr.reverse().forEach(i => { 
                        pc.innerHTML += getPostHTML(i.data, i.id); 
                        loadCommentsForPost(i.id); 
                    });
                } else {
                    pc.innerHTML = `<p style="text-align:center; color:gray; padding:20px;">لا توجد منشورات لهذا المستخدم.</p>`;
                }
            }
        });
    }); 
}

// تحميل الثيم عند البدء
window.addEventListener('load', function() { 
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode'); 
    }
});
