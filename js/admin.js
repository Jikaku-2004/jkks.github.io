/**
 * admin.js - JKK 绠＄悊鍚庡彴锛堥暅鍍忓叕寮€缃戦〉甯冨眬 + 鍏ㄥ唴鑱旂紪杈戯級
 */

(function() {
    'use strict';
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    let config = {};
    let siteNav = [], siteContact = {}, siteContent = {};
    let currentLang = 'zh', currentCategory = null, currentSubcategory = null;
    let contentSha = null, isDirty = false, editingEntry = null, editingSubId = null, editingCatIdx = null;

    const WELCOME_FIELDS = {
        welcomeTitle: { zh: '娆㈣繋鏉ュ埌 JKK 鐨勪釜浜虹綉椤?, en: "Welcome to JKK's Personal Page" },
        welcomeSubtitle: { zh: '鎺㈢储 路 鎬濊€?路 璁板綍', en: 'Explore 路 Think 路 Record' },
        welcomeDesc: { zh: '<p>杩欓噷鏄垜璁板綍闃呰銆佽壓鏈€佽繍鍔ㄤ笌鐮旂┒鐨勪釜浜虹┖闂淬€?/p><p>璇蜂粠宸︿晶瀵艰埅鏍忛€夋嫨鎰熷叴瓒ｇ殑鍒嗙被寮€濮嬫帰绱€?/p>', en: '<p>A personal space for recording reading, art, sports, and research.</p><p>Choose a category from the sidebar to start exploring.</p>' },
        welcomeQuote: { zh: '&ldquo;浜虹敓杩樹笉濡備竴琛屾尝寰疯幈灏斻€?rdquo; 鈥斺€?鑺ュ窛榫欎箣浠?, en: '&ldquo;Life is not worth a line of Baudelaire.&rdquo; &mdash; Ryunosuke Akutagawa' }
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
            window._textCb = val => { WELCOME_FIELDS[key][currentLang] = val; updateWelcomeText(); markDirty(); toast('宸叉洿鏂?,'success'); };
            openTextEditor('缂栬緫: '+key, WELCOME_FIELDS[key][currentLang]);
        });
        // 璇█鍒囨崲
        setupAdminLangToggle();
        if (config.owner && config.repo && config.token) connectRepo();
    }

    async function connectRepo() {
        config = { owner:$('#setupOwner').value.trim(), repo:$('#setupRepo').value.trim(),
            token:$('#setupToken').value.trim(), branch:$('#setupBranch').value.trim()||'main' };
        if (!config.owner||!config.repo||!config.token) return showError('璇峰～鍐欏畬鏁翠俊鎭?);
        localStorage.setItem('jkk_admin_config', JSON.stringify(config));
        const btn=$('#setupBtn'); btn.disabled=true; btn.textContent='杩炴帴涓?..';
        try {
            const url='https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json?ref='+config.branch;
            const r=await fetch(url,{headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json'}});
            if(!r.ok) throw new Error('HTTP '+r.status);
            const f=await r.json(); contentSha=f.sha;
            var rawText=decodeURIComponent(escape(atob(f.content)));
            parseData(JSON.parse(rawText));
            enterApp(); toast('宸茶繛鎺?,'success');
        } catch(e) {
            const m=e.message||'';
            if(m.includes('401')) showError('Token鏃犳晥');
            else if(m.includes('403')) showError('Token鏉冮檺涓嶈冻');
            else if(m.includes('404')) showError('浠撳簱鎴栨枃浠朵笉瀛樺湪');
            else showError(m);
        }
        btn.disabled=false; btn.textContent='杩炴帴浠撳簱';
    }

    async function enterManualMode() {
        const btn=$('#manualModeBtn'); btn.textContent='鍔犺浇涓?..';
        try {
            const r=await fetch('data/content.json'); if(!r.ok) throw new Error('HTTP '+r.status);
            parseData(await r.json()); contentSha=null; config={};
            enterApp(); toast('宸插姞杞?,'success');
        } catch(e) { showError(e.message); }
        btn.textContent='鎵嬪姩妯″紡';
    }

    function parseData(raw) {
        siteNav=raw.navigation||[]; siteContact=raw.contact||{}; siteContent=raw.content||raw;
        if(Object.keys(siteContent).length===0&&!raw.navigation) siteContent=raw;
        isDirty=false; updateStatus();
    }

    function enterApp() {
        $('#setupScreen').style.display='none';
        $('#adminTopBar').style.display=''; $('#adminLayout').style.display='';
        $('#repoBadge').textContent=config.owner?config.owner+'/'+config.repo:'鎵嬪姩';
        renderNav(); showWelcome();
    }

    function renderNav() {
        const list=$('#navList'); list.innerHTML='';
        siteNav.forEach(function(cat,ci){
            var li=document.createElement('li');
            var item=document.createElement('div');
            item.className='nav-item'; item.dataset.ci=ci;
            var cl=cat.label?(cat.label[currentLang]||cat.label.zh||cat.id):cat.id;
            item.innerHTML='<span class="nav-icon">'+(cat.icon||'')+'</span><span class="nav-label">'+esc(cl)+'</span><span class="nav-arrow">\u25B6</span>'+
                '<button class="nav-del" data-ci="'+ci+'" title="鍒犻櫎">\u2715</button>';
            item.onclick=function(){toggleCat(ci);};
            li.appendChild(item);
            if(cat.subItems&&cat.subItems.length>0){
                var ul=document.createElement('ul'); ul.className='sub-nav'; ul.id='sub-'+ci;
                cat.subItems.forEach(function(sub,si){
                    var sli=document.createElement('li');
                    var sel=document.createElement('div');
                    sel.className='sub-nav-item'; sel.dataset.ci=ci; sel.dataset.si=si;
                    var sl=sub.label?(sub.label[currentLang]||sub.label.zh||sub.id):sub.id;
                    sel.innerHTML='<span>'+esc(sl)+'</span>';
                    sel.onclick=function(e){e.stopPropagation();selectSub(ci,si);};
                    sli.appendChild(sel); ul.appendChild(sli);
                });
                li.appendChild(ul);
            }
            list.appendChild(li);
        });
        var ali=document.createElement('li');
        ali.style.padding='10px 20px';
        ali.innerHTML='<button class="admin-btn admin-btn-sm admin-btn-accent" id="addCatBtn" style="width:100%">+ 娣诲姞鏂板ぇ绫?/button>';
        list.appendChild(ali);
        document.getElementById('addCatBtn').onclick=addNewCategory;
        var dels=document.querySelectorAll('.nav-del');
        for(var i=0;i<dels.length;i++){(function(d){d.onclick=function(e){e.stopPropagation();
            if(confirm('鍒犻櫎姝ゅぇ绫?')){siteNav.splice(parseInt(d.dataset.ci),1);renderNav();showWelcome();markDirty();toast('宸插垹闄?,'info');}
        };})(dels[i]);}
    }

    function toggleCat(ci) {
        var s=document.getElementById('sub-'+ci); if(!s){selectSub(ci,0);return;}
        var isOpening=!s.classList.contains('open');
        var opens=document.querySelectorAll('.sub-nav.open');
        for(var i=0;i<opens.length;i++){if(opens[i].id!=='sub-'+ci)opens[i].classList.remove('open');}
        s.classList.toggle('open');
        var item=document.querySelector('.nav-item[data-ci="'+ci+'"]');
        if(item)item.classList.toggle('expanded');
        // 灞曞紑鏃惰嚜鍔ㄩ€変腑绗竴涓瓙绫?
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
            c.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-secondary)"><p>鏆傛棤鏉＄洰</p><button class="admin-btn admin-btn-accent" onclick="document.getElementById(\'addEntryBtn\').click()">+ 娣诲姞鏂版潯鐩?/button></div>';
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
                '<button class="entry-edit-btn" title="缂栬緫">\u270E</button>'+
                '<button class="entry-del-btn" title="鍒犻櫎">\uD83D\uDDD1</button></div>'+

                '<div class="entry-tags">'+tags.map(function(t){return'<span class="entry-tag">'+esc(t)+'</span>';}).join('')+'</div>'+
                '<div class="entry-body"><p>'+esc((body||'').substring(0,200))+((body||'').length>200?'...':'')+'</p></div>';
            c.appendChild(card);
            var editBtns=card.querySelectorAll('.entry-edit-btn');
            editBtns[0].onclick=function(){openEntryEditor(subId,entry);};
            var delBtns=card.querySelectorAll('.entry-del-btn');
            delBtns[0].onclick=function(){
                if(confirm('鍒犻櫎?')){var a=siteContent[subId]||[];var i=a.findIndex(function(e){return e.id===entry.id;});if(i>=0)a.splice(i,1);renderEntries(subId);markDirty();toast('宸插垹闄?,'info');}
            };
        });
    }

    function showWelcome(){hidePages();$('#welcomePage').style.display='';currentCategory=null;updateWelcomeText();}
    function updateWelcomeText(){
        var lang=currentLang;
        Object.keys(WELCOME_FIELDS).forEach(function(k){
            var b=document.querySelector('.editable-block[data-key="'+k+'"]'); if(!b)return;
            var el=b.querySelector('.welcome-title,.welcome-subtitle,.welcome-desc,.welcome-quote');
            if(el) el.innerHTML=WELCOME_FIELDS[k][lang];
        });
    }

    function showContact(){
        hidePages();$('#contactPage').style.display='';
        var lang=currentLang;
        var title=lang==='zh'?'鑱旂郴鏂瑰紡':'Contact';
        var desc=lang==='zh'?'娆㈣繋閫氳繃浠ヤ笅鏂瑰紡涓庢垜鑱旂郴':'Feel free to reach out to me';
        var c=Object.keys(siteContact).length>0?siteContact:{email:{label:{zh:'閭',en:'Email'},value:'jkk@example.com',icon:'\u2709'}};
        var h='<div class="contact-card"><h2 class="contact-title">'+title+'</h2><p style="color:var(--text-secondary);margin-bottom:24px;">'+desc+'</p>';
        var vals=Object.values(c);
        vals.forEach(function(i){
            var lb=i.label?i.label[currentLang]||'':'';
            h+='<div class="contact-item"><span class="contact-icon">'+(i.icon||'')+'</span><span class="contact-label">'+esc(lb)+'</span><span class="contact-value">'+esc(i.value)+'</span></div>';
        });
        h+='</div>'; $('#contactPage').innerHTML=h;
    }

    function hidePages(){['welcomePage','categoryPage','contactPage'].forEach(function(id){$('#'+id).style.display='none';});}

    function openTextEditor(title,val){$('#textEditorTitle').textContent=title;$('#textEditorInput').value=val;$('#textEditorModal').style.display='flex';}
    function closeTextEditor(){$('#textEditorModal').style.display='none';window._textCb=null;}

    function openEntryEditor(subId,entry){
        editingSubId=subId; editingEntry=entry;
        var isZh=currentLang==='zh';
        $('#entryModalTitle').textContent='Edit: '+(entry.title_zh||entry.title_en||entry.id);
        $('#entryModalBody').innerHTML=
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'涓枃鏍囬':'Title')+' *</label><input type="text" id="eeZh" value="'+esc(entry.title_zh||'')+'"></div>'+
            '<div class="editor-field"><label>'+(isZh?'鑻辨枃鏍囬':'English Title')+' *</label><input type="text" id="eeEn" value="'+esc(entry.title_en||'')+'"></div></div>'+
            '<div class="editor-row"><div class="editor-field"><label>鏃ユ湡</label><input type="date" id="eeDate" value="'+(entry.date||'')+'"></div>'+
            '<div class="editor-field"><label>ID</label><input type="text" id="eeId" value="'+esc(entry.id||'')+'"></div></div>'+
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'涓枃鏍囩':'Chinese Tags')+'</label><input type="text" id="eeTagsZh" value="'+esc((entry.tags_zh||[]).join(', '))+'"></div>'+
            '<div class="editor-field"><label>'+(isZh?'鑻辨枃鏍囩':'English Tags')+'</label><input type="text" id="eeTagsEn" value="'+esc((entry.tags_en||[]).join(', '))+'"></div></div>'+
            '<div class="editor-field"><label>'+(isZh?'涓枃鍐呭 (Markdown)':'Chinese Content')+'</label><textarea id="eeContentZh" rows="4">'+esc(entry.content_zh||'')+'</textarea></div>'+
            '<div class="editor-field"><label>'+(isZh?'鑻辨枃鍐呭':'English Content (Markdown)')+'</label><textarea id="eeContentEn" rows="4">'+esc(entry.content_en||'')+'</textarea></div>'+
            '<div class="editor-row"><div class="editor-field"><label>'+(isZh?'鍥剧墖璺緞':'Images')+'</label><textarea id="eeImages" rows="2">'+esc((entry.images||[]).join('\n'))+'</textarea></div>'+
            '<div class="editor-field"><label>'+(isZh?'閾炬帴 (鏂囧瓧,缃戝潃)':'Links')+'</label><textarea id="eeLinks" rows="2">'+esc((entry.links||[]).map(function(l){return l.text+','+l.url;}).join('\n'))+'</textarea></div>'+
            '<div class="editor-field"><label>'+(isZh?'瑙嗛閾炬帴':'Videos')+'</label><textarea id="eeVideos" rows="2">'+esc((entry.videos||[]).map(function(v){return v.url;}).join('\n'))+'</textarea></div></div>';
        $('#entryModal').style.display='flex';
    }
    function closeEntryEditor(){$('#entryModal').style.display='none';editingEntry=null;}
    function saveEntry(){
        if(!editingEntry||!editingSubId)return;
        var e=editingEntry;
        e.title_zh=$('#eeZh').value.trim(); e.title_en=$('#eeEn').value.trim();
        e.date=$('#eeDate').value; e.id=$('#eeId').value.trim()||e.id;
        e.tags_zh=$('#eeTagsZh').value.split(/[,锛宂/).map(function(s){return s.trim();}).filter(Boolean);
        e.tags_en=$('#eeTagsEn').value.split(/[,锛宂/).map(function(s){return s.trim();}).filter(Boolean);
        e.content_zh=$('#eeContentZh').value.trim(); e.content_en=$('#eeContentEn').value.trim();
        e.images=$('#eeImages').value.split('\n').map(function(s){return s.trim();}).filter(Boolean);
        e.links=$('#eeLinks').value.split('\n').map(function(s){var p=s.split(/[,锛宂/);return p.length>=2?{url:p[1].trim(),text:p[0].trim()}:null;}).filter(Boolean);
        e.videos=$('#eeVideos').value.split('\n').map(function(s){var u=s.trim();return u?{url:u,platform:u.includes('bilibili')?'bilibili':'youtube'}:null;}).filter(Boolean);
        closeEntryEditor();
        var arr=siteContent[editingSubId]||[];
        var i=arr.findIndex(function(x){return x.id===e.id;});
        if(i>=0)arr[i]=e;else arr.push(e);
        siteContent[editingSubId]=arr;
        if(currentCategory!==null&&siteNav[currentCategory]){
            var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
            if(sub)showCatPage(cat,sub);
        }
        markDirty();toast('宸蹭繚瀛?,'success');
    }
    function deleteEntry(){
        if(!editingEntry||!editingSubId||!confirm('鍒犻櫎?'))return;
        var arr=siteContent[editingSubId]||[];
        var i=arr.findIndex(function(e){return e.id===editingEntry.id;});
        if(i>=0)arr.splice(i,1);
        closeEntryEditor();
        if(currentCategory!==null&&siteNav[currentCategory]){
            var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
            if(sub)showCatPage(cat,sub);
        }
        markDirty();toast('宸插垹闄?,'info');
    }

    function addNewEntry(){
        if(currentCategory===null)return toast('璇峰厛閫夋嫨鍒嗙被','error');
        var cat=siteNav[currentCategory]; if(!cat||!cat.subItems||currentSubcategory===null)return toast('璇峰厛閫夋嫨瀛愮被','error');
        var sub=cat.subItems[currentSubcategory];
        var entry={id:'new-'+Date.now(),title_zh:'',title_en:'',date:new Date().toISOString().split('T')[0],tags_zh:[],tags_en:[],content_zh:'',content_en:'',images:[],videos:[],links:[]};
        var arr=siteContent[sub.id]||[];arr.push(entry);siteContent[sub.id]=arr;
        openEntryEditor(sub.id,entry);markDirty();
    }

    function openCatEditor(ci){
        var cat=siteNav[ci]; if(!cat)return;
        editingCatIdx=ci; var d=cat.desc||{};
        $('#catModalTitle').textContent='缂栬緫澶х被';
        $('#catModalBody').innerHTML=
            '<div class="editor-field"><label>澶х被 ID</label><input type="text" id="ceId" value="'+esc(cat.id)+'"></div>'+
            '<div class="editor-row"><div class="editor-field"><label>涓枃鍚嶇О</label><input type="text" id="ceZh" value="'+esc(cat.label?cat.label.zh:'')+'"></div>'+
            '<div class="editor-field"><label>English</label><input type="text" id="ceEn" value="'+esc(cat.label?cat.label.en:'')+'"></div></div>'+
            '<div class="editor-field"><label>鍥炬爣 Emoji</label><input type="text" id="ceIcon" value="'+esc(cat.icon||'')+'"></div>'+
            '<div class="editor-field"><label>涓枃鎻忚堪</label><textarea id="ceDescZh" rows="2">'+esc(d.zh||'')+'</textarea></div>'+
            '<div class="editor-field"><label>English Description</label><textarea id="ceDescEn" rows="2">'+esc(d.en||'')+'</textarea></div>';
        $('#catModal').style.display='flex';
    }
    function closeCatEditor(){editingCatIdx=null;$('#catModal').style.display='none';}
    function saveCategory(){
        if(editingCatIdx===null)return;
        var cat=siteNav[editingCatIdx];
        cat.id=$('#ceId').value.trim()||cat.id;
        cat.label={zh:$('#ceZh').value.trim(),en:$('#ceEn').value.trim()};
        cat.icon=$('#ceIcon').value.trim()||'';
        cat.desc={zh:$('#ceDescZh').value.trim(),en:$('#ceDescEn').value.trim()};
        closeCatEditor();renderNav();
        if(currentCategory!==null&&siteNav[currentCategory]){
            var c=siteNav[currentCategory];var s=c.subItems?c.subItems[currentSubcategory||0]:null;
            if(s)showCatPage(c,s);
        }
        markDirty();toast('宸叉洿鏂?,'success');
    }
    function deleteCategory(){
        if(editingCatIdx===null||!confirm('鍒犻櫎姝ゅぇ绫?'))return;
        siteNav.splice(editingCatIdx,1);closeCatEditor();renderNav();showWelcome();
        markDirty();toast('宸插垹闄?,'info');
    }

    function addNewCategory(){
        var id=prompt('澶х被ID (濡?travel):');if(!id)return;
        var zh=prompt('涓枃鍚嶇О (濡?鏃呰):');if(!zh)return;
        var en=prompt('English name:');if(!en)return;
        var icon=prompt('鍥炬爣 Emoji:','');
        siteNav.push({id:id,icon:icon||'',label:{zh:zh,en:en},desc:{zh:'',en:''},subItems:[]});
        renderNav();markDirty();toast('宸叉坊鍔? 璁板緱娣诲姞瀛愮被','success');
    }

    function manageSubcategories(){
        if(currentCategory===null)return;
        var cat=siteNav[currentCategory];if(!cat)return;
        $('#subModalTitle').textContent='绠＄悊瀛愮被: '+(cat.label?cat.label.zh:cat.id);
        var h='<p style="margin-bottom:12px;color:var(--text-secondary);font-size:0.9rem;">鐐瑰嚮鍒犻櫎, 搴曢儴娣诲姞鏂板瓙绫?/p>';
        (cat.subItems||[]).forEach(function(sub,si){
            h+='<div style="display:flex;align-items:center;padding:8px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;">'+
                '<span style="flex:1">'+esc(sub.label?sub.label.zh:sub.id)+'</span>'+
                '<button class="admin-btn admin-btn-sm admin-btn-danger sub-del" data-si="'+si+'">鍒犻櫎</button></div>';
        });
        h+='<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">'+
            '<h4 style="margin-bottom:8px;font-size:0.9rem;">娣诲姞鏂板瓙绫?/h4>'+
            '<div class="editor-field"><label>瀛愮被 ID</label><input type="text" id="nsId" placeholder="places"></div>'+
            '<div class="editor-row"><div class="editor-field"><label>涓枃鍚嶇О</label><input type="text" id="nsZh" placeholder="鍘昏繃鐨勫湴鏂?></div>'+
            '<div class="editor-field"><label>English</label><input type="text" id="nsEn" placeholder="Places"></div></div>'+
            '<button class="admin-btn admin-btn-accent admin-btn-sm" id="nsAddBtn">+ 娣诲姞</button></div>';
        $('#subModalBody').innerHTML=h;$('#subModal').style.display='flex';
        var dels=$('#subModalBody').querySelectorAll('.sub-del');
        for(var i=0;i<dels.length;i++){(function(d){d.onclick=function(){
            var si=parseInt(d.dataset.si);if(confirm('鍒犻櫎?')){cat.subItems.splice(si,1);manageSubcategories();renderNav();markDirty();toast('宸插垹闄?,'info');}
        };})(dels[i]);}
        document.getElementById('nsAddBtn').onclick=function(){
            var id=document.getElementById('nsId').value.trim();
            var zh=document.getElementById('nsZh').value.trim();
            var en=document.getElementById('nsEn').value.trim();
            if(!id||!zh)return toast('璇峰～鍐欏瓙绫籌D鍜屽悕绉?,'error');
            if(!cat.subItems)cat.subItems=[];
            cat.subItems.push({id:id,label:{zh:zh,en:en||zh}});
            if(!siteContent[id])siteContent[id]=[];
            manageSubcategories();renderNav();markDirty();toast('宸叉坊鍔?,'success');
        };
    }
    function closeSubEditor(){document.getElementById('subModal').style.display='none';}

    async function saveToGitHub(){
        if(!config.token){downloadContent();toast('鎵嬪姩妯″紡: 宸蹭笅杞?,'info');return;}
        var btn=$('#saveBtn');btn.disabled=true;btn.textContent='淇濆瓨涓?..';
        try{
            var url='https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json?ref='+config.branch;
            var cr=await fetch(url,{headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json'}});
            var sha=contentSha;
            if(cr.ok){var l=await cr.json();sha=l.sha;}
            var data={navigation:siteNav,contact:siteContact,content:siteContent};
            var json=JSON.stringify(data,null,4);
            var enc=btoa(unescape(encodeURIComponent(json)));
            var pr=await fetch('https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json',{
                method:'PUT',
                headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'},
                body:JSON.stringify({message:'鍚庡彴缂栬緫鏇存柊',content:enc,sha:sha||undefined,branch:config.branch})
            });
            if(!pr.ok){var ed={};try{ed=await pr.json();}catch(e){}throw new Error(ed.message||'HTTP '+pr.status);}
            var res=await pr.json();contentSha=res.content.sha;
            isDirty=false;updateStatus();
            toast('淇濆瓨鎴愬姛! 1-2鍒嗛挓鍚庢洿鏂?,'success');
        }catch(e){toast('淇濆瓨澶辫触: '+e.message,'error');}
        btn.disabled=false;btn.textContent='淇濆瓨鍒?GitHub';
    }

    function downloadContent(){
        var data={navigation:siteNav,contact:siteContact,content:siteContent};
        var json=JSON.stringify(data,null,4);
        var blob=new Blob([json],{type:'application/json'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');a.href=url;a.download='content.json';
        document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }

    async function reloadData(){
        if(isDirty&&!confirm('鏈夋湭淇濆瓨鏇存敼, 閲嶆柊鍔犺浇灏嗕涪澶便€傜‘瀹?'))return;
        try{
            if(config.token){
                var url='https://api.github.com/repos/'+config.owner+'/'+config.repo+'/contents/data/content.json?ref='+config.branch;
                var r=await fetch(url,{headers:{'Authorization':'token '+config.token,'Accept':'application/vnd.github.v3+json'}});
                if(!r.ok)throw new Error('HTTP '+r.status);
                var f=await r.json();contentSha=f.sha;
                var rawText=decodeURIComponent(escape(atob(f.content)));
                parseData(JSON.parse(rawText));
            }else{var r=await fetch('data/content.json');parseData(await r.json());}
            renderNav();showWelcome();toast('宸查噸鏂板姞杞?,'success');
        }catch(e){toast(e.message,'error');}
    }

    function markDirty(){isDirty=true;updateStatus();}
    function updateStatus(){var s=$('#adminStatus');if(!s)return;s.textContent=isDirty?'鏈繚瀛?:'宸蹭繚瀛?;s.style.color=isDirty?'#ff9800':'';}

    function toast(msg,type){
        var el=document.createElement('div');el.className='toast '+(type||'info');
        el.textContent=msg;document.getElementById('toastContainer').appendChild(el);
        setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(40px)';setTimeout(function(){el.remove();},300);},3000);
    }
    function showError(msg){var el=$('#setupError');el.textContent=msg;el.style.display='block';}
    function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

    // 鈹€鈹€ 璇█鍒囨崲 鈹€鈹€
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
            // 閲嶆柊娓叉煋瀵艰埅鍜屽綋鍓嶉〉闈?
            renderNav();
            updateWelcomeText();
            if(currentCategory!==null&&siteNav[currentCategory]){
                var cat=siteNav[currentCategory];var sub=cat.subItems?cat.subItems[currentSubcategory||0]:null;
                if(sub)showCatPage(cat,sub);
            }
            showContact();
            toast('宸插垏鎹㈠埌'+(lang==='zh'?'涓枃':'English'),'info');
        };
    }

    function closeMenu(){var s=$('#sidebar'),t=$('#menuToggle');if(s)s.classList.remove('open');if(t)t.classList.remove('active');}
    document.addEventListener('click',function(e){
        var t=$('#menuToggle'),s=$('#sidebar');if(!t||!s)return;
        if(e.target.closest('#menuToggle')){t.classList.toggle('active');s.classList.toggle('open');return;}
        if(window.innerWidth<=768&&s.classList.contains('open')&&!s.contains(e.target)&&!t.contains(e.target))closeMenu();
    });

    window.addEventListener('beforeunload',function(e){if(isDirty){e.preventDefault();e.returnValue='鏈夋湭淇濆瓨鏇存敼';}});
    document.addEventListener('DOMContentLoaded',init);
})();
