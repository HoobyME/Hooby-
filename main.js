/* --- main.js: النسخة المتطورة (دعم البروفايل) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// إعدادات Firebase
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
const postsRef = ref(db, 'posts');

// --- الدوال العامة ---

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay');
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
}

window.logout = function() {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('hobbyLoggedIn');
        window.location.href = 'index.html';
    }
}

window.visitMyProfile = function() {
    // نخبر النظام أننا نريد رؤية بروفايلنا
    const myData = {
        name: localStorage.getItem('hobbyName') || "أنت",
        img: localStorage.getItem('hobbyImage') || "side.png",
        isMe: true
    };
    localStorage.setItem('viewingProfile', JSON.stringify(myData));
    window.location.href = 'profile-view.html';
}

// --- النشر ---
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
    const authorName = localStorage.getItem('hobbyName') || "مستخدم مجهول";
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";

    if(!title || !content) {
        alert("اكتب شيئاً للنشر!");
        return;
    }

    push(postsRef, {
        title: title,
        content: content,
        author: authorName,
        authorImg: authorImg,
        timestamp: serverTimestamp(),
        likes: 0
    }).then(() => {
        alert("تم النشر!");
        window.closeAddPost();
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
    }).catch((error) => {
        alert("خطأ: " + error.message);
    });
}

// --- نظام عرض المنشورات الذكي ---

// 1. إذا كنا في الصفحة الرئيسية (Home)
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 

    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        renderHomePost(post, container);
    });
}

// 2. إذا كنا في صفحة البروفايل (Profile)
if (document.getElementById('profileGrid')) {
    const grid = document.getElementById('profileGrid');
    
    // معرفة اسم صاحب البروفايل المعروض حالياً
    let viewingName = localStorage.getItem('hobbyName'); // افتراضياً أنا
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    if (viewingData && viewingData.name) {
        viewingName = viewingData.name;
    }

    // تنظيف الشبكة
    grid.innerHTML = "";

    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        // الشرط السحري: هل كاتب المنشور هو نفسه صاحب هذا البروفايل؟
        if (post.author === viewingName) {
            renderProfilePost(post, grid);
        }
    });
}

// دالة رسم المنشور في الرئيسية
function renderHomePost(post, container) {
    const card = document.createElement('div');
    card.className = 'post-card';
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
        </div>
        <div class="post-actions">
            <div class="action-btn"><i class="far fa-heart"></i> أعجبني</div>
        </div>
    `;
    container.prepend(card);
}

// دالة رسم المنشور في البروفايل (على شكل مربع)
function renderProfilePost(post, container) {
    const item = document.createElement('div');
    item.className = 'grid-item';
    // بما أننا لم نضف صوراً للمنشورات بعد، سنعرض العنوان كخلفية ملونة
    item.style.backgroundColor = "#f0f2f5";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "center";
    item.style.padding = "10px";
    item.style.border = "1px solid #ddd";
    item.style.textAlign = "center";
    
    item.innerHTML = `
        <div>
            <h4 style="margin:0; color:var(--primary-color); font-size:14px;">${post.title}</h4>
            <p style="font-size:11px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:90px;">${post.content}</p>
        </div>
    `;
    // نضيفه في البداية
    container.prepend(item);
}
