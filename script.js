import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, multiFactor, PhoneAuthProvider, RecaptchaVerifier } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// Initialize global variables
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const storage = window.firebaseStorage;
const analytics = window.firebaseAnalytics;
const adminEmail = 'mzxplaylist@gmail.com';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
const RECAPTCHA_KEY = '6LfAHjYrAAAAAPkR0wl_-korCQj98aP420ZPgrnV';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Utility Functions
const sanitizeInput = (input) => DOMPurify.sanitize(input);

const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

const logError = (error, context) => {
    console.error(`Error in ${context}:`, error.message);
    // Log to Firebase Analytics (optional)
    analytics.logEvent('exception', { description: error.message, context });
};

// Authentication
const initializeAuth = () => {
    onAuthStateChanged(auth, (user) => {
        const adminTab = document.getElementById('admin-tab');
        const myPageTab = document.getElementById('my-page-tab');
        const authLink = document.getElementById('auth-link');
        const preloader = document.getElementById('preloader');
        
        if (user) {
            authLink.innerHTML = `<a href="javascript:void(0)" id="sign-out-button" class="px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-blue-600 hover:text-white rounded-lg transition font-medium">Sign Out</a>`;
            document.getElementById('sign-out-button').addEventListener('click', signOutUser);
            myPageTab.classList.remove('hidden');
            if (user.email === adminEmail) {
                adminTab.classList.remove('hidden');
                loadAdminDashboard();
            }
            loadUserData(user);
        } else {
            authLink.innerHTML = `<a href="javascript:void(0)" id="auth-button" class="px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-blue-600 hover:text-white rounded-lg transition font-medium">Login/Sign Up</a>`;
            document.getElementById('auth-button').addEventListener('click', showLogin);
            myPageTab.classList.add('hidden');
            adminTab.classList.add('hidden');
        }
        
        preloader.style.display = 'none';
        updateCartCount();
        loadShopItems();
        loadCustomWallpapers();
        loadRecentlyViewed();
        loadReviews();
    });
};

const showLogin = () => {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.remove('hidden');
};

const closeLogin = () => {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) loginModal.classList.add('hidden');
};

const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        closeLogin();
    } catch (error) {
        logError(error, 'Google Login');
        alert(`Google login failed: ${error.message}`);
    }
};

const handleEmailLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-auth').value;
    const password = document.getElementById('password').value;
    
    try {
        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (signInError) {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
        }
        
        const user = userCredential.user;
        if (user.email === adminEmail) {
            initializeMFA(user);
        }
        closeLogin();
    } catch (error) {
        logError(error, 'Email Login');
        alert(`Email login failed: ${error.message}`);
    }
};

const initializeMFA = (user) => {
    const mfaModal = document.getElementById('mfa-modal');
    if (!mfaModal) return;
    
    const recaptchaVerifier = new RecaptchaVerifier('mfa-recaptcha', {
        'size': 'invisible',
        'callback': () => {}
    }, auth);
    
    const phoneProvider = new PhoneAuthProvider(auth);
    // Simulate phone number for demo; replace with actual user phone in production
    phoneProvider.verifyPhoneNumber('+1234567890', recaptchaVerifier)
        .then((verificationId) => {
            window.verificationId = verificationId;
            mfaModal.classList.remove('hidden');
            alert('OTP sent to your phone. Please check (simulated for demo).');
        })
        .catch((error) => {
            logError(error, 'MFA Initialization');
            alert(`MFA setup failed: ${error.message}`);
        });
};

const handleMFAVerification = async (e) => {
    e.preventDefault();
    const code = document.getElementById('mfa-code').value;
    
    try {
        const credential = PhoneAuthProvider.credential(window.verificationId, code);
        await multiFactor(auth.currentUser).enroll(credential);
        alert('MFA verified successfully!');
        closeMFA();
    } catch (error) {
        logError(error, 'MFA Verification');
        alert(`MFA verification failed: ${error.message}`);
    }
};

const closeMFA = () => {
    const mfaModal = document.getElementById('mfa-modal');
    if (mfaModal) mfaModal.classList.add('hidden');
};

const resetPassword = async () => {
    const email = document.getElementById('profile-email')?.value;
    if (!email) {
        alert('Please enter your email in the profile section.');
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent!');
    } catch (error) {
        logError(error, 'Password Reset');
        alert(`Password reset failed: ${error.message}`);
    }
};

