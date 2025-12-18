/* --- main.js: النسخة الشاملة (شات + منشورات + صور + تعليقات + حماية) --- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// مراجع قاعدة البيانات
const postsRef = ref(db, 'posts');
const usersRef = ref(db, 'users'); 

// =========================================================
// 🛡️ 1. نظام الحماية والأمان (طرد البوتات)
// =========================================================

function checkAuth() {
    const path = window.location.href;
    const isLoggedIn = localStorage.getItem('hobbyLoggedIn');
    const userName = localStorage.getItem('hobbyName');

    // الصفحات المسموح دخولها للزوار فقط
    if (path.includes('index.html') || path.includes('signup.html') || path.includes('login-email.html')) {
        return;
    }

    // إذا لم يكن مسجلاً أو اسمه غير صالح -> طرد للصفحة الرئيسية
    if (!isLoggedIn || !userName || userName === "null") {
        window.location.href = 'index.html';
    }
}
checkAuth(); // تشغيل الحماية فوراً

// تسجيل المستخدم في قائمة "الأعضاء" ليظهر في الشات
function registerUserPresence() {
    const myName = localStorage.getItem('hobbyName');
    const myImg = localStorage.getItem('hobbyImage') || "side.png";
    
    if(myName && localStorage.getItem('hobbyLoggedIn')) {
        // تنظيف الاسم لاستخدامه كمفتاح (Firebase لا يقبل الرموز مثل . # $)
        const safeName = myName.replace(/[.#$\[\]]/g, "_");
        set(ref(db, 'users/' + safeName), {
            name: myName,
            img: myImg,
            lastActive: serverTimestamp()
        });
    }
}
registerUserPresence();


// =========================================================
// ⚙️ 2. الوظائف العامة (القوائم، الثيم، الخروج)
// =========================================================

function getSafeUserId() {
    let name = localStorage.getItem('hobbyName');
    if(!name) return null;
    return name.replace(/[.#$\[\]]/g, "_");
}

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
        localStorage.clear();
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


// =========================================================
// 💬 3. نظام الدردشة (Chat System)
// =========================================================

let currentChatPartner = null;

// أ) تحميل قائمة المستخدمين (تعمل فقط في صفحة messages.html)
if (document.getElementById('usersList')) {
    const userListContainer = document.getElementById('usersList');
    userListContainer.innerHTML = ""; 

    onChildAdded(usersRef, (snapshot) => {
        const user = snapshot.val();
        const myName = localStorage.getItem('hobbyName');

        // لا تظهر نفسي في القائمة
        if (user.name === myName) return;

        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => startChat(user);
        div.innerHTML = `
            <img src="${user.img || 'side.png'}">
            <div class="user-item-info">
                <h4>${user.name}</h4>
                <span>اضغط للمراسلة</span>
            </div>
        `;
        userListContainer.appendChild(div);
    });
}

// ب) بدء المحادثة عند اختيار شخص
window.startChat = function(user) {
    currentChatPartner = user.name;
    
    // تحديث الواجهة
    document.getElementById('chatHeaderName').innerText = user.name;
    document.getElementById('chatHeaderImg').src = user.img || 'side.png';
    document.getElementById('inputArea').style.display = 'flex';
    document.getElementById('chatMessages').innerHTML = ""; 
    
    // للجوال
    const chatArea = document.getElementById('chatArea');
    const userList = document.getElementById('usersList');
    if(window.innerWidth <= 600 && chatArea) {
        chatArea.classList.add('active');
        if(userList) userList.style.display = 'none';
    }

    loadMessages();
}

// ج) تحميل الرسائل السابقة
function loadMessages() {
    const myName = localStorage.getItem('hobbyName');
    const partner = currentChatPartner;
    // مفتاح المحادثة: ترتيب الأسماء أبجدياً لتوحيد المفتاح
    const chatId = [myName, partner].sort().join("_");
    const messagesRef = ref(db, 'chats/' + chatId);

    document.getElementById('chatMessages').innerHTML = "";

    onChildAdded(messagesRef, (snapshot) => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        const isMe = msg.sender === myName;
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.innerText = msg.text;
        
        const container = document.getElementById('chatMessages');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });
}

// د) إرسال رسالة
window.sendChatMessage = function() {
    const input = document.getElementById('msgInput');
    const text = input.value;
    const myName = localStorage.getItem('hobbyName');

    if (!text || !currentChatPartner) return;

    const chatId = [myName, currentChatPartner].sort().join("_");
    const messagesRef = ref(db, 'chats/' + chatId);

    push(messagesRef, {
        sender: myName,
        text: text,
        timestamp: serverTimestamp()
    }).then(() => {
        input.value = "";
    });
}


// =========================================================
// 📝 4. نظام المنشورات (صور + نصوص)
// =========================================================

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
    const file = fileInput.files[0]; 

    const authorName = localStorage.getItem('hobbyName');
    const authorImg = localStorage.getItem('hobbyImage') || "side.png";

    if(!title || !content) {
        alert("يرجى كتابة عنوان وموضوع للمنشور!");
        return;
    }

    // دالة الإرسال للقاعدة
    const sendData = (imageUrl) => {
        push(postsRef, {
            title: title,
            content: content,
            postImg: imageUrl || "", 
            author: authorName,
            authorImg: authorImg,
            timestamp: serverTimestamp(),
            likes: 0,
            likedBy: {}
        }).then(() => {
            alert("✅ تم النشر!");
            window.closeAddPost();
            document.getElementById('postTitle').value = '';
            document.getElementById('postContent').value = '';
            document.getElementById('postImageInput').value = '';
            document.getElementById('imagePreview').style.display = 'none';
        }).catch((error) => {
            alert("خطأ: " + error.message);
        });
    };

    // معالجة الصورة (نظام FileReader للمجانية)
    if (file) {
        // تحذير للحجم الكبير
        if (file.size > 1024 * 1024) { // أكبر من 1 ميجا
            alert("⚠️ الصورة كبيرة وقد لا يتم نشرها. يفضل صور أصغر من 1 ميجا.");
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            sendData(e.target.result); // إرسال كود الصورة
        };
        reader.readAsDataURL(file);
    } else {
        sendData(null); // نشر نصي فقط
    }
}


// =========================================================
// ❤️ 5. نظام الإفادة (Likes) والتعليقات
// =========================================================

window.toggleLike = function(postId) {
    const userId = getSafeUserId();
    if (!userId) return alert("يجب تسجيل الدخول!");

    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likedBy) post.likedBy = {};
            if (post.likedBy[userId]) {
                post.likes--; // إلغاء الإفادة
                post.likedBy[userId] = null;
            } else {
                post.likes++; // إضافة إفادة
                post.likedBy[userId] = true;
            }
        }
        return post;
    });
    
    // تحديث سريع للزر
    const btn = document.getElementById(`like-btn-${postId}`);
    if(btn) {
        btn.classList.toggle('active');
        const countSpan = btn.querySelector('.like-count');
        let current = parseInt(countSpan.innerText);
        countSpan.innerText = btn.classList.contains('active') ? current + 1 : current - 1;
    }
}

window.toggleComments = function(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if(section) section.classList.toggle('active');
}

window.sendComment = function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value;
    const authorName = localStorage.getItem('hobbyName');
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


// =========================================================
// 🖼️ 6. عرض المنشورات (بناء البطاقة)
// =========================================================

function createPostCard(post, postId) {
    const userId = getSafeUserId();
    let isLikedByMe = false;
    if (post.likedBy && userId && post.likedBy[userId]) isLikedByMe = true;
    const activeClass = isLikedByMe ? 'active' : '';

    const card = document.createElement('div');
    card.className = 'post-card';

    // التحقق من وجود صورة
    let imageHTML = "";
    if (post.postImg && post.postImg.length > 20) {
        imageHTML = `<img src="${post.postImg}" style="width:100%; border-radius:10px; margin-top:10px; max-height:400px; object-fit:cover; display:block;">`;
    }

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
            ${imageHTML}
        </div>
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

    // جلب التعليقات الخاصة بالمنشور
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


// =========================================================
// 🔧 7. أدوات مساعدة (إضافية)
// =========================================================

window.triggerFileUpload = function() { document.getElementById('postImageInput').click(); }
window.previewFile = function() {
    const f = document.getElementById('postImageInput').files[0];
    if(f) {
        const r = new FileReader();
        r.onload = e => { document.getElementById('imagePreview').src = e.target.result; document.getElementById('imagePreview').style.display = 'block'; };
        r.readAsDataURL(f);
    }
}
window.addHashtagInput = function() { document.getElementById('postHashtags').style.display = 'block'; }
window.triggerAudioUpload = function() { document.getElementById('postAudioInput').click(); }
window.handleAudioSelect = function() { alert("تم تحديد الملف الصوتي"); }
window.addLink = function() { prompt("أدخل الرابط:"); }

window.addEventListener('load', function() {
    if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
});
