/**
 * app.js - 主应用逻辑
 * 负责导航渲染、页面切换、语言切换、内容渲染
 */

(function() {
    'use strict';

    // ── 状态 ──
    let currentLang = 'zh';
    let currentCategory = null;
    let currentSubCategory = null;
    let siteContent = {};      // 从 content.json 加载的条目内容
    let siteNavigation = [];   // 从 content.json 加载的导航
    let siteContact = {};      // 从 content.json 加载的联系方式
    let siteWelcome = {};      // 从 content.json 加载的欢迎页数据
    let siteAbout = {};        // 从 content.json 加载的关于页面数据
    const PIXEL_ICONS = Object.freeze({
        reading: 'RD', art: 'AR', sports: 'SP', research: 'RS',
        kappa: 'KP', contact: 'CT', email: 'ML', about: 'AB'
    });

    // ── DOM引用 ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const navList = $('#navList');
    const welcomePage = $('#welcomePage');
    const categoryPage = $('#categoryPage');
    const contactPage = $('#contactPage');
    const aboutPage = $('#aboutPage');
    const aboutContent = $('#aboutContent');
    const categoryTitle = $('#categoryTitle');
    const categoryDesc = $('#categoryDesc');
    const subcategoryTabs = $('#subcategoryTabs');
    const entriesContainer = $('#entriesContainer');
    const menuToggle = $('#menuToggle');
    const sidebar = $('#sidebar');
    const langToggle = $('#langToggle');
    const lightbox = $('#lightbox');
    const lightboxImg = $('#lightboxImg');

    // ── 初始化 ──
    async function init() {
        await loadContent();
        renderNavigation();
        setupLanguageToggle();
        setupMenuToggle();
        setupLightbox();
        setupContactNav();
        setupAboutNav();
        setupMusicPlayer();
        setupSystemClock();
        applyLanguage(currentLang);
    }

    // ── 加载内容 ──
    async function loadContent() {
        try {
            const resp = await fetch('data/content.json');
            const data = await resp.json();
            siteNavigation = data.navigation || [];
            siteContact = data.contact || {};
            siteContent = data.content || {};
            siteWelcome = data.welcome || {};
            siteAbout = data.about || {};
        } catch (e) {
            console.warn('无法加载 content.json，使用后备数据', e);
            siteNavigation = SITE_DATA.navigation || [];
            siteContact = SITE_DATA.contact || {};
            siteContent = {};
            siteWelcome = {};
            siteAbout = {};
        }
    }

    // ── 导航渲染 ──
    function renderNavigation() {
        navList.innerHTML = '';
        const nav = siteNavigation.length > 0 ? siteNavigation : (SITE_DATA.navigation || []);
        nav.forEach(cat => {
            const li = document.createElement('li');

            // 主分类项
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.dataset.category = cat.id;
            const catLabel = cat.label ? cat.label[currentLang] : (I18N[cat.labelKey] ? I18N[cat.labelKey][currentLang] : cat.id);
            item.innerHTML = `
                <span class="nav-icon">${pixelIconMarkup(cat.id, cat.icon)}</span>
                <span class="nav-label">${catLabel}</span>
                ${cat.subItems.length > 0 ? '<span class="nav-arrow">▶</span>' : ''}
            `;
            item.addEventListener('click', () => toggleCategory(cat.id, item));
            li.appendChild(item);

            // 子分类
            if (cat.subItems.length > 0) {
                const subUl = document.createElement('ul');
                subUl.className = 'sub-nav';
                subUl.id = `sub-${cat.id}`;

                cat.subItems.forEach(sub => {
                    const subLi = document.createElement('li');
                    const subItem = document.createElement('div');
                    subItem.className = 'sub-nav-item';
                    subItem.dataset.category = cat.id;
                    subItem.dataset.subcategory = sub.id;
                    const subLabel = sub.label ? sub.label[currentLang] : (I18N[sub.labelKey] ? I18N[sub.labelKey][currentLang] : sub.id);
                    subItem.innerHTML = `<span>${subLabel}</span>`;
                    subItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigateTo(cat.id, sub.id);
                    });
                    subLi.appendChild(subItem);
                    subUl.appendChild(subLi);
                });

                li.appendChild(subUl);
            }

            navList.appendChild(li);
        });
    }

    // ── 分类展开/收起 ──
    function toggleCategory(catId, item) {
        const subNav = document.getElementById(`sub-${catId}`);
        if (!subNav) {
            // 无子分类，直接导航
            navigateTo(catId, null);
            return;
        }

        const isOpen = subNav.classList.contains('open');
        // 关闭其他
        $$('.sub-nav.open').forEach(el => {
            if (el.id !== `sub-${catId}`) {
                el.classList.remove('open');
                el.closest('li').querySelector('.nav-item')?.classList.remove('expanded');
            }
        });
        // 切换当前
        subNav.classList.toggle('open');
        item.classList.toggle('expanded');

        if (!isOpen) {
            // 默认选中第一个子分类
            const firstSub = subNav.querySelector('.sub-nav-item');
            if (firstSub) {
                navigateTo(catId, firstSub.dataset.subcategory);
            }
        }
    }

    // ── 页面导航 ──
    function navigateTo(category, subCategory) {
        currentCategory = category;
        currentSubCategory = subCategory;

        // 更新导航高亮
        $$('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.category === category);
        });
        $$('.sub-nav-item').forEach(el => {
            const isActive = el.dataset.category === category &&
                (subCategory ? el.dataset.subcategory === subCategory : false);
            el.classList.toggle('active', isActive);
        });

        // 如果是联系方式
        if (category === 'contact') {
            currentCategory = 'contact';
            currentSubCategory = null;
            showContactPage();
            closeMenu();
            return;
        }

        // 如果是关于Jikaku
        if (category === 'about') {
            currentCategory = 'about';
            currentSubCategory = null;
            showAboutPage();
            closeMenu();
            return;
        }

        // 显示分类页面
        welcomePage.style.display = 'none';
        categoryPage.style.display = 'block';
        contactPage.style.display = 'none';
        aboutPage.style.display = 'none';

        renderCategoryPage(category, subCategory);
        closeMenu();
    }

    // ── 渲染分类页面 ──
    function renderCategoryPage(category, subCategory) {
        const nav = siteNavigation.length > 0 ? siteNavigation : (SITE_DATA.navigation || []);
        const cat = nav.find(c => c.id === category);
        if (!cat) return;

        // 标题和描述（优先使用 content.json 中的内联翻译，其次 i18n）
        const lang = currentLang;
        categoryTitle.textContent = cat.label ? cat.label[lang] : (t(cat.labelKey) || cat.id);
        categoryDesc.textContent = cat.desc ? cat.desc[lang] : (t(`desc${capitalize(category)}`) || '');

        // 子分类标签
        subcategoryTabs.innerHTML = '';
        subcategoryTabs.style.display = '';
        if (cat.subItems.length > 1) {
            cat.subItems.forEach(sub => {
                const tab = document.createElement('button');
                tab.className = 'subcategory-tab';
                if (!subCategory || sub.id === subCategory) {
                    tab.classList.add('active');
                }
                tab.textContent = sub.label ? sub.label[lang] : (t(sub.labelKey) || sub.id);
                tab.dataset.subcategory = sub.id;
                tab.addEventListener('click', () => navigateTo(category, sub.id));
                subcategoryTabs.appendChild(tab);
            });
        } else {
            subcategoryTabs.style.display = 'none';
        }

        // 渲染条目
        const targetSub = subCategory || (cat.subItems.length > 0 ? cat.subItems[0].id : null);
        if (targetSub) {
            renderEntries(targetSub);
        }
    }

    // ── 渲染条目卡片 ──
    function renderEntries(subCategory) {
        const entries = siteContent[subCategory];
        entriesContainer.innerHTML = '';

        if (!entries || entries.length === 0) {
            entriesContainer.innerHTML = `<p class="empty-state">${t('noEntries')}</p>`;
            return;
        }

        entries.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'entry-card';
            card.style.animationDelay = `${index * 0.06}s`;

            const title = currentLang === 'zh' ? entry.title_zh : entry.title_en;
            const tags = currentLang === 'zh' ? (entry.tags_zh || []) : (entry.tags_en || []);
            const content = currentLang === 'zh' ? entry.content_zh : entry.content_en;

            let html = `
                <div class="entry-header">
                    <h3 class="entry-title">${escapeHtml(title)}</h3>
                    <span class="entry-date">${entry.date}</span>
                </div>
            `;

            if (tags.length > 0) {
                html += `<div class="entry-tags">`;
                tags.forEach(tag => {
                    html += `<span class="entry-tag">${escapeHtml(tag)}</span>`;
                });
                html += `</div>`;
            }

            // Markdown内容
            if (content) {
                const renderedContent = marked.parse(content);
                html += `<div class="entry-body">${renderedContent}</div>`;
            }

            // 图片
            if (entry.images && entry.images.length > 0) {
                html += `<div class="entry-images">`;
                entry.images.forEach(img => {
                    html += `<img src="${escapeHtml(img)}" alt="${escapeHtml(title || '')}" loading="lazy">`;
                });
                html += `</div>`;
            }

            // 视频嵌入
            if (entry.videos && entry.videos.length > 0) {
                html += `<div class="entry-media">`;
                entry.videos.forEach(v => {
                    const embedUrl = getVideoEmbedUrl(v.url, v.platform);
                    if (embedUrl) {
                        html += `<div class="video-embed"><iframe src="${embedUrl}" allowfullscreen loading="lazy"></iframe></div>`;
                    }
                });
                html += `</div>`;
            }

            // 外部链接
            if (entry.links && entry.links.length > 0) {
                html += `<div class="entry-links">`;
                entry.links.forEach(link => {
                    html += `<a href="${link.url}" class="entry-link" target="_blank" rel="noopener">[LINK] ${escapeHtml(link.text)}</a>`;
                });
                html += `</div>`;
            }

            card.innerHTML = html;
            entriesContainer.appendChild(card);
        });

        // 绑定图片点击（灯箱）
        entriesContainer.querySelectorAll('.entry-body img, .entry-images img').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.src));
            img.addEventListener('error', () => img.closest('.entry-images') && img.classList.add('image-load-error'));
        });
    }

    // ── 联系方式导航 ──
    function setupContactNav() {
        const navContact = $('#navContact');
        if (navContact) {
            navContact.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('contact', null);
            });
        }
    }

    // ── 联系方式页面 ──
    function showContactPage() {
        welcomePage.style.display = 'none';
        categoryPage.style.display = 'none';
        aboutPage.style.display = 'none';
        contactPage.style.display = 'flex';

        const contact = Object.keys(siteContact).length > 0 ? siteContact : (SITE_DATA.contact || {});
        let html = `
            <div class="contact-card">
                <h2 class="contact-title">${t('contactTitle')}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">${t('contactDesc')}</p>
        `;

        Object.entries(contact).forEach(([contactId, item]) => {
            // 兼容两种格式：内联 label {zh,en} 或旧版 label_zh/label_en
            let label;
            if (item.label && item.label.zh) {
                label = item.label[currentLang] || item.label.zh;
            } else {
                label = currentLang === 'zh' ? (item.label_zh || item.label) : (item.label_en || item.label);
            }
            const isEmail = item.value && item.value.includes('@');
            const valueHtml = isEmail
                ? `<a href="mailto:${item.value}">${item.value}</a>`
                : `<span class="contact-value">${item.value}</span>`;

            html += `
                <div class="contact-item">
                    <span class="contact-icon">${pixelIconMarkup(contactId, item.icon)}</span>
                    <span class="contact-label">${escapeHtml(label)}</span>
                    ${valueHtml}
                </div>
            `;
        });

        html += `</div>`;
        contactPage.innerHTML = html;
    }

    // ── 关于Jikaku导航 ──
    function setupAboutNav() {
        const navAbout = $('#navAbout');
        if (navAbout) {
            navAbout.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo('about', null);
            });
        }
    }

    // ── 关于Jikaku页面 ──
    function showAboutPage() {
        welcomePage.style.display = 'none';
        categoryPage.style.display = 'none';
        contactPage.style.display = 'none';
        aboutPage.style.display = 'block';

        const aboutMd = (siteAbout.content && siteAbout.content[currentLang]) || siteAbout.content_zh || '';
        if (aboutContent) {
            aboutContent.innerHTML = aboutMd ? marked.parse(aboutMd) : '<p style="color:var(--text-secondary);">' + (currentLang === 'zh' ? '暂无内容' : 'No content yet.') + '</p>';
        }
    }

    // ── 音乐播放器 ──
    function setupMusicPlayer() {
        const audio = $('#musicAudio');
        const playBtn = $('#musicPlay');
        const prevBtn = $('#musicPrev');
        const nextBtn = $('#musicNext');
        const randomBtn = $('#musicRandom');
        const loopBtn = $('#musicLoop');
        const musicTitle = $('#musicTitle');
        const musicPlayer = $('#musicPlayer');

        if (!audio || !playBtn) return;

        let playlist = [];
        let currentIndex = 0;
        let isRandom = false;
        let isLoop = false;

        // 加载播放列表
        async function loadPlaylist() {
            try {
                const resp = await fetch('data/music-list.json');
                const data = await resp.json();
                playlist = (data.songs || []).filter(s => s.url && s.url.trim()).slice(0, 10);
                if (playlist.length > 0) {
                    updateDisplay();
                }
            } catch (e) {
                console.warn('无法加载音乐列表', e);
                playlist = [];
            }
        }

        function updateDisplay() {
            if (playlist.length === 0) {
                musicTitle.textContent = '--';
                return;
            }
            const song = playlist[currentIndex];
            musicTitle.textContent = song.name || 'Unknown';
        }

        function loadAndPlay() {
            if (playlist.length === 0) return;
            const song = playlist[currentIndex];
            audio.src = song.url;
            audio.load();
            audio.play().catch(() => {});
            updateDisplay();
        }

        playBtn.addEventListener('click', () => {
            if (playlist.length === 0) return;
            if (audio.paused) {
                if (!audio.src || audio.src === window.location.href) {
                    loadAndPlay();
                } else {
                    audio.play().catch(() => {});
                }
                playBtn.textContent = '⏸';
            } else {
                audio.pause();
                playBtn.textContent = '▶';
            }
        });

        prevBtn.addEventListener('click', () => {
            if (playlist.length === 0) return;
            currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
            loadAndPlay();
            playBtn.textContent = '⏸';
        });

        nextBtn.addEventListener('click', () => {
            if (playlist.length === 0) return;
            currentIndex = (currentIndex + 1) % playlist.length;
            loadAndPlay();
            playBtn.textContent = '⏸';
        });

        randomBtn.addEventListener('click', () => {
            isRandom = !isRandom;
            randomBtn.classList.toggle('active', isRandom);
        });

        loopBtn.addEventListener('click', () => {
            isLoop = !isLoop;
            loopBtn.classList.toggle('active', isLoop);
            audio.loop = isLoop;
        });

        audio.addEventListener('ended', () => {
            if (isLoop) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
                return;
            }
            if (isRandom && playlist.length > 1) {
                let newIndex;
                do {
                    newIndex = Math.floor(Math.random() * playlist.length);
                } while (newIndex === currentIndex && playlist.length > 1);
                currentIndex = newIndex;
            } else {
                currentIndex = (currentIndex + 1) % playlist.length;
            }
            loadAndPlay();
        });

        audio.addEventListener('play', () => { playBtn.textContent = '⏸'; });
        audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
        audio.addEventListener('error', () => {
            playBtn.textContent = '▶';
            console.warn('音频加载失败');
        });

        loadPlaylist();
    }

    // ── 语言切换 ──
    function setupLanguageToggle() {
        langToggle.addEventListener('click', (e) => {
            const option = e.target.closest('.lang-option');
            if (!option) return;
            const lang = option.dataset.lang;
            if (lang === currentLang) return;

            currentLang = lang;
            $$('.lang-option').forEach(el => el.classList.toggle('active', el.dataset.lang === lang));
            // 重新渲染导航（labels 从 content.json 取，需要跟着语言变）
            renderNavigation();
            applyLanguage(lang);

            // 刷新当前页面
            if (currentCategory) {
                if (currentCategory === 'contact') {
                    showContactPage();
                } else if (currentCategory === 'about') {
                    showAboutPage();
                } else {
                    renderCategoryPage(currentCategory, currentSubCategory);
                }
            }
        });
    }

    function applyLanguage(lang) {
        // 欢迎页关键词（支持 content.json 覆盖，且使用 innerHTML 渲染 HTML 内容）
        const WELCOME_KEYS = ['welcomeTitle','welcomeSubtitle','welcomeDesc','welcomeQuote'];
        // 更新所有 data-key 元素
        $$('[data-key]').forEach(el => {
            const key = el.dataset.key;
            // 优先使用 content.json 中的欢迎页数据
            if (WELCOME_KEYS.includes(key) && siteWelcome[key] && siteWelcome[key][lang]) {
                el.innerHTML = siteWelcome[key][lang];
                return;
            }
            if (I18N[key]) {
                // 欢迎页内容含 HTML，用 innerHTML；其余用 textContent
                if (WELCOME_KEYS.includes(key)) {
                    el.innerHTML = I18N[key][lang];
                } else {
                    el.textContent = I18N[key][lang];
                }
            }
        });

        // 更新所有 data-i18n 元素
        $$('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (I18N[key]) {
                el.textContent = I18N[key][lang];
            }
        });

        // 更新页面标题
        document.title = I18N.siteTitle[lang];
    }

    // ── 移动端菜单 ──
    function setupMenuToggle() {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            sidebar.classList.toggle('open');
        });

        // 点击内容区关闭菜单
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                const isSidebar = sidebar.contains(e.target);
                const isToggle = menuToggle.contains(e.target);
                if (!isSidebar && !isToggle && sidebar.classList.contains('open')) {
                    closeMenu();
                }
            }
        });
    }

    function closeMenu() {
        menuToggle.classList.remove('active');
        sidebar.classList.remove('open');
    }

    // ── 灯箱 ──
    function setupLightbox() {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
                lightbox.classList.remove('show');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') lightbox.classList.remove('show');
        });
    }

    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('show');
    }

    // ── 顶栏系统时钟 ──
    function setupSystemClock() {
        const clock = $('#systemClock');
        if (!clock) return;
        const update = () => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString('zh-CN', {
                hour12: false,
                timeZone: 'Asia/Shanghai'
            }) + ' CST';
        };
        update();
        window.setInterval(update, 1000);
    }

    // ── 工具函数 ──
    function t(key) {
        return I18N[key] ? (I18N[key][currentLang] || key) : key;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function pixelIconMarkup(id, fallback) {
        const safeFallback = String(fallback || '').match(/[A-Za-z0-9@]{1,3}/);
        const code = safeFallback ? safeFallback[0].toUpperCase() : (PIXEL_ICONS[id] || String(id || 'UI').slice(0, 2).toUpperCase());
        return `<span class="pixel-icon" aria-hidden="true">${escapeHtml(code)}</span>`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getVideoEmbedUrl(url, platform) {
        // Bilibili
        const biliMatch = url.match(/BV[\w]+/);
        if (biliMatch) {
            return `https://player.bilibili.com/player.html?bvid=${biliMatch[0]}&autoplay=0`;
        }
        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        if (ytMatch) {
            return `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
        // 直接使用
        return url;
    }

    // ── 启动 ──
    document.addEventListener('DOMContentLoaded', init);

    // 暴露给全局（用于调试）
    window.JKK = {
        navigateTo,
        setLang: (l) => {
            currentLang = l;
            applyLanguage(l);
        }
    };
})();
