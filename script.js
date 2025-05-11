document.addEventListener('DOMContentLoaded', () => {
  // Dependency Check
  if (!window.firebaseAuth || !window.firebaseDb || !window.firebaseStorage || !window.DOMPurify || !window.gsap || !window.ScrollTrigger || !window.VanillaTilt || !window.Swiper) {
    console.error('Required dependencies missing. Please check script imports.');
    document.getElementById('preloader').style.display = 'none';
    document.getElementById('fallback-ui').style.display = 'block';
    return;
  }

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  const storage = window.firebaseStorage;
  const analytics = window.firebaseAnalytics;
  const messaging = window.firebaseMessaging;
  const { sanitize } = window.DOMPurify;

  // Cart, Wishlist, and Recently Viewed
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
  let couponDiscount = 0;

  // Shop Items
  const shopItems = [
    { id: 1, name: 'Wallpapers', category: 'Wallpapers', price: 299, stock: 10, gumroadLink: 'https://gumroad.com/l/artvibestudio-wallpapers', image: 'images/wallpaper.webp', popularity: 100, createdAt: '2025-01-01' },
    { id: 2, name: 'Stickers', category: 'Stickers', price: 299, stock: 10, gumroadLink: 'https://gumroad.com/l/artvibestudio-stickers', image: 'images/stickers.webp', popularity: 80, createdAt: '2025-02-01' },
    { id: 3, name: 'Social Media Graphics', category: 'Social Media Graphics', price: 299, stock: 10, gumroadLink: 'https://gumroad.com/l/artvibestudio-graphics', image: 'images/social-media.webp', popularity: 60, createdAt: '2025-03-01' },
    { id: 4, name: 'Printable Art', category: 'Printable Art', price: 299, stock: 10, gumroadLink: 'https://gumroad.com/l/artvibestudio-art', image: 'images/printable.webp', popularity: 40, createdAt: '2025-04-01' }
  ];

  // Preloader
  let loadProgress = 0;
  const totalAssets = document.querySelectorAll('img').length;
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', () => {
      loadProgress += 100 / totalAssets;
      document.getElementById('progress').style.width = `${loadProgress}%`;
    });
    img.addEventListener('error', () => {
      loadProgress += 100 / totalAssets;
      document.getElementById('progress').style.width = `${loadProgress}%`;
    });
  });

  window.addEventListener('load', () => {
    setTimeout(() => {
      const preloader = document.getElementById('preloader');
      preloader.style.opacity = '0';
      setTimeout(() => preloader.style.display = 'none', 500);
    }, 1500);
  });

  // Swiper Carousel
  new Swiper('.swiper-container', {
    slidesPerView: 1,
    spaceBetween: 20,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    breakpoints: {
      640: { slidesPerView: 2 },
      1024: { slidesPerView: 3 }
    }
  });

  // GSAP Animations
  gsap.utils.toArray('.section').forEach(section => {
    gsap.from(section, {
      opacity: 0,
      y: 80,
      duration: 1,
      scrollTrigger: {
        trigger: section,
        start: 'top 85%',
        toggleActions: 'play none none reset'
      }
    });
  });

  gsap.from('.gallery-item, .shop-item', {
    opacity: 0,
    scale: 0.9,
    stagger: 0.15,
    duration: 0.8,
    scrollTrigger: {
      trigger: '.gallery-grid, .shop-grid',
      start: 'top 85%'
    }
  });

  // Vanilla Tilt
  VanillaTilt.init(document.querySelectorAll('[data-tilt]'), {
    max: 15,
    speed: 400,
    glare: true,
    'max-glare': 0.3
  });

  // Smooth Scrolling and Page Transitions
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const target = document.getElementById(targetId);
      if (target) {
        gsap.to(window, {
          scrollTo: target,
          duration: 1,
          ease: 'power2.out',
          onComplete: () => {
            document.querySelectorAll('.nav-tabs a').forEach(tab => tab.setAttribute('aria-selected', 'false'));
            this.setAttribute('aria-selected', 'true');
          }
        });
      }
      closeMenu();
    });
  });

  // Parallax Effect
  window.addEventListener('scroll', () => {
    gsap.utils.toArray('.parallax-bg').forEach(bg => {
      const speed = 0.4;
      const yPos = -(window.pageYOffset * speed);
      gsap.to(bg, { backgroundPositionY: yPos, duration: 0.1 });
    });
  });

  // Theme Toggle
  window.toggleTheme = function() {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    logAnalyticsEvent('theme_toggle', { theme: document.body.classList.contains('dark') ? 'dark' : 'light' });
  };

  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
  }

  // Menu Toggle
  window.toggleMenu = function() {
    const menu = document.querySelector('.tab-nav');
    const toggle = document.querySelector('.menu-toggle');
    const isOpen = menu.classList.toggle('active');
    toggle.setAttribute('aria-expanded', isOpen);
  };

  window.closeMenu = function() {
    document.querySelector('.tab-nav').classList.remove('active');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  };

  // Encryption
  function encryptData(data) {
    if (!data) return '';
    return btoa(data); // Simplified; replace with AES-256 in production
  }

  function decryptData(data) {
    if (!data) return '';
    try {
      return atob(data); // Simplified; replace with AES-256 in production
    } catch (e) {
      return '';
    }
  }

  // Analytics and Error Logging
  function logAnalyticsEvent(eventName, params) {
    if (analytics) {
      firebase.analytics().logEvent(eventName, params);
    }
  }

  async function logError(error) {
    try {
      await db.collection('errors').add({
        message: error.message,
        stack: error.stack || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: auth.currentUser ? auth.currentUser.uid : null
      });
    } catch (e) {
      console.error('Error logging error:', e);
    }
  }

  // Notifications
  function addNotification(message) {
    const notificationList = document.getElementById('notification-list');
    const li = document.createElement('li');
    li.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center';
    li.innerHTML = `<span>${sanitize(message)}</span><button onclick="this.parentElement.remove()" aria-label="Dismiss notification" class="text-red-500 hover:text-red-600">✕</button>`;
    notificationList.prepend(li);
    setTimeout(() => li.remove(), 5000);
  }

  async function sendPushNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('ArtVibeStudio', {
        body: message,
        icon: '/favicon.ico'
      });
    }
  }

  // Authentication
  auth.onAuthStateChanged(user => {
    const myPageTab = document.getElementById('my-page-tab');
    const myPageSection = document.getElementById('my-page');
    const authLink = document.getElementById('auth-link');
    const reviewForm = document.getElementById('review-form');
    if (user) {
      myPageTab.classList.remove('hidden');
      myPageSection.classList.remove('hidden');
      authLink.innerHTML = `<a href="javascript:void(0)" onclick="signOutUser()" aria-label="Sign out">Sign Out</a>`;
      reviewForm.classList.remove('hidden');
      loadUserData(user);
      syncCartWithFirestore(user.uid);
      syncWishlistWithFirestore(user.uid);
      if (user.providerData.some(p => p.providerId !== 'password')) {
        addNotification(`Welcome, ${sanitize(user.displayName || user.email)}! You logged in with ${user.providerData[0].providerId}.`);
      }
      if (!user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        user.sendEmailVerification().then(() => {
          addNotification('Verification email sent. Please check your inbox.');
        });
      }
    } else {
      myPageTab.classList.add('hidden');
      myPageSection.classList.add('hidden');
      authLink.innerHTML = `<a href="javascript:void(0)" onclick="showLogin()" aria-label="Login or sign up">Login/Sign Up</a>`;
      reviewForm.classList.add('hidden');
      cart = [];
      wishlist = [];
      localStorage.removeItem('cart');
      localStorage.removeItem('wishlist');
      updateCart();
      updateWishlist();
    }
    logAnalyticsEvent('auth_state_changed', { user: user ? user.uid : null });
  });

  async function loadUserData(user) {
    try {
      // Profile
      const profileDoc = await db.collection('users').doc(user.uid).get();
      const profileData = profileDoc.exists ? profileDoc.data() : {};
      document.getElementById('profile-name').value = profileData.name || user.displayName || '';
      document.getElementById('profile-email').value = user.email || '';
      document.getElementById('profile-preferences').value = decryptData(profileData.preferences) || '';

      // Orders
      const querySnapshot = await db.collection('orders').where('userId', '==', user.uid).orderBy('timestamp', 'desc').get();
      const orderList = document.getElementById('order-list');
      orderList.innerHTML = '';
      querySnapshot.forEach(doc => {
        const order = doc.data();
        const progress = order.status === 'Order Confirmed' ? 33 : order.status === 'Making Design' ? 66 : 100;
        const estimatedDelivery = new Date(order.timestamp.toDate().getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
        orderList.innerHTML += `
          <div class="order-item bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg" role="article">
            <h4 class="text-xl font-semibold text-blue-500 dark:text-green-400">${sanitize(order.product)}</h4>
            <p class="text-gray-600 dark:text-gray-300">Price: $${(order.price / 100).toFixed(2)} x ${order.quantity}</p>
            <p class="text-gray-600 dark:text-gray-300">Status: ${sanitize(order.status)}</p>
            <p class="text-gray-600 dark:text-gray-300">Estimated Delivery: ${estimatedDelivery}</p>
            <div class="order-status mt-4">
              <div class="status-bar w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div class="status-progress h-full bg-green-400" style="width: ${progress}%" aria-label="Order progress: ${progress}%"></div>
              </div>
            </div>
          </div>
        `;
      });

      // Real-time Order Updates
      db.collection('orders').where('userId', '==', user.uid).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const order = change.doc.data();
            addNotification(`Order "${sanitize(order.product)}" updated to "${sanitize(order.status)}".`);
            sendPushNotification(`Order "${sanitize(order.product)}" updated to "${sanitize(order.status)}".`);
          }
        });
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      logError(error);
      addNotification('Error loading your data. Please try again.');
    }
  }

  async function syncCartWithFirestore(userId) {
    try {
      const cartDoc = await db.collection('carts').doc(userId).get();
      if (cartDoc.exists) {
        cart = cartDoc.data().items || [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCart();
      }
    } catch (error) {
      console.error('Error syncing cart:', error);
      logError(error);
    }
  }

  async function syncWishlistWithFirestore(userId) {
    try {
      const wishlistDoc = await db.collection('wishlists').doc(userId).get();
      if (wishlistDoc.exists) {
        wishlist = wishlistDoc.data().items || [];
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
        updateWishlist();
      }
    } catch (error) {
      console.error('Error syncing wishlist:', error);
      logError(error);
    }
  }

  // Cart Functions
  window.addToCart = async function(product, price, gumroadLink, quantity = 1) {
    if (!auth.currentUser) {
      showLogin();
      return;
    }
    const item = shopItems.find(i => i.name === product);
    if (!item || quantity > item.stock) {
      addNotification(`Cannot add ${quantity} ${sanitize(product)}. Only ${item.stock} in stock.`);
      return;
    }
    if (!product || !price || !gumroadLink || !gumroadLink.startsWith('https://gumroad.com/')) {
      console.error('Invalid cart item data');
      addNotification('Invalid item data. Please try again.');
      return;
    }
    const existingItem = cart.find(i => i.product === product);
    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;
    if (newQuantity > item.stock) {
      addNotification(`Cannot add ${quantity} ${sanitize(product)}. Only ${item.stock} in stock.`);
      return;
    }
    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.push({ product: sanitize(product), price, gumroadLink, quantity, addedAt: Date.now() });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    try {
      await db.collection('carts').doc(auth.currentUser.uid).set({ items: cart });
      addNotification(`${sanitize(product)} added to cart!`);
      logAnalyticsEvent('add_to_cart', { product, price, quantity });
    } catch (error) {
      console.error('Error saving cart:', error);
      logError(error);
      addNotification('Error updating cart. Please try again.');
    }
    updateCart();
  };

  window.removeFromCart = async function(product) {
    cart = cart.filter(item => item.product !== product);
    localStorage.setItem('cart', JSON.stringify(cart));
    try {
      await db.collection('carts').doc(auth.currentUser.uid).set({ items: cart });
      logAnalyticsEvent('remove_from_cart', { product });
    } catch (error) {
      console.error('Error saving cart:', error);
      logError(error);
    }
    updateCart();
  };

  window.updateCartQuantity = async function(product, quantity) {
    const item = shopItems.find(i => i.name === product);
    const newQuantity = parseInt(quantity);
    if (newQuantity > item.stock) {
      addNotification(`Cannot set ${newQuantity} ${sanitize(product)}. Only ${item.stock} in stock.`);
      return;
    }
    const cartItem = cart.find(i => i.product === product);
    if (cartItem && newQuantity > 0) {