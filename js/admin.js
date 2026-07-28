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
    let contentData = {
        navigation: [],
        contact: {},
        content: {}
    };       // 完整数据：{ navigation, contact, content }
    let originalContent = {};   // 上次保存时的快照
    let currentCategory = null; // 当前选中的子分类ID（如 "books"）
    let currentEntryId = null;  // 正在编辑的条目 ID
    let contentSha = null;      // GitHub 文件 SHA
    let isDirty = false;
    let adminMode = 'entries';  // 'entries' 或 'categories'

    // ── 辅助：获取条目数据 ──
    function getEntries(catId) { return contentData.content[catId] || []; }
    function setEntries(catId, arr) { contentData.content[catId] = arr; }
    function getNavigation() { return contentData.navigation || []; }
    function getContact() { return contentData.contact || {}; }

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
            showSetupError('请填写完整信息（用户名、仓库名、Token）');
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
            renderSidebar();
            showToast('✅ 已连接到仓库', 'success');
        } catch (err) {
            const msg = err.message || '';
            let hint = '';
            if (msg.includes('401')) hint = '❌ Token 无效，请重新生成';
            else if (msg.includes('403')) hint = '❌ Token 权限不足，需要 public_repo 权限';
            else if (msg.includes('404')) hint = '❌ 仓库或文件不存在，检查仓库名是否正确';
            else hint = '❌ ' + msg;
            showSetupError(hint + '\n\n💡 如果不想配置 Token，点击下方"手动编辑模式"');
        } finally {
            setupBtn.disabled = false;
            setupBtn.textContent = '🔗 连接仓库';
        }
    }

    // ── 手动模式（无需 Token，直接加载当前 content.json） ──
    async function enterManualMode() {
        setupBtn.disabled = true;
        const btn = document.getElementById('manualModeBtn');
        if (btn) btn.textContent = '⏳ 加载中...';
        setupError.style.display = 'none';

        try {
            // 直接从网站加载 content.json
            const resp = await fetch('data/content.json');
            if (!resp.ok) throw new Error('无法加载 content.json（HTTP ' + resp.status + '）');
            const raw = await resp.json();
            // 适配新旧结构
            contentData = {
                navigation: raw.navigation || [],
                contact: raw.contact || {},
                content: raw.content || raw   // 旧格式：内容直接在根级
            };
            // 如果旧格式且 content 为空，将根级数据当作 content
            if (Object.keys(contentData.content).length === 0 && !raw.navigation) {
                contentData.content = raw;
            }
            originalContent = JSON.parse(JSON.stringify(contentData));
            contentSha = null;

            setupScreen.style.display = 'none';
            adminApp.style.display = 'flex';
            repoBadge.textContent = '📝 手动模式（未连接 GitHub）';
            renderSidebar();
            showToast('✅ 已加载 content.json，可在"分类管理"中增删大类', 'success');
        } catch (err) {
            showSetupError('❌ 加载失败：' + (err.message || '未知错误'));
        } finally {
            setupBtn.disabled = false;
            if (btn) btn.textContent = '📝 手动编辑模式（无需 Token）';
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
                contentData = { navigation: [], contact: {}, content: {} };
                originalContent = {};
                contentSha = null;
                return;
            }
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const fileData = await resp.json();
        contentSha = fileData.sha;
        const decoded = atob(fileData.content);
        const raw = JSON.parse(decoded);
        // 适配新旧结构
        contentData = {
            navigation: raw.navigation || [],
            contact: raw.contact || {},
            content: raw.content || raw
        };
        originalContent = JSON.parse(JSON.stringify(contentData));
        setDirty(false);
    }

    // ── 保存到 GitHub ──
    async function saveToGitHub() {
        // 手动模式提示
        if (!config.token) {
            showToast('📥 手动模式下请点击"下载"按钮保存文件，然后上传到 GitHub', 'info');
            return;
        }

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

            // 构建完整的 content.json（包含 navigation + contact + content）
            const saveData = {
                navigation: getNavigation(),
                contact: getContact(),
                content: contentData.content || {}
            };
            const jsonStr = JSON.stringify(saveData, null, 4);
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

    // ── 渲染侧栏 ──
    function renderSidebar() {
        catList.innerHTML = '';
        const nav = getNavigation();

        // 模式切换按钮
        const modeItem = document.createElement('li');
        modeItem.className = 'admin-cat-item';
        modeItem.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
        modeItem.style.marginBottom = '8px';
        modeItem.innerHTML = `
            <span class="admin-cat-icon">${adminMode === 'entries' ? '📝' : '📂'}</span>
            <span class="admin-cat-label">${adminMode === 'entries' ? '分类管理' : '← 返回条目'}</span>
        `;
        modeItem.addEventListener('click', () => {
            adminMode = adminMode === 'entries' ? 'categories' : 'entries';
            renderSidebar();
            if (adminMode === 'entries') {
                const first = catList.querySelector('.admin-cat-item[data-cat]');
                if (first) selectCategory(first.dataset.cat);
            } else {
                showCategoryManager();
            }
        });
        catList.appendChild(modeItem);

        if (adminMode === 'entries') {
            // 条目分类模式
            nav.forEach(cat => {
                if (!cat.subItems) return;
                cat.subItems.forEach(sub => {
                    const li = document.createElement('li');
                    li.className = 'admin-cat-item';
                    li.dataset.cat = sub.id;
                    const label = sub.label ? (sub.label.zh || sub.id) : sub.id;
                    const count = getEntries(sub.id).length;
                    li.innerHTML = `
                        <span class="admin-cat-icon">${cat.icon || '📄'}</span>
                        <span class="admin-cat-label">${label}</span>
                        <span class="admin-cat-count">${count}</span>
                    `;
                    li.addEventListener('click', () => selectCategory(sub.id));
                    catList.appendChild(li);
                });
            });
        }

        // 默认选中第一个
        const first = catList.querySelector('.admin-cat-item[data-cat]');
        if (first && adminMode === 'entries') selectCategory(first.dataset.cat);
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
        addEntryBtn.style.display = '';
        entryList.style.display = '';

        const entries = getEntries(catId);
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

        const entries = getEntries(currentCategory);
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

        if (!contentData.content[currentCategory]) {
            contentData.content[currentCategory] = [];
        }
        contentData.content[currentCategory].push(newEntry);

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

        const entries = getEntries(catId);
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
            const count = getEntries(cat).length;
            const countEl = el.querySelector('.admin-cat-count');
            if (countEl) countEl.textContent = count;
        });
    }

    // ── 显示分类管理 ──
    function showCategoryManager() {
        editor.style.display = 'none';
        currentCatTitle.textContent = '📂 分类管理';
        entryCount.textContent = '';
        addEntryBtn.style.display = 'none';

        let html = `<p style="color:var(--text-secondary);margin-bottom:16px;">管理大类和小类。修改后记得保存到 GitHub 或下载。</p>`;

        const nav = getNavigation();
        nav.forEach((cat, ci) => {
            html += `<div class="cat-mgr-card" data-ci="${ci}">
                <div class="cat-mgr-header">
                    <span class="cat-mgr-icon">${cat.icon || '📄'}</span>
                    <span class="cat-mgr-label">${cat.label ? cat.label.zh : cat.id}</span>
                    <span class="cat-mgr-sub-count">${(cat.subItems || []).length} 子类</span>
                    <button class="admin-btn admin-btn-sm admin-btn-outline cat-mgr-edit" data-ci="${ci}">✏️</button>
                    <button class="admin-btn admin-btn-sm admin-btn-danger cat-mgr-del" data-ci="${ci}">🗑</button>
                </div>
                <div class="cat-mgr-subs">
                    ${(cat.subItems || []).map((sub, si) => `
                        <div class="cat-mgr-sub">
                            <span>${sub.label ? sub.label.zh : sub.id}</span>
                            <button class="cat-mgr-sub-del" data-ci="${ci}" data-si="${si}">✕</button>
                        </div>
                    `).join('')}
                    <button class="cat-mgr-add-sub" data-ci="${ci}">＋ 添加子类</button>
                </div>
            </div>`;
        });

        html += `<div class="cat-mgr-actions">
            <button class="admin-btn admin-btn-accent" id="catMgrAddBtn">＋ 添加新大类</button>
        </div>`;

        const container = document.querySelector('.admin-entry-list') || entryList;
        container.innerHTML = html;
        container.style.display = 'block';

        // 绑定事件
        // 编辑大类
        container.querySelectorAll('.cat-mgr-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.ci);
                editCategoryDialog(ci);
            });
        });
        // 删除大类
        container.querySelectorAll('.cat-mgr-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.ci);
                if (confirm('确定删除这个大类及其所有子类吗？（条目数据不会丢失）')) {
                    contentData.navigation.splice(ci, 1);
                    renderSidebar();
                    showCategoryManager();
                    setDirty(true);
                    showToast('🗑 大类已删除', 'info');
                }
            });
        });
        // 删除子类
        container.querySelectorAll('.cat-mgr-sub-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.ci);
                const si = parseInt(btn.dataset.si);
                if (confirm('确定删除这个子类吗？')) {
                    contentData.navigation[ci].subItems.splice(si, 1);
                    renderSidebar();
                    showCategoryManager();
                    setDirty(true);
                    showToast('🗑 子类已删除', 'info');
                }
            });
        });
        // 添加子类
        container.querySelectorAll('.cat-mgr-add-sub').forEach(btn => {
            btn.addEventListener('click', () => {
                const ci = parseInt(btn.dataset.ci);
                const id = prompt('子类ID（英文，如 "places"）：');
                if (!id) return;
                const zh = prompt('中文名称（如 "去过的地方"）：');
                if (!zh) return;
                const en = prompt('English name (e.g. "Places"）：');
                if (!en) return;
                contentData.navigation[ci].subItems.push({
                    id: id,
                    label: { zh, en }
                });
                // 确保有对应的内容数组
                if (!contentData.content[id]) contentData.content[id] = [];
                renderSidebar();
                showCategoryManager();
                setDirty(true);
                showToast('✅ 已添加子类', 'success');
            });
        });
        // 添加大类
        const addBtn = document.getElementById('catMgrAddBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                addCategoryDialog();
            });
        }
    }

    // ── 编辑大类对话框 ──
    function editCategoryDialog(ci) {
        const cat = contentData.navigation[ci];
        if (!cat) return;
        const zh = prompt('大类中文名称：', cat.label ? cat.label.zh : '');
        if (!zh) return;
        const en = prompt('English name:', cat.label ? cat.label.en : '');
        if (!en) return;
        const icon = prompt('图标（Emoji，如 🌍）：', cat.icon || '📄');
        if (!icon) return;
        const descZh = prompt('中文描述：', cat.desc ? cat.desc.zh : '');
        const descEn = prompt('English description:', cat.desc ? cat.desc.en : '');

        cat.label = { zh, en };
        cat.icon = icon;
        if (descZh) cat.desc = { zh: descZh, en: descEn || descZh };

        renderSidebar();
        showCategoryManager();
        setDirty(true);
        showToast('✅ 大类已更新', 'success');
    }

    // ── 添加大类对话框 ──
    function addCategoryDialog() {
        const id = prompt('大类ID（英文，如 "travel"）：');
        if (!id) return;
        const zh = prompt('大类中文名称（如 "旅行"）：');
        if (!zh) return;
        const en = prompt('English name (e.g. "Travel")：');
        if (!en) return;
        const icon = prompt('图标（Emoji，如 🌍）：', '📄');
        const descZh = prompt('中文描述：');
        const descEn = prompt('English description:');

        const newCat = {
            id: id,
            icon: icon || '📄',
            label: { zh, en },
            desc: descZh ? { zh: descZh, en: descEn || descZh } : { zh: '', en: '' },
            subItems: []
        };

        contentData.navigation.push(newCat);
        renderSidebar();
        showCategoryManager();
        setDirty(true);
        showToast('✅ 已添加大类，别忘了添加子类', 'success');
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
        if (isDirty && !confirm('有未保存的更改，返回设置将丢失这些更改。确定吗？')) return;
        adminApp.style.display = 'none';
        setupScreen.style.display = 'flex';
    });

    // 手动模式按钮
    const manualBtn = document.getElementById('manualModeBtn');
    if (manualBtn) manualBtn.addEventListener('click', enterManualMode);

    // 下载 content.json
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const saveData = {
                navigation: getNavigation(),
                contact: getContact(),
                content: contentData.content || {}
            };
            const jsonStr = JSON.stringify(saveData, null, 4);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'content.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📥 已下载 content.json，请手动上传到 GitHub', 'success');
        });
    }

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