const signOutUser = async () => {
    try {
        await signOut(auth);
        alert('Signed out successfully!');
    } catch (error) {
        logError(error, 'Sign Out');
        alert(`Sign out failed: ${error.message}`);
    }
};

// Theme and Menu
const toggleTheme = () => {
    document.body.classList.toggle('dark');
    const themeIcon = document.querySelector('#theme-toggle svg');
    themeIcon.innerHTML = document.body.classList.contains('dark') ?
        '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>':
        '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>';
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};

const toggleMenu = () => {
    const nav = document.querySelector('.nav-links');
    const menuToggle = document.querySelector('.menu-toggle');
    if (!nav || !menuToggle) return;
    
    nav.classList.toggle('hidden');
    const expanded = nav.classList.contains('hidden') ? 'false' : 'true';
    menuToggle.setAttribute('aria-expanded', expanded);
    gsap.to(nav, {
        height: nav.classList.contains('hidden') ? 0 : 'auto',
        opacity: nav.classList.contains('hidden') ? 0 : 1,
        duration: 0.3,
        ease: 'power2.out'
    });
};

// User Data
const loadUserData = async (user) => {
    try {
        const profileName = document.getElementById('profile-name');
        const profileEmail = document.getElementById('profile-email');
        if (profileName) profileName.value = user.displayName || '';
        if (profileEmail) profileEmail.value = user.email || '';
        
        await Promise.all([
            loadOrderHistory(user.uid),
            loadWishlist(user.uid),
            loadNotifications(user.uid)
        ]);
    } catch (error) {
        logError(error, 'Load User Data');
    }
};

const loadOrderHistory = async (userId) => {
    const orderList = document.getElementById('order-list');
    if (!orderList) return;
    
    orderList.innerHTML = '';
    try {
        const orders = await getDocs(query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
        if (orders.empty) {
            orderList.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No orders found.</p>';
            return;
        }
        
        orders.forEach((doc) => {
            const data = doc.data();
            const orderDiv = document.createElement('div');
            orderDiv.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg';
            orderDiv.innerHTML = `
                <p><strong>Order ID:</strong> ${doc.id}</p>
                <p><strong>Items:</strong> ${data.items.map(item => sanitizeInput(item.title)).join(', ')}</p>
                <p><strong>Total:</strong> $${(data.total / 100).toFixed(2)}</p>
                <p><strong>Status:</strong> ${sanitizeInput(data.status)}</p>
            `;
            orderList.appendChild(orderDiv);
        });
    } catch (error) {
        logError(error, 'Load Order History');
        orderList.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading orders.</p>';
    }
};

const loadWishlist = async (userId) => {
    const wishlistItems = document.getElementById('wishlist-items');
    if (!wishlistItems) return;
    
    wishlistItems.innerHTML = '';
    try {
        const wishlist = await getDocs(query(collection(db, 'wishlist'), where('userId', '==', userId), where('deleted', '!=', true)));
        if (wishlist.empty) {
            wishlistItems.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No items in wishlist.</p>';
            return;
        }
        
        wishlist.forEach((doc) => {
            const data = doc.data();
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow';
            itemDiv.innerHTML = `
                <img src="${sanitizeInput(data.image)}" alt="${sanitizeInput(data.title)}" class="w-full h-32 object-cover rounded" loading="lazy">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">${sanitizeInput(data.title)}</h3>
                <p class="text-gray-600 dark:text-gray-400">$${parseFloat(data.price / 100).toFixed(2)}</p>
                <button onclick="removeFromWishlist('${doc.id}')" class="bg-red-500 text-white px-4 py-2 rounded mt-2 hover:bg-red-600 transition">Remove</button>
            `;
            wishlistItems.appendChild(itemDiv);
        });
    } catch (error) {
        logError(error, 'Load Wishlist');
        wishlistItems.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading wishlist.</p>';
    }
};

const removeFromWishlist = async (itemId) => {
    try {
        await deleteDoc(doc(db, 'wishlist', itemId));
        loadWishlist(auth.currentUser.uid);
    } catch (error) {
        logError(error, 'Remove Wishlist Item');
        alert(`Failed to remove item: ${error.message}`);
    }
};

const loadNotifications = async (userId) => {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;
    
    notificationList.innerHTML = '';
    try {
        const notifications = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
        if (notifications.empty) {
            notificationList.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No notifications.</p>';
            return;
        }
        
        notifications.forEach((doc) => {
            const data = doc.data();
            const notifLi = document.createElement('li');
            notifLi.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg';
            notifLi.innerHTML = `<p>${sanitizeInput(data.message)}</p>`;
            notificationList.appendChild(notifLi);
        });
    } catch (error) {
        logError(error, 'Load Notifications');
        notificationList.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading notifications.</p>';
    }
};

// Admin Dashboard
const loadAdminDashboard = async () => {
    const adminSection = document.getElementById('admin');
    if (!adminSection) return;
    
    adminSection.classList.remove('hidden');
    await Promise.all([
        loadCustomerRequests(),
        loadContacts(),
        loadAnalytics()
    ]);
};

const loadCustomerRequests = async () => {
    const requestList = document.getElementById('request-list');
    if (!requestList) return;
    
    requestList.innerHTML = '';
    try {
        const requests = await getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc')));
        if (requests.empty) {
            requestList.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No customer requests.</p>';
            return;
        }
        
        requests.forEach((doc) => {
            const data = doc.data();
            const requestDiv = document.createElement('div');
            requestDiv.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg';
            requestDiv.innerHTML = `
                <p><strong>Name:</strong> ${sanitizeInput(data.name)}</p>
                <p><strong>Email:</strong> ${sanitizeInput(data.email)}</p>
                <p><strong>Type:</strong> ${sanitizeInput(data.designType)}</p>
                <p><strong>Description:</strong> ${sanitizeInput(data.description)}</p>
                <p><strong>Status:</strong> ${sanitizeInput(data.status || 'Pending')}</p>
                <textarea placeholder="Response" class="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600"></textarea>
                <div class="flex gap-2 mt-2">
                    <button onclick="respondToRequest('${doc.id}', this)" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Send Response</button>
                    <button onclick="updateRequestStatus('${doc.id}', 'Approved')" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition">Approve</button>
                    <button onclick="updateRequestStatus('${doc.id}', 'Rejected')" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">Reject</button>
                </div>
            `;
            requestList.appendChild(requestDiv);
        });
    } catch (error) {
        logError(error, 'Load Customer Requests');
        requestList.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading requests.</p>';
    }
};

const respondToRequest = async (requestId, button) => {
    const response = button.previousElementSibling.value;
    if (!response) {
        alert('Please enter a response.');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'requests', requestId), {
            response: sanitizeInput(response),
            status: 'Responded',
            respondedAt: new Date()
        });
        alert('Response sent!');
        loadCustomerRequests();
    } catch (error) {
        logError(error, 'Respond to Request');
        alert(`Failed to send response: ${error.message}`);
    }
};

