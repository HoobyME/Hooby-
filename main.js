/* --- main.js: النسخة المانعة للتكرار (Anti-Spam) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);
const postsRef = ref(db, 'posts');

// ---------------------------------------------------------
//  دوال مساعدة لضبط اسم المستخدم كمفتاح (تمنع المشاكل مع الرموز)
// ---------------------------------------------------------
function getSafeUserId() {
    let name = localStorage.getItem('hobbyName');
    if(!name) return null;
    // استبدال النقاط والرموز الممنوعة في مفاتيح فايربيس
    return name.replace(/[.#$\[\]]/g, "_");
}

// ---------------------------------------------------------
//  الوظائف العامة
// ---------------------------------------------------------

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

// ---------------------------------------------------------
//  النشر
// ---------------------------------------------------------

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
        alert("يرجى كتابة عنوان وموضوع للمنشور!");
        return;
    }

    push(postsRef, {
        title: title,
        content: content,
        author: authorName,
        authorImg: authorImg,
        timestamp: serverTimestamp(),
        likes: 0,
        likedBy: {} // هنا سيتم تخزين أسماء من ضغطوا إفادة
    }).then(() => {
        alert("✅ تم النشر بنجاح!");
        window.closeAddPost();
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
    }).catch((error) => {
        alert("حدث خطأ: " + error.message);
    });
}

// ---------------------------------------------------------
//  نظام الإفادة الذكي (يمنع التكرار)
// ---------------------------------------------------------

window.toggleLike = function(postId) {
    const userId = getSafeUserId();
    if (!userId) return alert("يجب تسجيل الدخول أولاً للإفادة!");

    const postRef = ref(db, `posts/${postId}`);

    // Transaction: عملية ذرية آمنة في قاعدة البيانات
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likedBy) post.likedBy = {}; // إنشاء القائمة إذا لم تكن موجودة

            if (post.likedBy[userId]) {
                // المستخدم موجود بالفعل -> إزالة الإفادة (Unlike)
                post.likes--;
                post.likedBy[userId] = null; // حذف الاسم
            } else {
                // المستخدم غير موجود -> إضافة إفادة (Like)
                post.likes++;
                post.likedBy[userId] = true; // تسجيل الاسم
            }
        }
        return post;
    });
    // لا نحتاج لتغيير اللون يدوياً هنا، لأن onChildAdded/onValue ستقوم بتحديث الواجهة (أو التحديث التلقائي للصفحة)
    // لكن لتحسين السرعة البصرية سنقوم بتبديل الكلاس مؤقتاً
    const btn = document.getElementById(`like-btn-${postId}`);
    if(btn) {
        btn.classList.toggle('active');
        const countSpan = btn.querySelector('.like-count');
        let current = parseInt(countSpan.innerText);
        // تحديث الرقم تقريبياً حتى يأتي الرد من السيرفر
        countSpan.innerText = btn.classList.contains('active') ? current + 1 : current - 1;
    }
}

// ---------------------------------------------------------
//  عرض المنشورات (بناء البطاقة)
// ---------------------------------------------------------

function createPostCard(post, postId) {
    const userId = getSafeUserId();
    
    // التحقق هل المستخدم الحالي قام بالإفادة سابقاً؟
    let isLikedByMe = false;
    if (post.likedBy && userId && post.likedBy[userId]) {
        isLikedByMe = true;
    }

    // إضافة كلاس active إذا كان المستخدم قد أفاد المنشور
    const activeClass = isLikedByMe ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'post-card';

    // زر الإفادة
    // أضفنا id للزر لسهولة الوصول إليه
    const efadaBtnHTML = `
        <div id="like-btn-${postId}" class="action-btn ${activeClass}" onclick="toggleLike('${postId}')">
            <img src="logo.png" class="efada-icon" alt="إفادة">
            <span>إفادة</span>
            <span class="like-count" style="margin-right:5px;">${post.likes || 0}</span>
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
        </div>
        <div class="post-actions">
            ${efadaBtnHTML}
            <div class="action-btn">
                <i class="far fa-comment"></i> تعليق
            </div>
        </div>
    `;
    return card;
}

// الاستماع للمنشورات في الصفحة الرئيسية
if (document.getElementById('postsContainer')) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = ""; 

    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        const postId = snapshot.key;
        const card = createPostCard(post, postId);
        // ملاحظة: prepend يضيف في الأعلى، لكن قد يسبب قفزاً عند التحديث.
        // في المشاريع الكبيرة نستخدم مصفوفة وترتيب، لكن هنا prepend ممتاز.
        container.prepend(card);
    });
}

// الاستماع للمنشورات في صفحة البروفايل
if (document.getElementById('profilePostsContainer')) {
    const container = document.getElementById('profilePostsContainer');
    let viewingName = localStorage.getItem('hobbyName');
    const viewingData = JSON.parse(localStorage.getItem('viewingProfile'));
    
    if (viewingData && viewingData.name) {
        viewingName = viewingData.name;
    }

    container.innerHTML = "";

    onChildAdded(postsRef, (snapshot) => {
        const post = snapshot.val();
        const postId = snapshot.key;
        if (post.author === viewingName) {
            const card = createPostCard(post, postId);
            container.prepend(card);
        }
    });
}

// ---------------------------------------------------------
//  أدوات مساعدة
// ---------------------------------------------------------

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

window.addHashtagInput = function() { 
    const input = document.getElementById('postHashtags');
    if(input) input.style.display = input.style.display === 'none' ? 'block' : 'none';
}
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.handleAudioSelect = function() { alert("تم تحديد الملف الصوتي"); }
window.addLink = function() { prompt("أدخل الرابط:"); }
window.openInterestsModal = function() { document.getElementById('interestsModal').style.display = 'flex'; }
window.closeModal = function() { document.getElementById('interestsModal').style.display = 'none'; }
window.applyChanges = function() { alert("تم الحفظ"); window.closeModal(); }

// ---------------------------------------------------------
//  التهيئة عند التحميل
// ---------------------------------------------------------
window.addEventListener('load', function() {
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkText = document.getElementById('darkText');
        if(darkText) darkText.innerText = "الوضع النهاري";
    }
    
    const path = window.location.href;
    if (!localStorage.getItem('hobbyLoggedIn') && 
        !path.includes('index.html') && 
        !path.includes('signup.html') && 
        !path.includes('login-email.html')) {
        window.location.href = 'index.html';
    }
});
