/**
 * admin.js - JKK 管理后台
 * 通过 GitHub API 直接读写 content.json
 *
 * 首次使用：生成 GitHub Personal Access Token（勾选 repo 或 public_repo 权限）
 * 配置信息保存在 localStorage 中
 */

(function() {
    'use strict';

    // ── DOM ──
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    // 设置页
    const setupScreen = $('#setupScreen');
    const setupOwner = $('#setupOwner');
    const setupRepo = $('#setupRepo');
    const setupToken = $('#setupToken');
    const setupBranch = $('#setupBranch');
    const setupBtn = $('#setupBtn');
    const setupError = $('#setupError');

    // 主界面
    const adminApp = $('#adminApp');
    const repoBadge = $('#repoBadge');
    const adminStatus = $('#adminStatus');
    const saveBtn = $('#saveBtn');
    const reloadBtn = $('#reloadBtn');
    const settingsBtn = $('#settingsBtn');
    const catList = $('#catList');
    const currentCatTitle = $('#currentCatTitle');
    const entryCount = $('#entryCount');
    const entryList = $('#entryList');
    const addEntryBtn = $('#addEntryBtn');
    const editor = $('#editor');
    const editorTitle = $('#editorTitle');
    const editorCloseBtn = $('#editorCloseBtn');
    const editorApplyBtn = $('#editorApplyBtn');
    const deleteEntryBtn = $('#deleteEntryBtn');
    const unsavedBar = $('#unsavedBar');
    const toastContainer = $('#toastContainer');

    // 编辑字段
    const editId = $('#editId');
    const editTitleZh = $('#editTitleZh');
    const editTitleEn = $('#editTitleEn');
    const editDate = $('#editDate');
    const editTagsZh = $('#editTagsZh');
    const editTagsEn = $('#editTagsEn');
    const editContentZh = $('#editContentZh');
    const editContentEn = $('#editContentEn');
    const editImages = $('#editImages');
    const editLinks = $('#editLinks');
    const editVideos = $('#editVideos');

    // ── 状态 ──
    let config = {};
    let contentData = {};       // 当前编辑中的 content 数据
    let originalContent = {};   // 上次保存时的快照（用于检测未保存更改）
    let currentCategory = null;
    let currentEntryId = null;  // 正在编辑的条目 ID
    let contentSha = null;      // GitHub 文件 SHA（用于更新）
    let isDirty = false;

    // 导航图标映射
    const CAT_ICONS = {
        books: '📖', movies: '🎬', tv: '📺',
        music: '🎵', calligraphy: '🖌️',
        running: '🏃', 'other-sports': '🎾',
        ecology: '🌿', sociology: '👥',
        journal: '📝'
    };
    const CAT_LABELS = {
        books: '阅读 - 书目', movies: '阅读 - 电影', tv: '阅读 - 影视',
        music: '艺术 - 音乐', calligraphy: '艺术 - 书法',
        running: '运动 - 长跑', 'other-sports': '运动 - 其他',
        ecology: '研究 - 生态', sociology: '研究 - 社会学',
        journal: '河童的话 - 日志'
    };

    // ── 初始化 ──
    function init() {
        const saved = localStorage.getItem('jkk_admin_config');
        if (saved) {
            try {
                config = JSON.parse(saved);
                setupOwner.value = config.owner || '';
                setupRepo.value = config.repo || '';
                setupToken.value = config.token || '';
                setupBranch.value = config.branch || 'main';
            } catch (e) {}
        }
        // 检查是否有保存的配置并且能连接
        if (config.owner && config.repo && config.token) {
            connectRepo();
        }
    }

    // ── 连接仓库 ──
    async function connectRepo() {
        config = {
            owner: setupOwner.value.trim(),
            repo: setupRepo.value.trim(),
            token: setupToken.value.trim(),
            branch: setupBranch.value.trim() || 'main'
        };

        if (!config.owner || !config.repo || !config.token) {
            showSetupError('请填写完整信息');
            return;
        }

        localStorage.setItem('jkk_admin_config', JSON.stringify(config));
        setupBtn.disabled = true;
        setupBtn.textContent = '⏳ 连接中...';
        setupError.style.display = 'none';

        try {
            await loadContentFromGitHub();
            setupScreen.style.display = 'none';
            adminApp.style.display = 'flex';
            repoBadge.textContent = `${config.owner}/${config.repo} @${config.branch}`;
            renderCategories();
            showToast('✅ 已连接到仓库', 'success');
        } catch (err) {
            showSetupError('连接失败：' + (err.message || '请检查 Token 权限和仓库信息'));
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = '连接仓库 →';
        }
    }

    // ── 从 GitHub 加载 content.json ──
    async function loadContentFromGitHub() {
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/content.json?ref=${config.branch}`;
        const resp = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                // 文件不存在，创建空内容
                contentData = {};
                originalContent = {};
                contentSha = null;
                return;
            }
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const fileData = await resp.json();
        contentSha = fileData.sha;
        const decoded = atob(fileData.content);
        contentData = JSON.parse(decoded);
        // 深拷贝作为原始快照
        originalContent = JSON.parse(JSON.stringify(contentData));
        setDirty(false);
    }

    // ── 保存到 GitHub ──
    async function saveToGitHub() {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ 保存中...';
        adminStatus.textContent = '⏳ 保存中...';

        try {
            // 先获取最新 SHA（防止并发冲突）
            const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/content.json?ref=${config.branch}`;
            const checkResp = await fetch(url, {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            let sha = contentSha;
            if (checkResp.ok) {
                const latest = await checkResp.json();
                sha = latest.sha;
            }

            const jsonStr = JSON.stringify(contentData, null, 4);
            const encoded = btoa(unescape(encodeURIComponent(jsonStr)));

            const putResp = await fetch(
                `https://api.github.com/repos/${config.owner}/${config.repo}/contents/data/content.json`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: '📝 后台编辑更新内容',
                        content: encoded,
                        sha: sha || undefined,
                        branch: config.branch
                    })
                }
            );

            if (!putResp.ok) {
                const errData = await putResp.json().catch(() => ({}));
                throw new Error(errData.message || `HTTP ${putResp.status}`);
            }

            const result = await putResp.json();
            contentSha = result.content.sha;
            originalContent = JSON.parse(JSON.stringify(contentData));
            setDirty(false);
            adminStatus.textContent = '✅ 已保存';
            showToast('✅ 保存成功！1-2分钟后公开网页将自动更新。', 'success');
        } catch (err) {
            adminStatus.textContent = '❌ 保存失败';
            showToast('❌ 保存失败：' + (err.message || '未知错误'), 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 保存到 GitHub';
        }
    }

    // ── 渲染分类列表 ──
    function renderCategories() {
        catList.innerHTML = '';
        const navData = window.SITE_DATA ? SITE_DATA.navigation : [];

        // 先渲染导航中的分类
        const seen = new Set();
        navData.forEach(cat => {
            cat.subItems.forEach(sub => {
                seen.add(sub.id);
                const li = document.createElement('li');
                li.className = 'admin-cat-item';
                li.dataset.cat = sub.id;
                li.innerHTML = `
                    <span class="admin-cat-icon">${CAT_ICONS[sub.id] || '📄'}</span>
                    <span class="admin-cat-label">${CAT_LABELS[sub.id] || sub.id}</span>
                    <span class="admin-cat-count">${(contentData[sub.id] || []).length}</span>
                `;
                li.addEventListener('click', () => selectCategory(sub.id));
                catList.appendChild(li);
            });
        });

        // 再渲染 content.json 中有数据但导航中没定义的分类
        Object.keys(contentData).forEach(key => {
            if (!seen.has(key) && Array.isArray(contentData[key])) {
                const li = document.createElement('li');
                li.className = 'admin-cat-item';
                li.dataset.cat = key;
                li.innerHTML = `
                    <span class="admin-cat-icon">📄</span>
                    <span class="admin-cat-label">${key}</span>
                    <span class="admin-cat-count">${contentData[key].length}</span>
                `;
                li.addEventListener('click', () => selectCategory(key));
                catList.appendChild(li);
            }
        });

        // 默认选中第一个
        const first = catList.querySelector('.admin-cat-item');
        if (first) selectCategory(first.dataset.cat);
    }

    // ── 选择分类 ──
    function selectCategory(catId) {
        // 如果正在编辑且有未保存更改，先应用
        if (editor.style.display !== 'none' && currentEntryId) {
            applyEditorChanges();
        }

        currentCategory = catId;
        currentEntryId = null;
        editor.style.display = 'none';

        // 高亮
        $$('.admin-cat-item').forEach(el => {
            el.classList.toggle('active', el.dataset.cat === catId);
        });

        const label = CAT_LABELS[catId] || catId;
        currentCatTitle.textContent = label;

        const entries = contentData[catId] || [];
        entryCount.textContent = `${entries.length} 条`;
        renderEntries(entries);
    }

    // ── 渲染条目列表 ──
    function renderEntries(entries) {
        entryList.innerHTML = '';

        if (!entries || entries.length === 0) {
            entryList.innerHTML = '<p class="admin-placeholder">暂无条目，点击"新增条目"添加</p>';
            return;
        }

        // 按日期降序排列
        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        sorted.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'admin-entry-item';
            div.dataset.entryId = entry.id;
            if (entry.id === currentEntryId) div.classList.add('active');

            const title = entry.title_zh || entry.title_en || entry.id;
            const tags = entry.tags_zh || entry.tags_en || [];

            div.innerHTML = `
                <span class="admin-entry-title">${escapeHtml(title)}</span>
                <span class="admin-entry-date">${entry.date || ''}</span>
                <span class="admin-entry-tags">
                    ${tags.slice(0, 2).map(t => `<span class="admin-entry-tag">${escapeHtml(t)}</span>`).join('')}
                </span>
                <button class="admin-entry-delete" title="删除">✕</button>
            `;

            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('admin-entry-delete')) return;
                openEditor(currentCategory, entry.id);
            });

            // 删除按钮
            const delBtn = div.querySelector('.admin-entry-delete');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteEntry(currentCategory, entry.id);
            });

            entryList.appendChild(div);
        });
    }

    // ── 打开编辑器 ──
    function openEditor(catId, entryId) {
        // 如果已经有别的条目在编辑，先应用更改
        if (editor.style.display !== 'none' && currentEntryId && currentEntryId !== entryId) {
            applyEditorChanges();
        }

        const entries = contentData[catId] || [];
        const entry = entries.find(e => e.id === entryId);
        if (!entry) return;

        currentEntryId = entryId;
        editor.style.display = 'block';
        editorTitle.textContent = `✏️ 编辑：${entry.title_zh || entry.title_en || entry.id}`;

        // 填充表单
        editId.value = entry.id || '';
        editTitleZh.value = entry.title_zh || '';
        editTitleEn.value = entry.title_en || '';
        editDate.value = entry.date || '';
        editTagsZh.value = (entry.tags_zh || []).join(', ');
        editTagsEn.value = (entry.tags_en || []).join(', ');
        editContentZh.value = entry.content_zh || '';
        editContentEn.value = entry.content_en || '';
        editImages.value = (entry.images || []).join('\n');
        editLinks.value = (entry.links || []).map(l => `${l.text},${l.url}`).join('\n');
        editVideos.value = (entry.videos || []).map(v => v.url).join('\n');

        // 高亮当前条目
        $$('.admin-entry-item').forEach(el => {
            el.classList.toggle('active', el.dataset.entryId === entryId);
        });

        editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ── 应用编辑器更改 ──
    function applyEditorChanges() {
        if (!currentCategory || !currentEntryId) return;

        const entries = contentData[currentCategory] || [];
        const idx = entries.findIndex(e => e.id === currentEntryId);
        if (idx === -1) return;

        const links = editLinks.value.trim();
        const videos = editVideos.value.trim();
        const images = editImages.value.trim();

        entries[idx] = {
            id: editId.value.trim() || currentEntryId,
            title_zh: editTitleZh.value.trim(),
            title_en: editTitleEn.value.trim(),
            date: editDate.value,
            tags_zh: editTagsZh.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
            tags_en: editTagsEn.value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
            content_zh: editContentZh.value.trim(),
            content_en: editContentEn.value.trim(),
            images: images ? images.split('\n').map(s => s.trim()).filter(Boolean) : [],
            videos: videos ? videos.split('\n').map(s => {
                const url = s.trim();
                if (!url) return null;
                return { url, platform: url.includes('bilibili') ? 'bilibili' : 'youtube' };
            }).filter(Boolean) : [],
            links: links ? links.split('\n').map(s => {
                const parts = s.split(/[,，]/);
                if (parts.length >= 2) return { url: parts[1].trim(), text: parts[0].trim() };
                return null;
            }).filter(Boolean) : []
        };

        // 如果 ID 变了，更新引用
        const newId = entries[idx].id;
        if (newId !== currentEntryId) currentEntryId = newId;

        // 刷新条目列表
        renderEntries(contentData[currentCategory]);
        setDirty(true);
        showToast('✓ 更改已应用', 'info');
    }

    // ── 新增条目 ──
    function addNewEntry() {
        if (!currentCategory) {
            showToast('请先选择一个分类', 'error');
            return;
        }

        if (editor.style.display !== 'none' && currentEntryId) {
            applyEditorChanges();
        }

        const today = new Date().toISOString().split('T')[0];
        const newId = 'new-entry-' + Date.now();

        const newEntry = {
            id: newId,
            title_zh: '',
            title_en: '',
            date: today,
            tags_zh: [],
            tags_en: [],
            content_zh: '',
            content_en: '',
            images: [],
            videos: [],
            links: []
        };

        if (!contentData[currentCategory]) {
            contentData[currentCategory] = [];
        }
        contentData[currentCategory].push(newEntry);

        // 刷新列表
        renderEntries(contentData[currentCategory]);
        updateCatCounts();

        // 打开编辑器
        openEditor(currentCategory, newId);
        setDirty(true);
        showToast('✏️ 新条目已添加，编辑后记得保存', 'info');
    }

    // ── 删除条目 ──
    function deleteEntry(catId, entryId) {
        if (!confirm('确定要删除这条条目吗？')) return;

        const entries = contentData[catId] || [];
        const idx = entries.findIndex(e => e.id === entryId);
        if (idx === -1) return;

        entries.splice(idx, 1);

        if (currentEntryId === entryId) {
            editor.style.display = 'none';
            currentEntryId = null;
        }

        renderEntries(entries);
        updateCatCounts();
        setDirty(true);
        showToast('🗑 已删除', 'info');
    }

    // ── 更新分类计数 ──
    function updateCatCounts() {
        $$('.admin-cat-item').forEach(el => {
            const cat = el.dataset.cat;
            const count = (contentData[cat] || []).length;
            const countEl = el.querySelector('.admin-cat-count');
            if (countEl) countEl.textContent = count;
        });
    }

    // ── 脏状态 ──
    function setDirty(dirty) {
        isDirty = dirty;
        unsavedBar.style.display = dirty ? 'block' : 'none';
        if (dirty) {
            adminStatus.textContent = '⚠️ 有未保存更改';
        }
    }

    // ── Toast ──
    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type || 'info'}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── 错误提示 ──
    function showSetupError(msg) {
        setupError.textContent = msg;
        setupError.style.display = 'block';
    }

    // ── 工具 ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ── 事件绑定 ──
    setupBtn.addEventListener('click', connectRepo);

    // 回车键触发连接
    [setupOwner, setupRepo, setupToken, setupBranch].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') connectRepo();
        });
    });

    saveBtn.addEventListener('click', saveToGitHub);

    reloadBtn.addEventListener('click', async () => {
        if (isDirty && !confirm('有未保存的更改，重新加载将丢失这些更改。确定吗？')) return;
        try {
            await loadContentFromGitHub();
            renderCategories();
            editor.style.display = 'none';
            currentEntryId = null;
            showToast('🔄 已重新加载', 'success');
        } catch (err) {
            showToast('❌ 加载失败：' + err.message, 'error');
        }
    });

    settingsBtn.addEventListener('click', () => {
        if (confirm('返回设置页面？配置信息会保留。')) {
            adminApp.style.display = 'none';
            setupScreen.style.display = 'flex';
        }
    });

    addEntryBtn.addEventListener('click', addNewEntry);
    editorCloseBtn.addEventListener('click', () => {
        if (isDirty) applyEditorChanges();
        editor.style.display = 'none';
        currentEntryId = null;
    });

    editorApplyBtn.addEventListener('click', applyEditorChanges);

    deleteEntryBtn.addEventListener('click', () => {
        if (currentCategory && currentEntryId) {
            deleteEntry(currentCategory, currentEntryId);
        }
    });

    // ── 离开页面提醒 ──
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '有未保存的更改，确定离开吗？';
        }
    });

    // ── 启动 ──
    document.addEventListener('DOMContentLoaded', init);

    // 暴露给全局
    window.JKK_ADMIN = { contentData, saveToGitHub };
})();