const updateRequestStatus = async (requestId, status) => {
    try {
        await updateDoc(doc(db, 'requests', requestId), {
            status,
            updatedAt: new Date()
        });
        alert(`Request ${status}!`);
        loadCustomerRequests();
    } catch (error) {
        logError(error, 'Update Request Status');
        alert(`Failed to update status: ${error.message}`);
    }
};

const loadContacts = async () => {
    const contactList = document.getElementById('contact-list');
    if (!contactList) return;
    
    contactList.innerHTML = '';
    try {
        const contacts = await getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc')));
        if (contacts.empty) {
            contactList.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No contact messages.</p>';
            return;
        }
        
        contacts.forEach((doc) => {
            const data = doc.data();
            const contactDiv = document.createElement('div');
            contactDiv.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg';
            contactDiv.innerHTML = `
                <p><strong>Name:</strong> ${sanitizeInput(data.name)}</p>
                <p><strong>Email:</strong> ${sanitizeInput(data.email)}</p>
                <p><strong>Message:</strong> ${sanitizeInput(data.message)}</p>
                <textarea placeholder="Reply" class="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600"></textarea>
                <button onclick="replyToContact('${doc.id}', this)" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Send Reply</button>
            `;
            contactList.appendChild(contactDiv);
        });
    } catch (error) {
        logError(error, 'Load Contacts');
        contactList.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading contacts.</p>';
    }
};

const replyToContact = async (contactId, button) => {
    const reply = button.previousElementSibling.value;
    if (!reply) {
        alert('Please enter a reply.');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'contacts', contactId), {
            reply: sanitizeInput(reply),
            replied: true,
            repliedAt: new Date()
        });
        alert('Reply sent!');
        loadContacts();
    } catch (error) {
        logError(error, 'Reply to Contact');
        alert(`Failed to send reply: ${error.message}`);
    }
};

