/* --- main.js: النسخة الكاملة النهائية --- */

// 1. التحقق من الدخول
if (!localStorage.getItem('hobbyLoggedIn') && !window.location.href.includes('login') && !window.location.href.includes('signup')) {
    window.location.href = 'login-social.html';
}

// 2. تحميل الثيم وتشغيل المنطق
window.addEventListener('load', function() {
    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkText = document.getElementById('darkText');
        if(darkText) darkText.innerText = "الوضع النهاري";
        const switchBtn = document.getElementById('darkModeSwitch');
        if(switchBtn) switchBtn.checked = true;
    }
});

// 3. القوائم
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.overlay').classList.toggle('active');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const darkText = document.getElementById('darkText');
    if(darkText) darkText.innerText = isDark ? "الوضع النهاري" : "الوضع المظلم";
}

function logout() {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        localStorage.removeItem('hobbyLoggedIn');
        window.location.href = 'login-social.html';
    }
}

// 4. التنقل بين البروفايلات
function visitProfile(name, img, isMe) {
    const data = { name: name, img: img, isMe: isMe };
    localStorage.setItem('viewingProfile', JSON.stringify(data));
    window.location.href = 'profile-view.html';
}

function visitMyProfile() {
    const myData = {
        name: localStorage.getItem('hobbyName') || "أنت",
        img: localStorage.getItem('hobbyImage') || "side.png",
        isMe: true
    };
    localStorage.setItem('viewingProfile', JSON.stringify(myData));
    
    if(window.location.href.includes('profile-view.html')) window.location.reload();
    else window.location.href = 'profile-view.html';
}

// 5. النشر
let addPostModal;
function openAddPost() {
    addPostModal = document.getElementById('addPostOverlay');
    if(addPostModal) addPostModal.style.display = 'flex';
}
function closeAddPost() {
    addPostModal = document.getElementById('addPostOverlay');
    if(addPostModal) addPostModal.style.display = 'none';
}
function saveNewPost() {
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    
    if(!title || !content) {
        alert("يرجى ملء العنوان والموضوع");
        return;
    }
    
    alert("✅ تم النشر بنجاح!");
    
    // Reset form
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    document.getElementById('postHashtags').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    
    closeAddPost();
}
function triggerFileUpload() { 
    const input = document.getElementById('postImageInput');
    input.click();
}

function triggerAudioUpload() {
    const input = document.getElementById('postAudioInput');
    input.click();
}

function addLink() {
    const url = prompt("أدخل رابط الموقع:");
    if(url) {
        const linkBox = document.getElementById('linkBox');
        linkBox.classList.add('active');
        linkBox.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            linkBox.classList.remove('active');
            linkBox.innerHTML = '<i class="fas fa-link"></i>';
        }, 2000);
    }
}

function handleAudioSelect() {
    const audioBox = document.getElementById('audioBox');
    audioBox.classList.add('active');
    audioBox.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
        audioBox.classList.remove('active');
        audioBox.innerHTML = '<i class="fas fa-microphone"></i>';
    }, 2000);
}

function addHashtagInput() {
    const hashtagInput = document.getElementById('postHashtags');
    const hashtagIcon = document.querySelector('.hashtag-icon');
    
    if(hashtagInput.style.display === 'none') {
        hashtagInput.style.display = 'block';
        hashtagIcon.style.background = 'linear-gradient(135deg, #66BB6A, var(--primary-color))';
        hashtagInput.focus();
    } else {
        hashtagInput.style.display = 'none';
        hashtagIcon.style.background = 'linear-gradient(135deg, var(--primary-color), #66BB6A)';
    }
}
function previewFile() {
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

// 6. التفاعل (إعجاب وتعليقات)
function toggleLike(btn) {
    btn.classList.toggle('liked');
    const txt = btn.querySelector('.like-txt');
    const icon = btn.querySelector('i');
    if (btn.classList.contains('liked')) {
        icon.classList.replace('far', 'fas'); txt.innerText = "1";
    } else {
        icon.classList.replace('fas', 'far'); txt.innerText = "أعجبني";
    }
}

function addComment(btn) {
    const text = prompt("أضف تعليقك:");
    if (text) {
        const section = btn.closest('.post-card').querySelector('.comments-section');
        const user = localStorage.getItem('hobbyName') || "أنت";
        const userImg = localStorage.getItem("hobbyImage") || "side.png";
        
        const div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML = `
            <img src="${userImg}" class="comment-avatar" onclick="visitMyProfile()">
            <div class="comment-body">
                <span class="comment-user" onclick="visitMyProfile()">${user}</span>
                <p class="comment-text">${text}</p>
            </div>
            <div class="comment-votes">
                <i class="fas fa-chevron-up vote-btn" onclick="voteComment(this, 'up')"></i>
                <span class="vote-count">0</span>
                <i class="fas fa-chevron-down vote-btn" onclick="voteComment(this, 'down')"></i>
            </div>
        `;
        section.appendChild(div);
        section.style.display = 'block';
    }
}

// 7. دالة التصويت (نقرة واحدة)
function voteComment(btn, type) {
    const container = btn.parentElement;
    const countSpan = container.querySelector('.vote-count');
    let count = parseInt(countSpan.innerText);
    const upBtn = container.querySelector('.fa-chevron-up');
    const downBtn = container.querySelector('.fa-chevron-down');

    if (type === 'up') {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active'); count--; // إلغاء
        } else {
            if (downBtn.classList.contains('active')) { downBtn.classList.remove('active'); count++; } // إلغاء العكس
            btn.classList.add('active'); count++; // تفعيل
        }
    } else {
        if (btn.classList.contains('active')) {
            btn.classList.remove('active'); count++; // إلغاء
        } else {
            if (upBtn.classList.contains('active')) { upBtn.classList.remove('active'); count--; } // إلغاء العكس
            btn.classList.add('active'); count--; // تفعيل
        }
    }
    countSpan.innerText = count;
}

