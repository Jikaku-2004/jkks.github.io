/**
 * admin.js - JKK 管理后台（镜像公开网页布局 + 全内联编辑）
 */

(function() {
    'use strict';
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    let config = {};
    let siteNav = [], siteContact = {}, siteContent = {}, siteWelcome = {};
    let currentLang = 'zh', currentCategory = null, currentSubcategory = null;
    let contentSha = null, isDirty = false, editingEntry = null, editingSubId = null, editingCatIdx = null;
    let pendingUploads = new Map(), editingPendingUploads = new Map();
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    const IMAGE_TYPES = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
        'image/webp': 'webp', 'image/avif': 'avif'
    };
    const PIXEL_ICONS = Object.freeze({
        reading: 'RD', art: 'AR', sports: 'SP', research: 'RS',
        kappa: 'KP', contact: 'CT', email: 'ML', welcome: 'HM', download: 'DL'
    });

    const WELCOME_FIELDS = {
        welcomeTitle: { zh: '欢迎来到Jikaku的个人网页', en: "Welcome to Jikaku's Personal Page" },
        welcomeSubtitle: { zh: '探索 · 思考 · 记录', en: 'Explore · Think · Record' },
        welcomeDesc: { zh: '<p>这里是我记录阅读、艺术、运动与研究的个人空间。</p><p>请从左侧导航栏选择感兴趣的分类开始探索。</p>', en: '<p>A personal space for recording reading, art, sports, and research.</p><p>Choose a category from the sidebar to start exploring.</p>' },
        welcomeQuote: { zh: '“今天会是一个好日子” —— jkk', en: '&ldquo;Today will be a good day&rdquo; &mdash; jkk' }
    };

    function init() {
        const saved = localStorage.getItem('jkk_admin_config');
        if (saved) { try { const c = JSON.parse(saved);
            $('#setupOwner').value = c.owner || ''; $('#setupRepo').value = c.repo || '';
            $('#setupToken').value = c.token || ''; $('#setupBranch').value = c.branch || 'main';
            config = c; } catch(e) {} }
        $('#setupBtn').onclick = connectRepo;
        $('#manualModeBtn').onclick = enterManualMode;
        [$('#setupOwner'),$('#setupRepo'),$('#setupToken'),$('#setupBranch')].forEach(el => {
            el.onkeydown = e => { if (e.key === 'Enter') connectRepo(); }; });
        $('#saveBtn').onclick = saveToGitHub;
        $('#reloadBtn').onclick = reloadData;
        $('#navWelcome').onclick = showWelcome;
        $('#navContact').onclick = showContact;
        $('#navDownload').onclick = downloadContent;
        $('#addEntryBtn').onclick = addNewEntry;
        $('#editCatBtn').onclick = () => { if (currentCategory !== null) openCatEditor(currentCategory); };
        $('#addSubBtn').onclick = manageSubcategories;
        $('#textEditorSave').onclick = () => { const v = $('#textEditorInput').value; if (window._textCb) window._textCb(v); closeTextEditor(); };
        $('#textEditorCancel').onclick = closeTextEditor;
        $('#textEditorModalClose').onclick = closeTextEditor;
        $('#entryModalSave').onclick = saveEntry;
        $('#entryModalCancel').onclick = closeEntryEditor;
        $('#entryModalClose').onclick = closeEntryEditor;
        $('#entryModalDelete').onclick = deleteEntry;
        $('#catModalSave').onclick = saveCategory;
        $('#catModalCancel').onclick = closeCatEditor;
        $('#catModalClose').onclick = closeCatEditor;
        $('#catModalDelete').onclick = deleteCategory;
        $('#subModalCancel').onclick = closeSubEditor;
        $('#subModalClose').onclick = closeSubEditor;
        document.addEventListener('click', e => {
            const btn = e.target.closest('.edit-btn'); if (!btn) return;
            const block = btn.closest('.editable-block'); if (!block) return;
            const key = block.dataset.key; if (!key || !WELCOME_FIELDS[key]) return;
            var currentVal = (siteWelcome[key] && siteWelcome[key][currentLang]) ? siteWelcome[key][currentLang] : WELCOME_FIELDS[key][currentLang];
            window._textCb = val => {
                if (!siteWelcome[key]) siteWelcome[key] = {};
                siteWelcome[key][currentLang] = val;
                updateWelcomeText(); markDirty(); toast('已更新','success');
            };
            openTextEditor('编辑: '+key, currentVal);
        });
        // 语言切换
        setupAdminLangToggle();
        if (config.owner && config.repo && config.token) connectRepo();
    }

    async function connectRepo() {
        config = { owner:$('#setupOwner').value.trim(), repo:$('#setupRepo').value.trim(),
            token:$('#setupToken').value.trim(), branch:$('#setupBranch').value.trim()||'main' };
        if (!config.owner||!config.repo||!config.token) return showError('请填写完整信息');
        localStorage.setItem('jkk_admin_config', JSON.stringify(config));
        const btn=$('#setupBtn'); btn.disabled=true; btn.textContent='连接中...';
        try {
            const url='https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json?ref='+config.branch;
            const r=await fetch(url,{headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json'}});
            if(!r.ok) throw new Error('HTTP '+r.status);
            const f=await r.json(); contentSha=f.sha;
            var rawText=decodeURIComponent(escape(atob(f.content)));
            parseData(JSON.parse(rawText));
            enterApp(); toast('已连接','success');
        } catch(e) {
            const m=e.message||'';
            if(m.includes('401')) showError('Token无效');
            else if(m.includes('403')) showError('Token权限不足');
            else if(m.includes('404')) showError('仓库或文件不存在');
            else showError(m);
        }
        btn.disabled=false; btn.textContent='LINK // 连接仓库';
    }

    async function enterManualMode() {
        const btn=$('#manualModeBtn'); btn.textContent='加载中...';
        try {
            const r=await fetch('data/content.json'); if(!r.ok) throw new Error('HTTP '+r.status);
            parseData(await r.json()); contentSha=null; config={};
            enterApp(); toast('已加载','success');
        } catch(e) { showError(e.message); }
        btn.textContent='MANUAL // 手动模式（无需 Token）';
    }

    function parseData(raw) {
        clearAllPendingUploads();
        siteNav=raw.navigation||[]; siteContact=raw.contact||{}; siteContent=raw.content||raw;
        if(Object.keys(siteContent).length===0&&!raw.navigation) siteContent=raw;
        // 加载欢迎页数据，合并默认值
        siteWelcome = raw.welcome || {};
        Object.keys(WELCOME_FIELDS).forEach(function(k){
            if (!siteWelcome[k]) siteWelcome[k] = {};
            if (!siteWelcome[k].zh) siteWelcome[k].zh = WELCOME_FIELDS[k].zh;
            if (!siteWelcome[k].en) siteWelcome[k].en = WELCOME_FIELDS[k].en;
        });
        isDirty=false; updateStatus();
    }

    function enterApp() {
        $('#setupScreen').style.display='none';
        $('#adminTopBar').style.display=''; $('#adminLayout').style.display='';
        $('#repoBadge').textContent=config.owner?config.owner+'/'+config.repo:'手动';
        renderNav(); showWelcome();
    }

    function renderNav() {
        const list=$('#navList'); list.innerHTML='';
        siteNav.forEach(function(cat,ci){
            var li=document.createElement('li');
            var item=document.createElement('div');
            item.className='nav-item'; item.dataset.ci=ci;
            var cl=cat.label?(cat.label[currentLang]||cat.label.zh||cat.id):cat.id;
            item.innerHTML='<span class="nav-icon">'+pixelIconMarkup(cat.id,cat.icon)+'</span><span class="nav-label">'+esc(cl)+'</span><span class="nav-arrow">\u25B6</span>'+
                '<button class="nav-del" data-ci="'+ci+'" title="删除">\u2715</button>';
            item.onclick=function(){toggleCat(ci);};
            li.appendChild(item);
            // 始终创建子导航ul（即使subItems为空），支持后续添加子类
            var hasSubs = cat.subItems && cat.subItems.length > 0;
            var ul=document.createElement('ul'); ul.className='sub-nav'; ul.id='sub-'+ci;
            if (hasSubs) {
                cat.subItems.forEach(function(sub,si){
                    var sli=document.createElement('li');
                    var sel=document.createElement('div');
                    sel.className='sub-nav-item'; sel.dataset.ci=ci; sel.dataset.si=si;
                    var sl=sub.label?(sub.label[currentLang]||sub.label.zh||sub.id):sub.id;
                    sel.innerHTML='<span>'+esc(sl)+'</span>';
                    sel.onclick=function(e){e.stopPropagation();selectSub(ci,si);};
                    sli.appendChild(sel); ul.appendChild(sli);
                });
            }
            li.appendChild(ul);
            list.appendChild(li);
        });
        var ali=document.createElement('li');
        ali.style.padding='10px 20px';
        ali.innerHTML='<button class="admin-btn admin-btn-sm admin-btn-accent" id="addCatBtn" style="width:100%">[+] 添加新大类</button>';
        list.appendChild(ali);
        document.getElementById('addCatBtn').onclick=addNewCategory;
        var dels=document.querySelectorAll('.nav-del');
        for(var i=0;i<dels.length;i++){(function(d){d.onclick=function(e){e.stopPropagation();
            if(confirm('删除此大类?')){siteNav.splice(parseInt(d.dataset.ci),1);renderNav();showWelcome();markDirty();toast('已删除','info');}
        };})(dels[i]);}
    }

    function toggleCat(ci) {
        var cat = siteNav[ci]; if (!cat) return;
        var s=document.getElementById('sub-'+ci);
        // 如果大类没有子类，直接打开子类管理面板
        if (!cat.subItems || cat.subItems.length === 0) {
            currentCategory = ci;
            currentSubcategory = null;
            manageSubcategories();
            return;
        }
        var isOpening=!s.classList.contains('open');
        var opens=document.querySelectorAll('.sub-nav.open');
        for(var i=0;i<opens.length;i++){if(opens[i].id!=='sub-'+ci)opens[i].classList.remove('open');}
        s.classList.toggle('open');
        var item=document.querySelector('.nav-item[data-ci="'+ci+'"]');
        if(item)item.classList.toggle('expanded');
        // 展开时自动选中第一个子类
        if(isOpening){
            var firstSub=s.querySelector('.sub-nav-item');
            if(firstSub) selectSub(ci, parseInt(firstSub.dataset.si));
        }
    }

    function selectSub(ci,si) {
        var cat=siteNav[ci]; if(!cat||!cat.subItems||!cat.subItems[si]) return;
        currentCategory=ci; currentSubcategory=si;
        var items=document.querySelectorAll('.nav-item'); for(var i=0;i<items.length;i++)items[i].classList.remove('active');
        var sits=document.querySelectorAll('.sub-nav-item'); for(var i=0;i<sits.length;i++)sits[i].classList.remove('active');
        var t=document.querySelector('.sub-nav-item[data-ci="'+ci+'"][data-si="'+si+'"]');
        if(t) t.classList.add('active');
        showCatPage(cat,cat.subItems[si]);
        closeMenu();
    }

    function showCatPage(cat,sub) {
        hidePages(); $('#categoryPage').style.display='';
        var lang=currentLang;
        document.getElementById('categoryTitle').textContent=sub.label?sub.label[lang]||sub.id:sub.id;
        document.getElementById('categoryDesc').textContent=cat.desc?cat.desc[lang]||'':'';
        var tabs=document.getElementById('subcategoryTabs'); tabs.innerHTML='';
        cat.subItems.forEach(function(s,i){
            var tb=document.createElement('button');
            tb.className='subcategory-tab'; if(s.id===sub.id)tb.classList.add('active');
            tb.textContent=s.label?s.label[lang]||s.id:s.id;
            tb.onclick=function(){selectSub(siteNav.indexOf(cat),i);};
            tabs.appendChild(tb);
        });
        renderEntries(sub.id);
    }

    function renderEntries(subId) {
        var c=document.getElementById('entriesContainer'); c.innerHTML='';
        var entries=siteContent[subId]||[];
        if(entries.length===0){
            var empty=document.createElement('div');
            empty.className='empty-state admin-empty-state';
            empty.innerHTML='<p>NO RECORDS // 暂无条目</p>';
            c.appendChild(empty);
            return;
        }
        var sorted=entries.slice().sort(function(a,b){return(b.date||'').localeCompare(a.date||'');});
        sorted.forEach(function(entry){
            var card=document.createElement('div'); card.className='entry-card';
            var title=currentLang==='zh'?entry.title_zh:entry.title_en;
            var tags=currentLang==='zh'?(entry.tags_zh||[]):(entry.tags_en||[]);
            var body=currentLang==='zh'?entry.content_zh:entry.content_en;
            card.innerHTML='<div class="entry-header"><h3 class="entry-title">'+esc(title)+'</h3>'+
                '<span class="entry-date">'+(entry.date||'')+'</span>'+
                '<button class="entry-edit-btn" title="编辑">EDIT</button>'+
                '<button class="entry-del-btn" title="删除">DEL</button></div>'+

                '<div class="entry-tags">'+tags.map(function(t){return'<span class="entry-tag">'+esc(t)+'</span>';}).join('')+'</div>'+
                '<div class="entry-body"><p>'+esc((body||'').substring(0,200))+((body||'').length>200?'...':'')+'</p></div>';
            c.appendChild(card);
            var editBtns=card.querySelectorAll('.entry-edit-btn');
            editBtns[0].onclick=function(){openEntryEditor(subId,entry);};
            var delBtns=card.querySelectorAll('.entry-del-btn');
            delBtns[0].onclick=function(){
                if(confirm('删除?')){var a=siteContent[subId]||[];var i=a.findIndex(function(e){return e.id===entry.id;});if(i>=0)a.splice(i,1);cleanupUnreferencedPendingUploads();renderEntries(subId);markDirty();toast('已删除','info');}
            };
        });
    }
    }

    function showWelcome(){hidePages();$('#welcomePage').style.display='';currentCategory=null;updateWelcomeText();}
    function updateWelcomeText(){
        var lang=currentLang;
        Object.keys(WELCOME_FIELDS).forEach(function(k){
            var b=document.querySelector('.editable-block[data-key="'+k+'"]'); if(!b)return;
            var el=b.querySelector('.welcome-title,.welcome-subtitle,.welcome-desc,.welcome-quote');
            if(el){
                var val = (siteWelcome[k] && siteWelcome[k][lang]) ? siteWelcome[k][lang] : WELCOME_FIELDS[k][lang];
                el.innerHTML=val;
            }
        });
    }

    function showContact(){
        hidePages();$('#contactPage').style.display='';
        var lang=currentLang;
        var title=lang==='zh'?'联系方式':'Contact';
        var desc=lang==='zh'?'欢迎通过以下方式与我联系':'Feel free to reach out to me';
        var c=Object.keys(siteContact).length>0?siteContact:{email:{label:{zh:'邮箱',en:'Email'},value:'jkk@example.com',icon:'\u2709'}};
        var h='<div class="contact-card"><h2 class="contact-title">'+title+'</h2><p style="color:var(--text-secondary);margin-bottom:24px;">'+desc+'</p>';
        Object.keys(c).forEach(function(contactId){
            var i=c[contactId];
            var lb=i.label?i.label[currentLang]||'':('');
            h+='<div class="contact-item" data-contact-id="'+esc(contactId)+'"><span class="contact-icon">'+pixelIconMarkup(contactId,i.icon)+'</span><span class="contact-label">'+esc(lb)+'</span><span class="contact-value">'+esc(i.value)+'</span><button class="edit-btn contact-edit-btn" data-contact="'+esc(contactId)+'" title="编辑">[E]</button></div>';
        });
        h+='</div>'; $('#contactPage').innerHTML=h;
        // 绑定联系方式编辑按钮
        var cebs = $('#contactPage').querySelectorAll('.contact-edit-btn');
        for (var i = 0; i < cebs.length; i++) {
            (function(btn){
                btn.onclick = function(){
                    var cid = btn.dataset.contact;
                    var item = siteContact[cid];
                    if (!item) return;
                    var currentVal = item.value || '';
                    window._textCb = function(val){
                        if (!siteContact[cid]) siteContact[cid] = {};
                        siteContact[cid].value = val;
                        showContact();
                        markDirty();
                        toast('联系方式已更新','success');
                    };
                    openTextEditor('编辑: ' + (item.label ? item.label[currentLang] : cid), currentVal);
                };
            })(cebs[i]);
        }
    }

    function hidePages(){['welcomePage','categoryPage','contactPage'].forEach(function(id){$('#'+id).style.display='none';});}

    function openTextEditor(title,val){$('#textEditorTitle').textContent=title;$('#textEditorInput').value=val;$('#textEditorModal').style.display='flex';}
    function closeTextEditor(){$('#textEditorModal').style.display='none';window._textCb=null;}

    function openEntryEditor(subId,entry){
        editingSubId=subId; editingEntry=entry;
        discardEditingUploads();
        var isZh=currentLang==='zh';
        $('#entryModalTitle').textContent='Edit: '+(entry.title_zh||entry.title_en||entry.id);
        $('#entryModalBody').innerHTML=
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'中文标题':'Title')+' *</label><input type="text" id="eeZh" value="'+esc(entry.title_zh||'')+'"></div>'+
            '<div class="editor-field"><label>'+(isZh?'英文标题':'English Title')+' *</label><input type="text" id="eeEn" value="'+esc(entry.title_en||'')+'"></div></div>'+
            '<div class="editor-row"><div class="editor-field"><label>日期</label><input type="date" id="eeDate" value="'+(entry.date||'')+'"></div>'+
            '<div class="editor-field"><label>ID</label><input type="text" id="eeId" value="'+esc(entry.id||'')+'"></div></div>'+
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'中文标签':'Chinese Tags')+'</label><input type="text" id="eeTagsZh" value="'+esc((entry.tags_zh||[]).join(', '))+'"></div>'+
            '<div class="editor-field"><label>'+(isZh?'英文标签':'English Tags')+'</label><input type="text" id="eeTagsEn" value="'+esc((entry.tags_en||[]).join(', '))+'"></div></div>'+
            '<div class="editor-field"><label>'+(isZh?'中文内容 (Markdown)':'Chinese Content')+'</label><textarea id="eeContentZh" rows="4">'+esc(entry.content_zh||'')+'</textarea></div>'+
            '<div class="editor-field"><label>'+(isZh?'英文内容':'English Content (Markdown)')+'</label><textarea id="eeContentEn" rows="4">'+esc(entry.content_en||'')+'</textarea></div>'+
            '<div class="editor-field image-editor-field">'+
                '<label>'+(isZh?'本地图片':'Local images')+'</label>'+
                '<div class="image-dropzone" id="imageDropzone" tabindex="0" role="button" aria-label="选择或拖入本地图片">'+
                    '<input type="file" id="eeImageFiles" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple hidden>'+
                    '<span class="upload-pixel-icon">▣</span>'+
                    '<strong>'+(isZh?'点击选择或拖入图片':'Choose or drop images')+'</strong>'+
                    '<small>'+(isZh?'JPG / PNG / GIF / WEBP / AVIF，单张最大 10MB；保存时与内容一并上传':'JPG / PNG / GIF / WEBP / AVIF, max 10MB each; uploaded with content')+'</small>'+
                '</div>'+
                '<textarea id="eeImages" rows="2" aria-label="图片引用路径">'+esc((entry.images||[]).join('\n'))+'</textarea>'+
                '<div class="image-upload-list" id="imageUploadList"></div>'+
            '</div>'+
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'链接 (文字,网址)':'Links')+'</label><textarea id="eeLinks" rows="2">'+esc((entry.links||[]).map(function(l){return l.text+','+l.url;}).join('\n'))+'</textarea></div>'+
            '<div class="editor-field"><label>'+(isZh?'视频链接':'Videos')+'</label><textarea id="eeVideos" rows="2">'+esc((entry.videos||[]).map(function(v){return v.url;}).join('\n'))+'</textarea></div></div>';
        setupImagePicker();
        renderImageUploadList();
        $('#entryModal').style.display='flex';
    }
    function closeEntryEditor(){
        discardEditingUploads();
        $('#entryModal').style.display='none';
        editingEntry=null;
    }
    function saveEntry(){
        if(!editingEntry||!editingSubId)return;
        var e=editingEntry;
        e.title_zh=$('#eeZh').value.trim(); e.title_en=$('#eeEn').value.trim();
        if(!e.title_zh&&!e.title_en)return toast('请至少填写一个标题','error');
        e.date=$('#eeDate').value; e.id=$('#eeId').value.trim()||e.id;
        e.tags_zh=$('#eeTagsZh').value.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean);
        e.tags_en=$('#eeTagsEn').value.split(/[,，]/).map(function(s){return s.trim();}).filter(Boolean);
        e.content_zh=$('#eeContentZh').value.trim(); e.content_en=$('#eeContentEn').value.trim();
        e.images=$('#eeImages').value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
        e.links=$('#eeLinks').value.split('\n').map(function(s){var p=s.split(/[,，]/);return p.length>=2?{url:p[1].trim(),text:p[0].trim()}:null;}).filter(Boolean);
        e.videos=$('#eeVideos').value.split('\n').map(function(s){var u=s.trim();return u?{url:u,platform:u.includes('bilibili')?'bilibili':'youtube'}:null;}).filter(Boolean);
        editingPendingUploads.forEach(function(upload,path){pendingUploads.set(path,upload);});
        editingPendingUploads=new Map();
        closeEntryEditor();
        var arr=siteContent[editingSubId]||[];
        var i=arr.findIndex(function(x){return x.id===e.id;});
        if(i>=0)arr[i]=e;else arr.push(e);
        siteContent[editingSubId]=arr;
        cleanupUnreferencedPendingUploads();
        if(currentCategory!==null&&siteNav[currentCategory]){
            var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
            if(sub)showCatPage(cat,sub);
        }
        markDirty();toast('已保存','success');
    }
    function deleteEntry(){
        if(!editingEntry||!editingSubId||!confirm('删除?'))return;
        var arr=siteContent[editingSubId]||[];
        var i=arr.findIndex(function(e){return e.id===editingEntry.id;});
        if(i>=0)arr.splice(i,1);
        closeEntryEditor();
        cleanupUnreferencedPendingUploads();
        if(currentCategory!==null&&siteNav[currentCategory]){
            var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
            if(sub)showCatPage(cat,sub);
        }
        markDirty();toast('已删除','info');
    }

    function setupImagePicker(){
        var dropzone=$('#imageDropzone'),input=$('#eeImageFiles'),refs=$('#eeImages');
        if(!dropzone||!input||!refs)return;
        dropzone.onclick=function(){input.click();};
        dropzone.onkeydown=function(e){
            if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}
        };
        input.onchange=function(){addLocalImages(input.files);input.value='';};
        ['dragenter','dragover'].forEach(function(type){
            dropzone.addEventListener(type,function(e){e.preventDefault();dropzone.classList.add('drag-over');});
        });
        ['dragleave','drop'].forEach(function(type){
            dropzone.addEventListener(type,function(e){e.preventDefault();dropzone.classList.remove('drag-over');});
        });
        dropzone.addEventListener('drop',function(e){addLocalImages(e.dataTransfer.files);});
        refs.addEventListener('input',renderImageUploadList);
    }

    function addLocalImages(fileList){
        if(!fileList||!fileList.length)return;
        var refs=$('#eeImages');
        var paths=refs.value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
        var added=0;
        Array.prototype.forEach.call(fileList,function(file){
            if(!IMAGE_TYPES[file.type]){
                toast('不支持的图片格式: '+file.name,'error');return;
            }
            if(file.size>MAX_IMAGE_BYTES){
                toast('图片超过 10MB: '+file.name,'error');return;
            }
            var path=createImagePath(file);
            var previewUrl=URL.createObjectURL(file);
            editingPendingUploads.set(path,{file:file,previewUrl:previewUrl});
            paths.push(path);added++;
        });
        refs.value=paths.join('\n');
        renderImageUploadList();
        if(added)toast('已加入 '+added+' 张图片，提交时自动上传','success');
    }

    function createImagePath(file){
        var stamp=new Date().toISOString().replace(/\D/g,'').slice(0,14);
        var id=($('#eeId')&&$('#eeId').value.trim())||(editingEntry&&editingEntry.id)||'entry';
        var entrySlug=id.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'entry';
        var rawName=(file.name||'image').replace(/\.[^.]+$/,'');
        var fileSlug=rawName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'image';
        var ext=IMAGE_TYPES[file.type];
        var suffix=Math.random().toString(36).slice(2,7);
        return 'images/'+stamp+'-'+entrySlug+'-'+fileSlug+'-'+suffix+'.'+ext;
    }

    function renderImageUploadList(){
        var refs=$('#eeImages'),list=$('#imageUploadList');
        if(!refs||!list)return;
        var paths=refs.value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
        if(!paths.length){
            list.innerHTML='<p class="image-empty">NO IMAGE REFERENCES</p>';return;
        }
        list.innerHTML=paths.map(function(path,index){
            var upload=editingPendingUploads.get(path)||pendingUploads.get(path);
            var src=upload?upload.previewUrl:path;
            return '<div class="image-upload-item">'+
                '<div class="image-upload-thumb"><img src="'+esc(src)+'" alt=""></div>'+
                '<div class="image-upload-meta"><strong>'+esc(path.split('/').pop())+'</strong>'+
                '<small>'+esc(path)+'</small></div>'+
                (upload?'<span class="upload-state">待上传</span>':'<span class="upload-state saved">已引用</span>')+
                '<button type="button" class="image-remove-btn" data-image-index="'+index+'" aria-label="移除图片">×</button>'+
                '</div>';
        }).join('');
        var buttons=list.querySelectorAll('.image-remove-btn');
        for(var i=0;i<buttons.length;i++)buttons[i].onclick=function(){
            var index=parseInt(this.dataset.imageIndex,10);
            var path=paths[index];
            var staged=editingPendingUploads.get(path);
            if(staged){URL.revokeObjectURL(staged.previewUrl);editingPendingUploads.delete(path);}
            paths.splice(index,1);refs.value=paths.join('\n');renderImageUploadList();
        };
    }

    function discardEditingUploads(){
        editingPendingUploads.forEach(function(upload){URL.revokeObjectURL(upload.previewUrl);});
        editingPendingUploads.clear();
    }

    function cleanupUnreferencedPendingUploads(){
        var referenced=new Set();
        Object.keys(siteContent).forEach(function(key){
            (siteContent[key]||[]).forEach(function(entry){
                (entry.images||[]).forEach(function(path){referenced.add(path);});
            });
        });
        pendingUploads.forEach(function(upload,path){
            if(!referenced.has(path)){URL.revokeObjectURL(upload.previewUrl);pendingUploads.delete(path);}
        });
        updateStatus();
    }

    function clearAllPendingUploads(){
        discardEditingUploads();
        pendingUploads.forEach(function(upload){URL.revokeObjectURL(upload.previewUrl);});
        pendingUploads.clear();
    }

    function addNewEntry(){
        if(currentCategory===null)return toast('请先选择分类','error');
        var cat=siteNav[currentCategory]; if(!cat||!cat.subItems||currentSubcategory===null)return toast('请先选择子类','error');
        var sub=cat.subItems[currentSubcategory];
        var entry={id:'new-'+Date.now(),title_zh:'',title_en:'',date:new Date().toISOString().split('T')[0],tags_zh:[],tags_en:[],content_zh:'',content_en:'',images:[],videos:[],links:[]};
        openEntryEditor(sub.id,entry);
    }

    function openCatEditor(ci){
        var cat=siteNav[ci]; if(!cat)return;
        editingCatIdx=ci; var d=cat.desc||{};
        $('#catModalTitle').textContent='编辑大类';
        $('#catModalBody').innerHTML=
            '<div class="editor-field"><label>大类 ID</label><input type="text" id="ceId" value="'+esc(cat.id)+'"></div>'+
            '<div class="editor-row"><div class="editor-field"><label>中文名称</label><input type="text" id="ceZh" value="'+esc(cat.label?cat.label.zh:'')+'"></div>'+
            '<div class="editor-field"><label>English</label><input type="text" id="ceEn" value="'+esc(cat.label?cat.label.en:'')+'"></div></div>'+
            '<div class="editor-field"><label>像素图标代码（1-3 个字母）</label><input type="text" id="ceIcon" maxlength="3" value="'+esc(pixelIconCode(cat.id,cat.icon))+'"></div>'+
            '<div class="editor-field"><label>中文描述</label><textarea id="ceDescZh" rows="2">'+esc(d.zh||'')+'</textarea></div>'+
            '<div class="editor-field"><label>English Description</label><textarea id="ceDescEn" rows="2">'+esc(d.en||'')+'</textarea></div>';
        $('#catModal').style.display='flex';
    }
    function closeCatEditor(){editingCatIdx=null;$('#catModal').style.display='none';}
    function saveCategory(){
        if(editingCatIdx===null)return;
        var cat=siteNav[editingCatIdx];
        cat.id=$('#ceId').value.trim()||cat.id;
        cat.label={zh:$('#ceZh').value.trim(),en:$('#ceEn').value.trim()};
        cat.icon=normalizeIconCode($('#ceIcon').value,cat.id);
        cat.desc={zh:$('#ceDescZh').value.trim(),en:$('#ceDescEn').value.trim()};
        closeCatEditor();renderNav();
        if(currentCategory!==null&&siteNav[currentCategory]){
            var c=siteNav[currentCategory];var s=c.subItems?c.subItems[currentSubcategory||0]:null;
            if(s)showCatPage(c,s);
        }
        markDirty();toast('已更新','success');
    }
    function deleteCategory(){
        if(editingCatIdx===null||!confirm('删除此大类?'))return;
        siteNav.splice(editingCatIdx,1);closeCatEditor();renderNav();showWelcome();
        markDirty();toast('已删除','info');
    }

    function addNewCategory(){
        var id=prompt('大类ID (如 travel):');if(!id)return;
        var zh=prompt('中文名称 (如 旅行):');if(!zh)return;
        var en=prompt('English name:');if(!en)return;
        var icon=prompt('像素图标代码（1-3 个字母）:',normalizeIconCode('',id));
        siteNav.push({id:id,icon:normalizeIconCode(icon,id),label:{zh:zh,en:en},desc:{zh:'',en:''},subItems:[]});
        renderNav();markDirty();toast('已添加, 记得添加子类','success');
    }

    function manageSubcategories(){
        if(currentCategory===null)return;
        var cat=siteNav[currentCategory];if(!cat)return;
        $('#subModalTitle').textContent='管理子类: '+(cat.label?cat.label.zh:cat.id);
        var h='<p style="margin-bottom:12px;color:var(--text-secondary);font-size:0.9rem;">点击删除或编辑, 底部添加新子类</p>';
        (cat.subItems||[]).forEach(function(sub,si){
            var subLabelZh = sub.label ? sub.label.zh : sub.id;
            var subLabelEn = sub.label ? sub.label.en : '';
            h+='<div style="display:flex;align-items:center;padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;">'+
                '<span style="flex:1">'+esc(subLabelZh)+'</span>'+
                '<button class="admin-btn admin-btn-sm admin-btn-outline sub-edit" data-si="'+si+'" style="margin-right:4px;">编辑</button>'+
                '<button class="admin-btn admin-btn-sm admin-btn-danger sub-del" data-si="'+si+'">删除</button></div>';
        });
        h+='<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">'+
            '<h4 style="margin-bottom:8px;font-size:0.9rem;">添加新子类</h4>'+
            '<div class="editor-field"><label>子类 ID</label><input type="text" id="nsId" placeholder="places"></div>'+
            '<div class="editor-row"><div class="editor-field"><label>中文名称</label><input type="text" id="nsZh" placeholder="去过的地方"></div>'+
            '<div class="editor-field"><label>English</label><input type="text" id="nsEn" placeholder="Places"></div></div>'+
            '<button class="admin-btn admin-btn-accent admin-btn-sm" id="nsAddBtn">[+] 添加</button></div>';
        $('#subModalBody').innerHTML=h;$('#subModal').style.display='flex';
        var dels=$('#subModalBody').querySelectorAll('.sub-del');
        for(var i=0;i<dels.length;i++){(function(d){d.onclick=function(){
            var si=parseInt(d.dataset.si);if(confirm('删除?')){cat.subItems.splice(si,1);manageSubcategories();renderNav();markDirty();toast('已删除','info');}
        };})(dels[i]);}
        // 子类编辑按钮
        var edits = $('#subModalBody').querySelectorAll('.sub-edit');
        for(var j=0;j<edits.length;j++){(function(btn){
            btn.onclick = function(){
                var si = parseInt(btn.dataset.si);
                var sub = cat.subItems[si];
                var oldZh = sub.label ? sub.label.zh : sub.id;
                var oldEn = sub.label ? sub.label.en : '';
                var oldId = sub.id;
                var newZh = prompt('中文名称:', oldZh);
                if (newZh === null) return; // 取消
                var newEn = prompt('English name:', oldEn);
                if (newEn === null) return;
                var newId = prompt('子类 ID:', oldId);
                if (newId === null) return;
                if (!newZh || !newId) { toast('名称和ID不能为空','error'); return; }
                // 如果ID变更，迁移内容数据
                if (newId !== oldId && siteContent[oldId]) {
                    siteContent[newId] = siteContent[oldId];
                    delete siteContent[oldId];
                }
                sub.id = newId;
                sub.label = {zh: newZh, en: newEn || newZh};
                if (!siteContent[newId]) siteContent[newId] = [];
                manageSubcategories();
                renderNav();
                markDirty();
                toast('子类已更新','success');
            };
        })(edits[j]);}
        document.getElementById('nsAddBtn').onclick=function(){
            var id=document.getElementById('nsId').value.trim();
            var zh=document.getElementById('nsZh').value.trim();
            var en=document.getElementById('nsEn').value.trim();
            if(!id||!zh)return toast('请填写子类ID和名称','error');
            if(!cat.subItems)cat.subItems=[];
            cat.subItems.push({id:id,label:{zh:zh,en:en||zh}});
            if(!siteContent[id])siteContent[id]=[];
            manageSubcategories();renderNav();markDirty();toast('已添加','success');
        };
    }
    function closeSubEditor(){document.getElementById('subModal').style.display='none';}

    async function saveToGitHub(){
        if(!config.token){
            downloadContent();
            toast(pendingUploads.size?'手动模式已下载 JSON；本地图片需手动上传到 images 文件夹':'手动模式: 已下载','info');
            return;
        }
        if(!isDirty&&!pendingUploads.size){toast('没有需要保存的更改','info');return;}
        var btn=$('#saveBtn');btn.disabled=true;btn.textContent='[WAIT] 保存中...';
        try{
            var branchPath=config.branch.split('/').map(encodeURIComponent).join('/');
            var ref=await githubRequest('/git/ref/heads/'+branchPath);
            var headSha=ref.object.sha;
            var headCommit=await githubRequest('/git/commits/'+headSha);
            var treeItems=[];
            var uploads=Array.from(pendingUploads.entries());
            for(var i=0;i<uploads.length;i++){
                btn.textContent='[UP] 图片 '+(i+1)+'/'+uploads.length;
                var path=uploads[i][0],file=uploads[i][1].file;
                var imageBlob=await githubRequest('/git/blobs',{
                    method:'POST',
                    body:JSON.stringify({content:await fileToBase64(file),encoding:'base64'})
                });
                treeItems.push({path:path,mode:'100644',type:'blob',sha:imageBlob.sha});
            }
            btn.textContent='[WRITE] 写入内容...';
            var data={navigation:siteNav,contact:siteContact,content:siteContent,welcome:siteWelcome};
            var json=JSON.stringify(data,null,4);
            var contentBlob=await githubRequest('/git/blobs',{
                method:'POST',
                body:JSON.stringify({content:utf8ToBase64(json),encoding:'base64'})
            });
            treeItems.push({path:'data/content.json',mode:'100644',type:'blob',sha:contentBlob.sha});
            var tree=await githubRequest('/git/trees',{
                method:'POST',
                body:JSON.stringify({base_tree:headCommit.tree.sha,tree:treeItems})
            });
            var commit=await githubRequest('/git/commits',{
                method:'POST',
                body:JSON.stringify({
                    message:uploads.length?'后台更新内容并上传 '+uploads.length+' 张图片':'后台编辑更新',
                    tree:tree.sha,
                    parents:[headSha]
                })
            });
            await githubRequest('/git/refs/heads/'+branchPath,{
                method:'PATCH',
                body:JSON.stringify({sha:commit.sha,force:false})
            });
            contentSha=contentBlob.sha;
            clearAllPendingUploads();
            isDirty=false;updateStatus();
            toast('保存成功！内容与图片已在同一次提交中上传','success');
        }catch(e){toast('保存失败: '+e.message,'error');}
        btn.disabled=false;btn.textContent='[SAVE] 保存到 GitHub';
    }

    async function githubRequest(path,options){
        options=options||{};
        var response=await fetch('https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repo)+path,{
            method:options.method||'GET',
            headers:{
                'Authorization':'Bearer '+config.token,
                'Accept':'application/vnd.github+json',
                'Content-Type':'application/json',
                'X-GitHub-Api-Version':'2022-11-28'
            },
            body:options.body
        });
        if(!response.ok){
            var detail={};
            try{detail=await response.json();}catch(ignore){}
            if(response.status===409||response.status===422)throw new Error('远端内容已变化，请重新加载后再保存');
            throw new Error(detail.message||('GitHub API '+response.status));
        }
        return response.status===204?{}:response.json();
    }

    function fileToBase64(file){
        return new Promise(function(resolve,reject){
            var reader=new FileReader();
            reader.onload=function(){resolve(String(reader.result).split(',')[1]||'');};
            reader.onerror=function(){reject(new Error('读取图片失败: '+file.name));};
            reader.readAsDataURL(file);
        });
    }

    function utf8ToBase64(text){
        var bytes=new TextEncoder().encode(text);
        var binary='',chunk=0x8000;
        for(var i=0;i<bytes.length;i+=chunk){
            binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
        }
        return btoa(binary);
    }

    function downloadContent(){
        var data={navigation:siteNav,contact:siteContact,content:siteContent,welcome:siteWelcome};
        var json=JSON.stringify(data,null,4);
        var blob=new Blob([json],{type:'application/json'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');a.href=url;a.download='content.json';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }

    async function reloadData(){
        if(isDirty&&!confirm('有未保存更改, 重新加载将丢失。确定?'))return;
        try{
            if(config.token){
                var url='https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json?ref='+config.branch;
                var r=await fetch(url,{headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json'}});
                if(!r.ok)throw new Error('HTTP '+r.status);
                var f=await r.json();contentSha=f.sha;
                var rawText=decodeURIComponent(escape(atob(f.content)));
                parseData(JSON.parse(rawText));
            }else{var r=await fetch('data/content.json');parseData(await r.json());}
            renderNav();showWelcome();toast('已重新加载','success');
        }catch(e){toast(e.message,'error');}
    }

    function markDirty(){isDirty=true;updateStatus();}
    function updateStatus(){
        var s=$('#adminStatus');if(!s)return;
        s.textContent=isDirty?('未保存'+(pendingUploads.size?' · 图片 '+pendingUploads.size:'')):'已保存';
        s.style.color=isDirty?'var(--warning)':'';
    }

    function toast(msg,type){
        var el=document.createElement('div');el.className='toast '+(type||'info');
        el.textContent=msg;document.getElementById('toastContainer').appendChild(el);
        setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(40px)';setTimeout(function(){el.remove();},300);},3000);
    }
    function showError(msg){var el=$('#setupError');el.textContent=msg;el.style.display='block';}
    function normalizeIconCode(value,id){
        var clean=String(value||'').toUpperCase().replace(/[^A-Z0-9@]/g,'').slice(0,3);
        return clean||PIXEL_ICONS[id]||String(id||'UI').replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase()||'UI';
    }
    function pixelIconCode(id,fallback){return normalizeIconCode(fallback,id);}
    function pixelIconMarkup(id,fallback){
        return '<span class="pixel-icon" aria-hidden="true">'+esc(pixelIconCode(id,fallback))+'</span>';
    }
    function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

    // ── 语言切换 ──
    function setupAdminLangToggle(){
        var toggle=$('#adminLangToggle');
        if(!toggle)return;
        toggle.onclick=function(e){
            var opt=e.target.closest('.lang-option');
            if(!opt)return;
            var lang=opt.dataset.lang;
            if(lang===currentLang)return;
            currentLang=lang;
            var opts=toggle.querySelectorAll('.lang-option');
            for(var i=0;i<opts.length;i++)opts[i].classList.toggle('active',opts[i].dataset.lang===lang);
            // 重新渲染导航和当前页面
            renderNav();
            updateWelcomeText();
            if(currentCategory!==null&&siteNav[currentCategory]){
                var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
                if(sub)showCatPage(cat,sub);
            }
            showContact();
            toast('已切换到'+(lang==='zh'?'中文':'English'),'info');
        };
    }

    function closeMenu(){var s=$('#sidebar'),t=$('#menuToggle');if(s)s.classList.remove('open');if(t)t.classList.remove('active');}
    document.addEventListener('click',function(e){
        var t=$('#menuToggle'),s=$('#sidebar');if(!t||!s)return;
        if(e.target.closest('#menuToggle')){t.classList.toggle('active');s.classList.toggle('open');return;}
        if(window.innerWidth<=768&&s.classList.contains('open')&&!s.contains(e.target)&&!t.contains(e.target))closeMenu();
    });

    window.addEventListener('beforeunload',function(e){if(isDirty){e.preventDefault();e.returnValue='有未保存更改';}});
    document.addEventListener('DOMContentLoaded',init);
})();