const loadAnalytics = async () => {
    const analyticsData = document.getElementById('analytics-data');
    if (!analyticsData) return;
    
    try {
        const [orders, requests, contacts] = await Promise.all([
            getDocs(collection(db, 'orders')),
            getDocs(collection(db, 'requests')),
            getDocs(collection(db, 'contacts'))
        ]);
        
        const totalRevenue = orders.docs.reduce((sum, doc) => sum + (doc.data().total / 100), 0);
        const totalOrders = orders.size;
        const totalRequests = requests.size;
        const totalContacts = contacts.size;
        
        analyticsData.innerHTML = `
            <p><strong>Total Revenue:</strong> $${totalRevenue.toFixed(2)}</p>
            <p><strong>Total Orders:</strong> ${totalOrders}</p>
            <p><strong>Total Custom Requests:</strong> ${totalRequests}</p>
            <p><strong>Total Contact Messages:</strong> ${totalContacts}</p>
        `;
    } catch (error) {
        logError(error, 'Load Analytics');
        analyticsData.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading analytics.</p>';
    }
};

// Shop and Products
const loadShopItems = async () => {
    const shopGrid = document.getElementById('shop-grid');
    if (!shopGrid) return;
    
    shopGrid.innerHTML = '';
    try {
        const products = await getDocs(query(collection(db, 'products'), where('type', '!=', 'Custom Wallpaper'), orderBy('createdAt', 'desc')));
        if (products.empty) {
            shopGrid.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No products available.</p>';
            return;
        }
        
        products.forEach((doc) => {
            const data = doc.data();
            const productDiv = document.createElement('div');
            productDiv.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition';
            productDiv.innerHTML = `
                <img src="${sanitizeInput(data.image)}" alt="${sanitizeInput(data.title)}" class="w-full h-48 object-cover rounded-lg" loading="lazy">
                <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-4">${sanitizeInput(data.title)}</h3>
                <p class="text-gray-600 dark:text-gray-400">$${parseFloat(data.price / 100).toFixed(2)}</p>
                <div class="flex gap-2 mt-4">
                    <button onclick="addToCart('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="cta-button bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-green-500 transition">Add to Cart</button>
                    <button onclick="addToWishlist('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="bg-gray-500 text-white px-4 py-2 rounded-full hover:bg-gray-600 transition">Add to Wishlist</button>
                </div>
            `;
            productDiv.addEventListener('click', () => addToRecentlyViewed(data.title, data.price, data.image));
            shopGrid.appendChild(productDiv);
        });
    } catch (error) {
        logError(error, 'Load Shop Items');
        shopGrid.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading products.</p>';
    }
};

const loadCustomWallpapers = async () => {
    const customGrid = document.getElementById('custom-wallpapers-grid');
    if (!customGrid) return;
    
    customGrid.innerHTML = '';
    try {
        const products = await getDocs(query(collection(db, 'products'), where('type', '==', 'Custom Wallpaper'), orderBy('createdAt', 'desc')));
        if (products.empty) {
            customGrid.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No custom wallpapers available.</p>';
            return;
        }
        
        products.forEach((doc) => {
            const data = doc.data();
            const productDiv = document.createElement('div');
            productDiv.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition';
            productDiv.innerHTML = `
                <img src="${sanitizeInput(data.image)}" alt="${sanitizeInput(data.title)}" class="w-full h-48 object-cover rounded-lg" loading="lazy">
                <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-4">${sanitizeInput(data.title)}</h3>
                <p class="text-gray-600 dark:text-gray-400">$${parseFloat(data.price / 100).toFixed(2)}</p>
                <div class="flex gap-2 mt-4">
                    <button onclick="addToCart('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="cta-button bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-green-500 transition">Add to Cart</button>
                    <button onclick="addToWishlist('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="bg-gray-500 text-white px-4 py-2 rounded-full hover:bg-gray-600 transition">Add to Wishlist</button>
                </div>
            `;
            productDiv.addEventListener('click', () => addToRecentlyViewed(data.title, data.price, data.image));
            customGrid.appendChild(productDiv);
        });
    } catch (error) {
        logError(error, 'Load Custom Wallpapers');
        customGrid.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading custom wallpapers.</p>';
    }
};