// 8. منطق المتابعة (الحل النهائي)
function updateCounts() {
    const myFollowing = JSON.parse(localStorage.getItem('hobbyFollowedUsers')) || [];
    
    if(isOwner) {
        document.getElementById('followingCount').innerText = myFollowing.length;
        document.getElementById('followersCount').innerText = "0";
    } else {
        document.getElementById('followingCount').innerText = "15";
        let followers = 100;
        
        // التحقق من الحالة لتلوين الزر
        const btn = document.getElementById("followUserBtn");
        const isFollowing = myFollowing.some(u => u.name === currentViewingUser.name);
        
        if(isFollowing) {
            followers++;
            btn.innerText = "إلغاء المتابعة";
            btn.classList.add("following"); // يصبح أحمر
        } else {
            btn.innerText = "متابعة";
            btn.classList.remove("following"); // يرجع أخضر
        }
        document.getElementById('followersCount').innerText = followers;
    }
}

function toggleFollowUser(btn) {
    let list = JSON.parse(localStorage.getItem('hobbyFollowedUsers')) || [];
    const idx = list.findIndex(u => u.name === currentViewingUser.name);
    const followersDisplay = document.getElementById('followersCount');
    let currentCount = parseInt(followersDisplay.innerText);

    if(idx !== -1) {
        // إلغاء المتابعة
        list.splice(idx, 1);
        btn.innerText = "متابعة";
        btn.classList.remove("following"); // إزالة الأحمر (يرجع أخضر)
        followersDisplay.innerText = currentCount - 1;
    } else {
        // متابعة
        list.push({name: currentViewingUser.name, img: currentViewingUser.img, job: "مستخدم"});
        btn.innerText = "إلغاء المتابعة";
        btn.classList.add("following"); // إضافة الأحمر
        followersDisplay.innerText = currentCount + 1;
    }
    localStorage.setItem('hobbyFollowedUsers', JSON.stringify(list));
}

// 9. إغلاق النوافذ
window.onclick = function(event) {
    if (event.target.classList.contains('modal-popup-overlay') || event.target.classList.contains('add-post-overlay')) {
        event.target.style.display = 'none';
    }
    if (!event.target.matches('.fa-ellipsis-h')) {
        document.querySelectorAll('.options-menu').forEach(m => m.style.display = 'none');
    }
}
function togglePostMenu(icon) {
    const menu = icon.nextElementSibling;
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}
function hidePost(item) { item.closest('.post-card').style.display = 'none'; }

// 10. الدردشة
function openChat() {
    const data = JSON.parse(localStorage.getItem('viewingProfile')) || {name: 'مستخدم', img: 'side.png'};
    document.getElementById("chatHeaderName").innerText = data.name;
    document.getElementById("chatHeaderImg").src = data.img;
    document.getElementById("chatBody").innerHTML = ""; 
    document.getElementById("chatModal").style.display = "flex";
}
function closeChat() { document.getElementById("chatModal").style.display = "none"; }
function sendMessage() {
    const val = document.getElementById("chatInput").value; if(!val) return;
    const msg = document.createElement("div"); msg.className="message-bubble message-sent"; msg.innerText=val;
    document.getElementById("chatBody").appendChild(msg); document.getElementById("chatInput").value="";
}