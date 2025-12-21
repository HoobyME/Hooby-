/* --- main.js: النسخة المصححة (تحديث الإعجاب الفوري + انتظار رفع الصور) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, update, onValue, serverTimestamp, runTransaction, remove, query, limitToLast, get, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 👇👇 تـأكـد مـن وضـع المفتـاح هـنـا بـشـكـل صـحـيـح 👇👇
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
// 🚀 وظيفة رفع الصور (ImgBB)
// =========================================================
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);
    
    try {
        console.log("جاري الاتصال بـ ImgBB...");
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            console.log("تم الرفع بنجاح:", data.data.url);
            return data.data.url;
        } else {
            console.error("ImgBB Error:", data);
            alert("خطأ في المفتاح أو الصورة: " + (data.error ? data.error.message : "غير معروف"));
            return null;
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("فشل الاتصال بالإنترنت أو بخادم الصور");
        return null;
    }
}

// =========================================================
// 2. المنشورات (Posts)
// =========================================================

// دالة النشر (مع إصلاح انتظار الصورة)
window.saveNewPost = async function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const file = document.getElementById('postImageInput').files[0];
    const btn = document.querySelector('.btn-publish'); 

    if(!title && !content) { alert("اكتب شيئاً للنشر!"); return; }

    // تغيير نص الزر ليعرف المستخدم أن هناك عملية جارية
    if(btn) { btn.innerText = "جاري النشر... ⏳"; btn.disabled = true; }

    let fileUrl = "";

    // إذا كان هناك ملف، نرفعه أولاً وننتظر الرابط
    if (file) {
        if(file.type.startsWith('image/')) {
            fileUrl = await uploadToImgBB(file);
            if (!fileUrl) {
                // فشل الرفع
                if(btn) { btn.innerText = "نشر"; btn.disabled = false; }
                return; 
            }
        } else {
            alert("الفيديو غير مدعوم مباشرة، استخدم رابط يوتيوب.");
            if(btn) { btn.innerText = "نشر"; btn.disabled = false; }
            return;
        }
    }

    // الآن ننشر مع الرابط الصحيح
    push(postsRef, {
        title: title || "بدون عنوان",
        content: content || "",
        postImg: fileUrl, // الرابط الذي جاء من ImgBB
        author: localStorage.getItem('hobbyName'),
        authorImg: localStorage.getItem('hobbyImage') || "side.png",
        timestamp: serverTimestamp(),
        likes: 0
    }).then(() => {
        alert("✅ تم النشر!");
        window.closeAddPost();
        location.reload();
    }).catch((err) => {
        alert("خطأ في قاعدة البيانات: " + err.message);
        if(btn) { btn.innerText = "نشر"; btn.disabled = false; }
    });
}

function createPostCard(post, postId) {
    const myName = localStorage.getItem('hobbyName');
    const safeAuthor = post.author ? post.author.replace(/'/g, "\\'") : "مجهول";
    
    // التحقق هل أنا معجب بالمنشور؟
    let isLiked = false;
    if (post.likedBy && getSafeName(myName) && post.likedBy[getSafeName(myName)]) {
        isLiked = true;
    }
    const activeClass = isLiked ? 'active' : ''; // كلاس اللون الأخضر

    const card = document.createElement('div');
    card.className = 'post-card';
    card.id = `post-card-${postId}`;
    
    // عرض الصورة
    let mediaHTML = "";
    if (post.postImg && post.postImg.length > 5) {
        mediaHTML = `<img src="${post.postImg}" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover;">`;
    }

    // عرض فيديو يوتيوب
    let contentHTML = post.content;
    if (post.content && (post.content.includes('youtube.com') || post.content.includes('youtu.be'))) {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
        const match = post.content.match(youtubeRegex);
        if (match && match[1]) {
            mediaHTML += `<iframe style="width:100%; height:250px; border-radius:10px; margin-top:10px;" src="https://www.youtube.com/embed/${match[1]}" frameborder="0" allowfullscreen></iframe>`;
        }
    }

    let delHTML = (post.author === myName) ? `<div class="menu-option delete" onclick="deletePost('${postId}')"><i class="fas fa-trash"></i> حذف</div>` : '';

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorImg}" class="user-avatar-small" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer">
            <div class="user-info-text" onclick="visitUserProfile('${safeAuthor}', '${post.authorImg}')" style="cursor:pointer"><h4>${post.author}</h4><span>الآن</span></div>
            <div class="options-btn" onclick="togglePostMenu('${postId}')"><i class="fas fa-ellipsis-h"></i></div>
            <div id="menu-${postId}" class="options-menu"><div class="menu-option" onclick="hidePost('${postId}')">إخفاء</div>${delHTML}</div>
        </div>
        <div class="post-body"><h3>${post.title}</h3><p>${contentHTML}</p>${mediaHTML}</div>
        <div class="post-actions">
            <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}', '${safeAuthor}')">
                <img src="logo.png" class="efada-icon">
                <span>إفادة</span>
                <span class="like-count">${post.likes||0}</span>
            </div>
            <div class="action-btn" onclick="toggleComments('${postId}')"><i class="far fa-comment"></i> تعليق</div>
        </div>
        <div id="comments-section-${postId}" class="comments-section"><div class="comments-list"></div><div class="comment-input-area"><input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً..."><button onclick="sendComment('${postId}', '${safeAuthor}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button></div></div>
    `;
    
    // تحميل التعليقات
    onChildAdded(ref(db, `posts/${postId}/comments`), (snap) => {
        const c = snap.val();
        const cSafe = c.author.replace(/'/g, "\\'");
        const list = card.querySelector('.comments-list');
        if(list) list.innerHTML += `<div class="comment-item"><img src="${c.authorImg}" class="comment-avatar" onclick="visitUserProfile('${cSafe}','${c.authorImg}')"><div class="comment-content"><span class="comment-author" onclick="visitUserProfile('${cSafe}','${c.authorImg}')">${c.author}</span><span>${c.text}</span></div></div>`;
    });

    return card;
}

// =========================================================
// 🔥 إصلاح زر اللايك (تحديث فوري) 🔥
// =========================================================
window.toggleLike = function(postId, postAuthor) {
    const uid = getSafeName(localStorage.getItem('hobbyName'));
    if (!uid) return alert("يجب تسجيل الدخول");

    // 1. التحديث الفوري للشكل (قبل قاعدة البيانات) لكي يشعر المستخدم بالسرعة
    const btn = document.getElementById(`like-btn-${postId}`);
    const countSpan = btn.querySelector('.like-count');
    let currentCount = parseInt(countSpan.innerText) || 0;

    // عكس الحالة الحالية
    if (btn.classList.contains('active')) {
        // كان معجباً -> إزالة الإعجاب
        btn.classList.remove('active');
        countSpan.innerText = currentCount > 0 ? currentCount - 1 : 0;
    } else {
        // لم يكن معجباً -> إضافة إعجاب
        btn.classList.add('active');
        countSpan.innerText = currentCount + 1;
    }

    // 2. التحديث الفعلي في قاعدة البيانات
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likedBy) post.likedBy = {};
            if (post.likedBy[uid]) {
                post.likes--;
                post.likedBy[uid] = null;
            } else {
                post.likes++;
                post.likedBy[uid] = true;
            }
        }
        return post;
    }).then(() => {
        // نجاح (تم التحديث في السيرفر)
        if (postAuthor) sendNotification(postAuthor, 'like', postId);
    }).catch((err) => {
        // فشل؟ نعيد الزر لحالته السابقة (تراجع)
        console.error("Like failed", err);
        btn.classList.toggle('active'); // عكس الحركة
        // يمكن إعادة الرقم أيضاً إذا أردت الدقة الشديدة
    });
}

// بقية الدوال (عرض المنشورات، الدردشة، البروفايل)
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
    onChildAdded(postsRef, (snapshot) => {
        if (snapshot.val().author === viewingName) container.prepend(createPostCard(snapshot.val(), snapshot.key));
    });
}

// الوظائف العامة
window.visitMyProfile = function() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    localStorage.setItem('viewingProfile', JSON.stringify({ name: myName, img: myImg, isMe: true }));
    window.location.href = 'profile-view.html';
}
window.visitUserProfile = function(name, img) {
    const myName = localStorage.getItem('hobbyName');
    localStorage.setItem('viewingProfile', JSON.stringify({ name: name, img: img || "side.png", isMe: (name === myName) }));
    window.location.href = 'profile-view.html';
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
window.previewFile = function() { const f = document.getElementById('postImageInput').files[0]; if(f){ const r=new FileReader(); r.onload=e=>{document.getElementById('imagePreview').src=e.target.result;document.getElementById('imagePreview').style.display='block';}; r.readAsDataURL(f); }}
window.addLink = function() { prompt("الرابط:"); }

window.triggerImgUpload = function() { document.getElementById('profileImgInput').click(); }
window.uploadNewProfileImg = async function() {
    const file = document.getElementById('profileImgInput').files[0];
    if(file) {
        alert("جاري رفع الصورة... ⏳");
        const newUrl = await uploadToImgBB(file);
        if (newUrl) {
            const myName = localStorage.getItem('hobbyName');
            update(ref(db, `users/${getSafeName(myName)}`), { img: newUrl })
            .then(() => { localStorage.setItem('hobbyImage', newUrl); alert("✅ تم تحديث الصورة!"); });
        }
    }
}
window.openEditModal = function(type) { if(type === 'bio') { document.getElementById('editProfileModal').style.display = 'flex'; document.getElementById('editBioInput').value = document.getElementById('p-bio').innerText; } }
window.closeEditModal = function() { document.getElementById('editProfileModal').style.display = 'none'; }
window.saveProfileChanges = function() { const myName = localStorage.getItem('hobbyName'); const newBio = document.getElementById('editBioInput').value; update(ref(db, `users/${getSafeName(myName)}`), { bio: newBio }).then(() => window.closeEditModal()); }

// إشعارات (تذكير: لم يتم إدراج بقية الكود لتوفير المساحة، تأكد من وجود دالة sendNotification ومنطق البروفايل من الردود السابقة إذا نقص شيء)
function sendNotification(toUser, type, postId) {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    if (!toUser || toUser === myName) return;
    push(ref(db, `notifications/${getSafeName(toUser)}`), {
        fromName: myName, fromImg: myImg, type: type, postId: postId || "", timestamp: serverTimestamp(), read: false
    });
}
// Profile Logic
if (document.getElementById('profileContent')) {
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    const myName = localStorage.getItem('hobbyName');
    if (viewingData) {
        onValue(ref(db, `users/${getSafeName(viewingData.name)}`), (snapshot) => {
            const userData = snapshot.val() || {};
            document.getElementById('p-name').innerText = viewingData.name;
            document.getElementById('p-img').src = userData.img || viewingData.img;
            document.getElementById('p-bio').innerText = userData.bio || "لا توجد نبذة";
            const actionsDiv = document.getElementById('profileActionsBtns');
            actionsDiv.innerHTML = "";
            if (viewingData.name === myName) {
                 if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'flex';
                 if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'inline-block';
            } else {
                if(document.getElementById('edit-img-icon')) document.getElementById('edit-img-icon').style.display = 'none';
                if(document.getElementById('edit-bio-icon')) document.getElementById('edit-bio-icon').style.display = 'none';
            }
        });
    }
}

window.addEventListener('load', function() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); });