const searchShop = debounce(async () => {
    const searchTerm = sanitizeInput(document.getElementById('search')?.value.toLowerCase() || '');
    const suggestions = document.getElementById('search-suggestions');
    const shopGrid = document.getElementById('shop-grid');
    if (!suggestions || !shopGrid) return;
    
    suggestions.innerHTML = '';
    suggestions.classList.add('hidden');
    shopGrid.innerHTML = '';
    
    try {
        const products = await getDocs(collection(db, 'products'));
        const filteredProducts = [];
        
        products.forEach((doc) => {
            const data = doc.data();
            if (data.title.toLowerCase().includes(searchTerm) && data.type !== 'Custom Wallpaper') {
                filteredProducts.push(data);
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg';
                suggestionDiv.textContent = sanitizeInput(data.title);
                suggestionDiv.addEventListener('click', () => {
                    document.getElementById('search').value = data.title;
                    searchShop();
                });
                suggestions.appendChild(suggestionDiv);
            }
        });
        
        if (filteredProducts.length > 0) {
            suggestions.classList.remove('hidden');
        }
        
        if (filteredProducts.length === 0) {
            shopGrid.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No products found.</p>';
            return;
        }
        
        filteredProducts.forEach((data) => {
            const productDiv = document.createElement('div');
            productDiv.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition';
            productDiv.innerHTML = `
                <img src="${sanitizeInput(data.image)}" alt="${sanitizeInput(data.title)}" class="w-full h-48 object-cover rounded-lg" loading="lazy">
                <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-4">${sanitizeInput(data.title)}</h3>
                <p class="text-gray-600 dark:text-gray-400">$${parseFloat(data.price / 100).toFixed(2)}</p>
                <div class="flex gap-2 mt-4">
                    <button onclick="addToCart('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="cta-button bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-green-500 transition">Add to Cart</button>
                    <button onclick="addToWishlist('${sanitizeInput(data.title)}', ${data.price}, '${sanitizeInput(data.image)}')" class="bg-gray-500 text-white px-4 py-2 rounded-full hover:bg-gray-600 transition">Add to Wishlist</button>
                </div>
            `;
            shopGrid.appendChild(productDiv);
        });
    } catch (error) {
        logError(error, 'Search Shop');
        shopGrid.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error searching products.</p>';
    }
}, 300);

// Cart
const addToCart = async (title, price, image) => {
    grecaptcha.ready(async () => {
        try {
            const token = await grecaptcha.execute(RECAPTCHA_KEY, { action: 'add_to_cart' });
            // Replace with actual backend endpoint in production
            const response = await fetch('https://your-backend-endpoint/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success && result.score >= 0.5) {
                cart.push({ title: sanitizeInput(title), price, image: sanitizeInput(image) });
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
                alert(`${title} added to cart!`);
            } else {
                alert('ReCAPTCHA verification failed. Please try again.');
            }
        } catch (error) {
            logError(error, 'Add to Cart');
            alert(`Failed to add to cart: ${error.message}`);
        }
    });
};

const updateCartCount = () => {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) cartCount.textContent = cart.length;
};

const showCart = () => {
    const cartModal = document.getElementById('cart-modal');
    const cartItems = document.getElementById('cart-items');
    if (!cartModal || !cartItems) return;
    
    cartItems.innerHTML = '';
    let subtotal = 0;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">Your cart is empty.</p>';
        document.getElementById('cart-subtotal').textContent = '0.00';
        document.getElementById('cart-discount').textContent = '0.00';
        document.getElementById('cart-total').textContent = '0.00';
        cartModal.classList.remove('hidden');
        return;
    }
    
    cart.forEach((item, index) => {
        subtotal += item.price;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex justify-between items-center mb-4';
        itemDiv.innerHTML = `
            <div class="flex items-center gap-4">
                <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.title)}" class="w-16 h-16 object-cover rounded">
                <div>
                    <h4 class="text-lg font-semibold text-gray-800 dark:text-gray-200">${sanitizeInput(item.title)}</h4>
                    <p class="text-gray-600 dark:text-gray-400">$${parseFloat(item.price / 100).toFixed(2)}</p>
                </div>
            </div>
            <button onclick="removeFromCart(${index})" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">Remove</button>
        `;
        cartItems.appendChild(itemDiv);
    });
    
    const discount = subtotal * 0.1; // 10% discount
    document.getElementById('cart-subtotal').textContent = (subtotal / 100).toFixed(2);
    document.getElementById('cart-discount').textContent = (discount / 100).toFixed(2);
    document.getElementById('cart-total').textContent = ((subtotal - discount) / 100).toFixed(2);
    cartModal.classList.remove('hidden');
};

const removeFromCart = (index) => {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showCart();
};

