/* --- main.js: النسخة المصححة والشاملة --- */

// 1. استيراد مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. إعدادات مشروعك (مفاتيح الربط)
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

// 3. تشغيل Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const postsRef = ref(db, 'posts');

// ---------------------------------------------------------
//  ⚠️ المنطقة المهمة: ربط الدوال بالنافذة (Window) لتراها HTML
// ---------------------------------------------------------

// القائمة الجانبية (الهمبرجر)
window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay');
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
}

// الوضع المظلم
window.toggleDarkMode = function() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const darkText = document.getElementById('darkText');
    if(darkText) darkText.innerText = isDark ? "الوضع النهاري" : "الوضع المظلم";
}

// تسجيل الخروج
window.logout = function() {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('hobbyLoggedIn');
        window.location.href = 'index.html';
    }
}

// الذهاب للملف الشخصي
window.visitMyProfile = function() {
    window.location.href = 'profile-view.html';
}

// --- نوافذ النشر (زر الزائد) ---
window.openAddPost = function() {
    const modal = document.getElementById('addPostOverlay');
    if(modal) modal.style.display = 'flex';
}

window.closeAddPost = function() {
    const modal = document.getElementById('addPostOverlay');
    if(modal) modal.style.display = 'none';
}

// حفظ المنشور وإرساله لـ Firebase
window.saveNewPost = function() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const authorName = localStorage.getItem('hobbyName') || "مستخدم مجهول";
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";

    if(!title || !content) {
        alert("يرجى كتابة عنوان وموضوع!");
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
        alert("✅ تم النشر للعالم!");
        window.closeAddPost();
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
    }).catch((error) => {
        alert("حدث خطأ: " + error.message);
        console.error(error);
    });
}

// --- الاهتمامات (إضافي لإصلاح الزر الجانبي) ---
window.openInterestsModal = function() {
    const modal = document.getElementById('interestsModal');
    if(modal) modal.style.display = 'flex';
}
window.closeModal = function() {
    const modal = document.getElementById('interestsModal');
    if(modal) modal.style.display = 'none';
}
window.applyChanges = function() {
    alert("تم حفظ اهتماماتك!");
    window.closeModal();
}

// --- دوال الصور والصوت ---
window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() {
    const file = document.getElementById('postImageInput').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.handleAudioSelect = function() { alert("تم تحديد الملف الصوتي"); }
window.addLink = function() { 
    const url = prompt("أدخل الرابط:");
    if(url) alert("تم إضافة الرابط: " + url);
}
window.addHashtagInput = function() {
    const input = document.getElementById('postHashtags');
    if(input) input.style.display = input.style.display === 'none' ? 'block' : 'none';
}


// ---------------------------------------------------------
//  بداية التشغيل التلقائي عند فتح الصفحة
// ---------------------------------------------------------

// التحقق من الدخول
if (!localStorage.getItem('hobbyLoggedIn') && !window.location.href.includes('index.html') && !window.location.href.includes('signup')) {
    if (!window.location.href.includes('login')) window.location.href = 'index.html';
}

// تحميل الثيم
window.addEventListener('load', function() {
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkText = document.getElementById('darkText');
        if(darkText) darkText.innerText = "الوضع النهاري";
    }
});

// الاستماع للمنشورات القادمة من Firebase وعرضها
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; // تنظيف

    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        renderPostHTML(post);
    });
}

function renderPostHTML(post) {
    const container = document.getElementById('postsContainer');
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
            <div class="action-btn" onclick="alert('قريباً!')">
                <i class="far fa-heart"></i> أعجبني
            </div>
            <div class="action-btn">
                <i class="far fa-comment"></i> تعليق
            </div>
        </div>
    `;
    container.prepend(card);
}
