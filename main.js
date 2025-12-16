/* --- main.js: نسخة تدعم الصور + التعليقات + الإفادة --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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

function getSafeUserId() {
    let name = localStorage.getItem('hobbyName');
    if(!name) return null;
    return name.replace(/[.#$\[\]]/g, "_");
}

// --- الوظائف العامة ---
window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay');
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
}

window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const darkText = document.getElementById('darkText');
    if(darkText) darkText.innerText = isDark ? "الوضع النهاري" : "الوضع المظلم";
}

window.logout = function() {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('hobbyLoggedIn');
        window.location.href = 'index.html';
    }
}

window.visitMyProfile = function() {
    const myData = {
        name: localStorage.getItem('hobbyName') || "أنت",
        img: localStorage.getItem('hobbyImage') || "side.png",
        isMe: true
    };
    localStorage.setItem('viewingProfile', JSON.stringify(myData));
    window.location.href = 'profile-view.html';
}

// --- النشر (تم التعديل لحفظ الصور) ---
window.openAddPost = function() {
    const modal = document.getElementById('addPostOverlay');
    if(modal) modal.style.display = 'flex';
}

window.closeAddPost = function() {
    const modal = document.getElementById('addPostOverlay');
    if(modal) modal.style.display = 'none';
}

window.saveNewPost = function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const fileInput = document.getElementById('postImageInput');
    const file = fileInput.files[0]; // الملف المختار

    const authorName = localStorage.getItem('hobbyName') || "مستخدم مجهول";
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";

    if(!title || !content) {
        alert("يرجى كتابة عنوان وموضوع للمنشور!");
        return;
    }

    // دالة داخلية لإرسال البيانات (نستدعيها سواء كان هناك صورة أم لا)
    const sendData = (imageUrl) => {
        push(postsRef, {
            title: title,
            content: content,
            postImg: imageUrl || "", // حفظ رابط الصورة هنا
            author: authorName,
            authorImg: authorImg,
            timestamp: serverTimestamp(),
            likes: 0,
            likedBy: {}
        }).then(() => {
            alert("✅ تم النشر بنجاح!");
            window.closeAddPost();
            document.getElementById('postTitle').value = '';
            document.getElementById('postContent').value = '';
            document.getElementById('postImageInput').value = ''; // تصفير الصورة
            document.getElementById('imagePreview').style.display = 'none';
        }).catch((error) => {
            alert("حدث خطأ: " + error.message);
        });
    };

    // التحقق: هل يوجد صورة؟
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // تحويل الصورة لنص (Base64) وإرسالها
            sendData(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        // لا توجد صورة، أرسل النص فقط
        sendData(null);
    }
}

// --- نظام الإفادة ---
window.toggleLike = function(postId) {
    const userId = getSafeUserId();
    if (!userId) return alert("يجب تسجيل الدخول أولاً!");

    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likedBy) post.likedBy = {};
            if (post.likedBy[userId]) {
                post.likes--;
                post.likedBy[userId] = null;
            } else {
                post.likes++;
                post.likedBy[userId] = true;
            }
        }
        return post;
    });
    
    const btn = document.getElementById(`like-btn-${postId}`);
    if(btn) {
        btn.classList.toggle('active');
        const countSpan = btn.querySelector('.like-count');
        let current = parseInt(countSpan.innerText);
        countSpan.innerText = btn.classList.contains('active') ? current + 1 : current - 1;
    }
}

// --- نظام التعليقات ---
window.toggleComments = function(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if(section) {
        section.classList.toggle('active');
    }
}

window.sendComment = function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    const authorName = localStorage.getItem('hobbyName') || "مجهول";
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";

    if(!text) return;

    const commentsRef = ref(db, `posts/${postId}/comments`);
    push(commentsRef, {
        text: text,
        author: authorName,
        authorImg: authorImg,
        timestamp: serverTimestamp()
    }).then(() => {
        input.value = "";
    });
}

// --- بناء البطاقة (تم التعديل لعرض الصورة) ---
function createPostCard(post, postId) {
    const userId = getSafeUserId();
    let isLikedByMe = false;
    if (post.likedBy && userId && post.likedBy[userId]) {
        isLikedByMe = true;
    }
    const activeClass = isLikedByMe ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'post-card';

    // كود عرض الصورة (يظهر فقط إذا كان للمنشور صورة)
    // نستخدم شرط (ternary operator) للتحقق
    const imageHTML = post.postImg 
        ? `<img src="${post.postImg}" style="width:100%; border-radius:10px; margin-top:10px; max-height:300px; object-fit:cover;">` 
        : '';

    const efadaBtnHTML = `
        <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}')">
            <img src="logo.png" class="efada-icon" alt="إفادة">
            <span>إفادة</span>
            <span class="like-count" style="margin-right:5px;">${post.likes || 0}</span>
        </div>
    `;

    const commentBtnHTML = `
        <div class="action-btn" onclick="toggleComments('${postId}')">
            <i class="far fa-comment"></i> تعليق
        </div>
    `;

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorImg}" class="user-avatar-small">
            <div class="user-info-text">
                <h4>${post.author}</h4>
                <span>الآن</span>
            </div>
        </div>
        <div class="post-body">
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            ${imageHTML} </div>
        <div class="post-actions">
            ${efadaBtnHTML}
            ${commentBtnHTML}
        </div>
        
        <div id="comments-section-${postId}" class="comments-section">
            <div class="comments-list"></div>
            <div class="comment-input-area">
                <input type="text" id="comment-input-${postId}" class="comment-input" placeholder="اكتب تعليقاً...">
                <button onclick="sendComment('${postId}')" class="send-comment-btn"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    const commentsRef = ref(db, `posts/${postId}/comments`);
    onChildAdded(commentsRef, (snapshot) => {
        const comment = snapshot.val();
        const list = card.querySelector('.comments-list');
        if(list) {
            const commentItem = document.createElement('div');
            commentItem.className = 'comment-item';
            commentItem.innerHTML = `
                <img src="${comment.authorImg}" class="comment-avatar">
                <div class="comment-content">
                    <span class="comment-author">${comment.author}</span>
                    <span>${comment.text}</span>
                </div>
            `;
            list.appendChild(commentItem);
            list.scrollTop = list.scrollHeight;
        }
    });

    return card;
}

// عرض في الرئيسية
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 
    onChildAdded(postsRef, (snapshot) => {
        const card = createPostCard(snapshot.val(), snapshot.key);
        container.prepend(card);
    });
}

// عرض في البروفايل
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) viewingName = viewingData.name;

    container.innerHTML = "";
    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        if (post.author === viewingName) {
            const card = createPostCard(post, snapshot.key);
            container.prepend(card);
        }
    });
}

// --- أدوات ---
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() {
    const f = document.getElementById('postImageInput').files[0];
    if(f) {
        const r = new FileReader();
        r.onload = e => { document.getElementById('imagePreview').src = e.target.result; document.getElementById('imagePreview').style.display = 'block'; };
        r.readAsDataURL(f);
    }
}
window.addHashtagInput = function() { 
    const i = document.getElementById('postHashtags');
    if(i) i.style.display = i.style.display === 'none' ? 'block' : 'none';
}
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.handleAudioSelect = function() { alert("تم تحديد الملف الصوتي"); }
window.addLink = function() { prompt("أدخل الرابط:"); }

window.addEventListener('load', function() {
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const dt = document.getElementById('darkText');
        if(dt) dt.innerText = "الوضع النهاري";
    }
    const path = window.location.href;
    if (!localStorage.getItem('hobbyLoggedIn') && !path.includes('index') && !path.includes('signup') && !path.includes('login')) {
        window.location.href = 'index.html';
    }
});