const closeCart = () => {
    const cartModal = document.getElementById('cart-modal');
    if (cartModal) cartModal.classList.add('hidden');
};

const checkout = async () => {
    if (!auth.currentUser) {
        alert('Please log in to checkout.');
        showLogin();
        return;
    }
    
    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }
    
    try {
        const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
        const total = subtotal * 0.9; // After 10% discount
        await addDoc(collection(db, 'orders'), {
            userId: auth.currentUser.uid,
            items: cart.map(item => ({
                title: sanitizeInput(item.title),
                price: item.price,
                image: sanitizeInput(item.image)
            })),
            total,
            status: 'Pending',
            createdAt: new Date()
        });
        
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        closeCart();
        alert('Checkout successful! Check your order status in My Page.');
    } catch (error) {
        logError(error, 'Checkout');
        alert(`Checkout failed: ${error.message}`);
    }
};

// Wishlist
const addToWishlist = async (title, price, image) => {
    if (!auth.currentUser) {
        alert('Please log in to add to wishlist.');
        showLogin();
        return;
    }
    
    try {
        await addDoc(collection(db, 'wishlist'), {
            userId: auth.currentUser.uid,
            title: sanitizeInput(title),
            price,
            image: sanitizeInput(image),
            createdAt: new Date()
        });
        alert(`${title} added to wishlist!`);
        loadWishlist(auth.currentUser.uid);
    } catch (error) {
        logError(error, 'Add to Wishlist');
        alert(`Failed to add to wishlist: ${error.message}`);
    }
};

// Recently Viewed
const addToRecentlyViewed = (title, price, image) => {
    recentlyViewed = recentlyViewed.filter(item => item.title !== title);
    recentlyViewed.unshift({ title: sanitizeInput(title), price, image: sanitizeInput(image) });
    if (recentlyViewed.length > 5) recentlyViewed.pop();
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    loadRecentlyViewed();
};

const loadRecentlyViewed = () => {
    const recentlyViewedGrid = document.getElementById('recently-viewed-grid');
    if (!recentlyViewedGrid) return;
    
    recentlyViewedGrid.innerHTML = recentlyViewed.length > 0 ? '' : '<p class="text-center text-gray-600 dark:text-gray-400">No recently viewed items.</p>';
    
    recentlyViewed.forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition';
        itemDiv.innerHTML = `
            <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.title)}" class="w-full h-48 object-cover rounded-lg" loading="lazy">
            <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-4">${sanitizeInput(item.title)}</h3>
            <p class="text-gray-600 dark:text-gray-400">$${parseFloat(item.price / 100).toFixed(2)}</p>
        `;
        recentlyViewedGrid.appendChild(itemDiv);
    });
};

// Reviews
const loadReviews = async () => {
    const reviewsList = document.getElementById('reviews-list');
    if (!reviewsList) return;
    
    reviewsList.innerHTML = '';
    try {
        const reviews = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
        if (reviews.empty) {
            reviewsList.innerHTML = '<p class="text-center text-gray-600 dark:text-gray-400">No reviews yet.</p>';
            return;
        }
        
        reviews.forEach((doc) => {
            const data = doc.data();
            const reviewDiv = document.createElement('div');
            reviewDiv.className = 'bg-gray-100 dark:bg-gray-700 p-4 rounded-lg';
            reviewDiv.innerHTML = `
                <p><strong>Rating:</strong> ${sanitizeInput(data.rating)} Stars</p>
                <p>${sanitizeInput(data.comment)}</p>
                ${data.image ? `<img src="${sanitizeInput(data.image)}" alt="Review image" class="w-32 h-32 object-cover rounded mt-2" loading="lazy">` : ''}
            `;
            reviewsList.appendChild(reviewDiv);
        });
    } catch (error) {
        logError(error, 'Load Reviews');
        reviewsList.innerHTML = '<p class="text-center text-red-600 dark:text-red-400">Error loading reviews.</p>';
    }
};

