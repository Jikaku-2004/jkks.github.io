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
    let siteContent = {};  // 从 content.json 加载

    // ── DOM引用 ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const navList = $('#navList');
    const welcomePage = $('#welcomePage');
    const categoryPage = $('#categoryPage');
    const contactPage = $('#contactPage');
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
        setupQuickAdd();
        applyLanguage(currentLang);
    }

    // ── 加载内容 ──
    async function loadContent() {
        try {
            const resp = await fetch('data/content.json');
            siteContent = await resp.json();
        } catch (e) {
            console.warn('无法加载 content.json，使用空内容', e);
            siteContent = {};
        }
    }

    // ── 导航渲染 ──
    function renderNavigation() {
        navList.innerHTML = '';
        SITE_DATA.navigation.forEach(cat => {
            const li = document.createElement('li');

            // 主分类项
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.dataset.category = cat.id;
            item.innerHTML = `
                <span class="nav-icon">${cat.icon}</span>
                <span class="nav-label" data-i18n="${cat.labelKey}">${cat.labelKey}</span>
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
                    subItem.innerHTML = `<span data-i18n="${sub.labelKey}">${sub.labelKey}</span>`;
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

        // 显示分类页面
        welcomePage.style.display = 'none';
        categoryPage.style.display = 'block';
        contactPage.style.display = 'none';

        renderCategoryPage(category, subCategory);
        closeMenu();
    }

    // ── 渲染分类页面 ──
    function renderCategoryPage(category, subCategory) {
        const cat = SITE_DATA.navigation.find(c => c.id === category);
        if (!cat) return;

        // 标题和描述
        categoryTitle.textContent = t(cat.labelKey);
        categoryDesc.textContent = t(`desc${capitalize(category)}`);

        // 子分类标签
        subcategoryTabs.innerHTML = '';
        if (cat.subItems.length > 1) {
            cat.subItems.forEach(sub => {
                const tab = document.createElement('button');
                tab.className = 'subcategory-tab';
                if (!subCategory || sub.id === subCategory) {
                    tab.classList.add('active');
                }
                tab.textContent = t(sub.labelKey);
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
                    html += `<img src="${img}" alt="" loading="lazy">`;
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
                    html += `<a href="${link.url}" class="entry-link" target="_blank" rel="noopener">🔗 ${escapeHtml(link.text)}</a>`;
                });
                html += `</div>`;
            }

            card.innerHTML = html;
            entriesContainer.appendChild(card);
        });

        // 绑定图片点击（灯箱）
        entriesContainer.querySelectorAll('.entry-body img, .entry-images img').forEach(img => {
            img.addEventListener('click', () => openLightbox(img.src));
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
        contactPage.style.display = 'flex';

        const contact = SITE_DATA.contact;
        let html = `
            <div class="contact-card">
                <h2 class="contact-title">${t('contactTitle')}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">${t('contactDesc')}</p>
        `;

        Object.values(contact).forEach(item => {
            const label = currentLang === 'zh' ? item.label_zh : item.label_en;
            const isEmail = item.value && item.value.includes('@');
            const valueHtml = isEmail
                ? `<a href="mailto:${item.value}">${item.value}</a>`
                : `<span class="contact-value">${item.value}</span>`;

            html += `
                <div class="contact-item">
                    <span class="contact-icon">${item.icon}</span>
                    <span class="contact-label">${escapeHtml(label)}</span>
                    ${valueHtml}
                </div>
            `;
        });

        html += `</div>`;
        contactPage.innerHTML = html;
    }

    // ── 快速添加工具 ──
    function setupQuickAdd() {
        const btn = $('#quickAddBtn');
        const overlay = $('#quickAddOverlay');
        const closeBtn = $('#quickAddClose');
        const generateBtn = $('#qaGenerateBtn');
        const copyBtn = $('#qaCopyBtn');
        const output = $('#qaOutput');
        const result = $('#qaResult');
        const dateInput = $('#qaDate');

        // 默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = today;

        // 打开
        if (btn) {
            btn.addEventListener('click', () => {
                overlay.style.display = 'flex';
                output.style.display = 'none';
            });
        }

        // 关闭
        function closeQA() {
            overlay.style.display = 'none';
        }
        if (closeBtn) closeBtn.addEventListener('click', closeQA);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeQA();
        });

        // 生成 JSON
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                const category = document.getElementById('qaCategory').value;
                const titleZh = document.getElementById('qaTitleZh').value.trim();
                const titleEn = document.getElementById('qaTitleEn').value.trim();
                const date = dateInput.value;
                const tagsZh = document.getElementById('qaTagsZh').value.trim();
                const tagsEn = document.getElementById('qaTagsEn').value.trim();
                const contentZh = document.getElementById('qaContentZh').value.trim();
                const contentEn = document.getElementById('qaContentEn').value.trim();
                const imagesText = document.getElementById('qaImages').value.trim();
                const linksText = document.getElementById('qaLinks').value.trim();
                const videosText = document.getElementById('qaVideos').value.trim();

                if (!titleZh || !titleEn || !date) {
                    alert(currentLang === 'zh' ? '请至少填写中文标题、英文标题和日期！' : 'Please fill in Chinese title, English title, and date!');
                    return;
                }

                // 生成唯一 ID
                const id = titleZh.replace(/[^\w\u4e00-\u9fff]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
                    + '-' + date.replace(/-/g, '');

                // 构建条目
                const entry = {
                    id: id,
                    title_zh: titleZh,
                    title_en: titleEn,
                    date: date,
                    tags_zh: tagsZh ? tagsZh.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
                    tags_en: tagsEn ? tagsEn.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
                    content_zh: contentZh,
                    content_en: contentEn,
                    images: imagesText ? imagesText.split('\n').map(s => s.trim()).filter(Boolean) : [],
                    videos: videosText ? videosText.split('\n').map(s => {
                        const url = s.trim();
                        if (!url) return null;
                        const isBilibili = url.includes('bilibili.com');
                        return { url, platform: isBilibili ? 'bilibili' : 'youtube' };
                    }).filter(Boolean) : [],
                    links: linksText ? linksText.split('\n').map(s => {
                        const parts = s.split(/[,，]/);
                        if (parts.length >= 2) {
                            return { url: parts[1].trim(), text: parts[0].trim() };
                        }
                        return null;
                    }).filter(Boolean) : []
                };

                // 显示结果
                const jsonStr = JSON.stringify(entry, null, 4);
                result.textContent = jsonStr;
                output.style.display = 'block';
                result.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        // 复制
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(result.textContent);
                    const original = copyBtn.textContent;
                    copyBtn.textContent = currentLang === 'zh' ? '✅ 已复制！' : '✅ Copied!';
                    setTimeout(() => { copyBtn.textContent = original; }, 2000);
                } catch {
                    // 回退：选中文本
                    const range = document.createRange();
                    range.selectNodeContents(result);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            });
        }
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
            applyLanguage(lang);

            // 刷新当前页面
            if (currentCategory) {
                if (currentCategory === 'contact') {
                    showContactPage();
                } else {
                    renderCategoryPage(currentCategory, currentSubCategory);
                }
            }
        });
    }

    function applyLanguage(lang) {
        // 更新所有 data-key 元素
        $$('[data-key]').forEach(el => {
            const key = el.dataset.key;
            if (I18N[key]) {
                el.textContent = I18N[key][lang];
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

    // ── 工具函数 ──
    function t(key) {
        return I18N[key] ? (I18N[key][currentLang] || key) : key;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
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