const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
        alert('Please log in to submit a review.');
        showLogin();
        return;
    }
    
    grecaptcha.ready(async () => {
        try {
            const token = await grecaptcha.execute(RECAPTCHA_KEY, { action: 'submit_review' });
            const response = await fetch('https://your-backend-endpoint/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success && result.score >= 0.5) {
                const rating = document.getElementById('review-rating').value;
                const comment = sanitizeInput(document.getElementById('review-comment').value);
                const file = document.getElementById('review-image').files[0];
                let imageUrl = '';
                
                if (file) {
                    if (!file.type.startsWith('image/') || file.size > MAX_FILE_SIZE) {
                        alert('Please upload a valid image file (max 5MB).');
                        return;
                    }
                    const storageRef = ref(storage, `reviews/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    imageUrl = await getDownloadURL(storageRef);
                }
                
                await addDoc(collection(db, 'reviews'), {
                    userId: auth.currentUser.uid,
                    rating,
                    comment,
                    image: imageUrl,
                    createdAt: new Date()
                });
                
                alert('Review submitted!');
                loadReviews();
                document.getElementById('review-form').reset();
            } else {
                alert('ReCAPTCHA verification failed. Please try again.');
            }
        } catch (error) {
            logError(error, 'Submit Review');
            alert(`Failed to submit review: ${error.message}`);
        }
    });
};

// Custom Art Request
const handleRequestSubmit = async (e) => {
    e.preventDefault();
    grecaptcha.ready(async () => {
        try {
            const token = await grecaptcha.execute(RECAPTCHA_KEY, { action: 'submit_request' });
            const response = await fetch('https://your-backend-endpoint/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success && result.score >= 0.5) {
                const name = sanitizeInput(document.getElementById('name').value);
                const email = sanitizeInput(document.getElementById('email').value);
                const designType = document.getElementById('design-type').value;
                const description = sanitizeInput(document.getElementById('description').value);
                const dimensions = sanitizeInput(document.getElementById('dimensions').value);
                const file = document.getElementById('xlsx-file').files[0];
                let fileData = '';
                
                if (file) {
                    if (file.size > MAX_FILE_SIZE) {
                        alert('File size exceeds 5MB limit.');
                        return;
                    }
                    const storageRef = ref(storage, `requests/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    fileData = await getDownloadURL(storageRef);
                }
                
                await addDoc(collection(db, 'requests'), {
                    name,
                    email,
                    designType,
                    description,
                    dimensions,
                    fileData,
                    status: 'Pending',
                    createdAt: new Date()
                });
                
                const modal = document.getElementById('modal');
                if (modal) modal.classList.remove('hidden');
                document.getElementById('request-form').reset();
            } else {
                alert('ReCAPTCHA verification failed. Please try again.');
            }
        } catch (error) {
            logError(error, 'Submit Request');
            alert(`Failed to submit request: ${error.message}`);
        }
    });
};

const closeModal = () => {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.add('hidden');
};

// Contact Form
const handleContactSubmit = async (e) => {
    e.preventDefault();
    grecaptcha.ready(async () => {
        try {
            const token = await grecaptcha.execute(RECAPTCHA_KEY, { action: 'submit_contact' });
            const response = await fetch('https://your-backend-endpoint/verify-recaptcha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const result = await response.json();
            
            if (result.success && result.score >= 0.5) {
                const name = sanitizeInput(document.getElementById('contact-name').value);
                const email = sanitizeInput(document.getElementById('contact-email').value);
                const message = sanitizeInput(document.getElementById('message').value);
                
                await addDoc(collection(db, 'contacts'), {
                    name,
                    email,
                    message,
                    createdAt: new Date()
                });
                
                alert('Message sent!');
                document.getElementById('contact-form').reset();
            } else {
                alert('ReCAPTCHA verification failed. Please try again.');
            }
        } catch (error) {
            logError(error, 'Submit Contact');
            alert(`Failed to submit message: ${error.message}`);
        }
    });
};

// Profile
const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
        alert('Please log in to update your profile.');
        showLogin();
        return;
    }
    
    try {
        const name = sanitizeInput(document.getElementById('profile-name').value);
        const preferences = sanitizeInput(document.getElementById('profile-preferences').value);
        
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            displayName: name,
            preferences,
            updatedAt: new Date()
        });
        
        alert('Profile updated!');
    } catch (error) {
        logError(error, 'Update Profile');
        alert(`Failed to update profile: ${error.message}`);
    }
};

// Website Customization
const handleCustomizeSubmit = async (e) => {
    e.preventDefault();
    try {
        const primaryColor = document.getElementById('primary-color').value;
        const secondaryColor = document.getElementById('secondary-color').value;
        const fontFamily = document.getElementById('font-family').value;
        const backgroundImage = document.getElementById('background-image').value || 'https://images.unsplash.com/photo-1618949474978-87ae91db7c5b?auto=format&fit=crop&w=1920&q=80';
        
        document.documentElement.style.setProperty('--primary-color', primaryColor);
        document.documentElement.style.setProperty('--secondary-color', secondaryColor);
        document.documentElement.style.setProperty('--font-family', fontFamily);
        document.documentElement.style.setProperty('--background-image', `url('${sanitizeInput(backgroundImage)}')`);
        document.body.style.fontFamily = fontFamily;
        
        await updateDoc(doc(db, 'settings', 'website'), {
            primaryColor,
            secondaryColor,
            fontFamily,
            backgroundImage,
            updatedAt: new Date()
        });
        
        alert('Website customized!');
    } catch (error) {
        logError(error, 'Customize Website');
        alert(`Failed to customize website: ${error.message}`);
    }
};

// Product Upload
const handleWallpaperSubmit = async (e) => {
    e.preventDefault();
    try {
        const title = sanitizeInput(document.getElementById('wallpaper-title').value);
        const type = document.getElementById('wallpaper-type').value;
        const price = parseInt(document.getElementById('wallpaper-price').value);
        const file = document.getElementById('wallpaper-file').files[0];
        
        if (!file || !file.type.startsWith('image/') || file.size > MAX_FILE_SIZE) {
            alert('Please upload a valid image file (max 5MB).');
            return;
        }
        
        const storageRef = ref(storage, `wallpapers/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        await addDoc(collection(db, 'products'), {
            title,
            type,
            price,
            image: url,
            createdAt: new Date()
        });
        
        alert('Wallpaper uploaded!');
        loadShopItems();
        loadCustomWallpapers();
        document.getElementById('wallpaper-form').reset();
    } catch (error) {
        logError(error, 'Upload Wallpaper');
        alert(`Failed to upload wallpaper: ${error.message}`);
    }
};

// Coupon
const applyCoupon = () => {
    const couponCode = document.getElementById('coupon-code')?.value;
    if (couponCode === 'VIBES10') {
        alert('Coupon applied! 10% off your order.');
        // Apply discount logic in checkout if needed
    } else {
        alert('Invalid coupon code.');
    }
};

// Initialize Event Listeners
const initializeEventListeners = () => {
    document.getElementById('email-form')?.addEventListener('submit', handleEmailLogin);
    document.getElementById('mfa-form')?.addEventListener('submit', handleMFAVerification);
    document.getElementById('wallpaper-form')?.addEventListener('submit', handleWallpaperSubmit);
    document.getElementById('customize-form')?.addEventListener('submit', handleCustomizeSubmit);
    document.getElementById('review-form')?.addEventListener('submit', handleReviewSubmit);
    document.getElementById('request-form')?.addEventListener('submit', handleRequestSubmit);
    document.getElementById('contact-form')?.addEventListener('submit', handleContactSubmit);
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('menu-toggle')?.addEventListener('click', toggleMenu);
    document.getElementById('cart-link')?.addEventListener('click', showCart);
    document.getElementById('search')?.addEventListener('input', searchShop);
    document.getElementById('coupon-button')?.addEventListener('click', applyCoupon);
};

// Swiper Initialization
const initializeSwiper = () => {
    if (typeof Swiper !== 'undefined') {
        new Swiper('.swiper-container', {
            slidesPerView: 1,
            spaceBetween: 30,
            loop: true,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            breakpoints: {
                640: { slidesPerView: 2 },
                1024: { slidesPerView: 3 },
            }
        });
    }
};

// GSAP Animations
const initializeAnimations = () => {
    if (typeof gsap !== 'undefined') {
        gsap.from('.hero h1', { opacity: 0, y: 50, duration: 1, delay: 0.5 });
        gsap.from('.hero p', { opacity: 0, y: 50, duration: 1, delay: 1 });
        gsap.from('.phone-mockup', { scale: 0, duration: 1, delay: 1.5, ease: 'elastic.out(1, 0.5)' });
        
        gsap.utils.toArray('.section').forEach((section) => {
            gsap.from(section, {
                opacity: 0,
                y: 100,
                duration: 1,
                scrollTrigger: {
                    trigger: section,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                }
            });
        });
    }
};

// Vanilla Tilt
const initializeTilt = () => {
    if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll('[data-tilt]'), {
            max: 25,
            speed: 400,
            glare: true,
            'max-glare': 0.5
        });
    }
};

// Initialize Application
const init = () => {
    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
        toggleTheme();
    }
    
    initializeAuth();
    initializeEventListeners();
    initializeSwiper();
    initializeAnimations();
    initializeTilt();
};

// Run Application
document.addEventListener('DOMContentLoaded', init);