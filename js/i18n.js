/**
 * i18n.js - 中英双语翻译
 * 所有静态文本的翻译在此维护
 */
const I18N = {
    siteTitle: {
        zh: "JKK 的个人网页",
        en: "JKK's Personal Page"
    },
    welcomeTitle: {
        zh: "欢迎来到 JKK 的个人网页",
        en: "Welcome to JKK's Personal Page"
    },
    welcomeSubtitle: {
        zh: "探索 · 思考 · 记录",
        en: "Explore · Think · Record"
    },
    welcomeDesc: {
        zh: "<p>这里是我记录阅读、艺术、运动与研究的个人空间。</p><p>请从左侧导航栏选择感兴趣的分类开始探索。</p>",
        en: "<p>A personal space for recording reading, art, sports, and research.</p><p>Choose a category from the sidebar to start exploring.</p>"
    },
    welcomeQuote: {
        zh: "\"人生还不如一行波德莱尔。\" —— 芥川龙之介",
        en: "\"Life is not worth a line of Baudelaire.\" — Ryūnosuke Akutagawa"
    },
    contact: {
        zh: "联系方式",
        en: "Contact"
    },
    contactTitle: {
        zh: "联系方式",
        en: "Contact Information"
    },
    contactDesc: {
        zh: "欢迎通过以下方式与我联系",
        en: "Feel free to reach out to me"
    },
    footerText: {
        zh: "© 2026 JKK. 用 ❤️ 打造",
        en: "© 2026 JKK. Made with ❤️"
    },
    navContact: {
        zh: "联系方式",
        en: "Contact"
    },
    // 分类名称 - 用于导航
    categoryReading: { zh: "阅读", en: "Reading" },
    categoryArt: { zh: "艺术", en: "Art" },
    categorySports: { zh: "运动", en: "Sports" },
    categoryResearch: { zh: "研究", en: "Research" },
    categoryKappa: { zh: "河童的话", en: "Kappa's Words" },
    // 子分类
    subBooks: { zh: "阅读书目与感想", en: "Books & Thoughts" },
    subMovies: { zh: "电影", en: "Movies" },
    subTV: { zh: "其他影视作品", en: "TV & Videos" },
    subMusic: { zh: "音乐活动", en: "Music" },
    subCalligraphy: { zh: "书法习作", en: "Calligraphy" },
    subRunning: { zh: "长跑", en: "Long-distance Running" },
    subOtherSports: { zh: "其他运动", en: "Other Sports" },
    subEcology: { zh: "生态环境", en: "Ecology" },
    subSociology: { zh: "社会学", en: "Sociology" },
    subJournal: { zh: "日志感想", en: "Journal" },
    // 描述
    descReading: {
        zh: "阅读书目、电影与影视作品的记录与感想",
        en: "Books, movies, and video reviews and thoughts"
    },
    descArt: {
        zh: "音乐活动与书法习作的展示",
        en: "Music activities and calligraphy works"
    },
    descSports: {
        zh: "长跑及其他运动的记录",
        en: "Running and other sports records"
    },
    descResearch: {
        zh: "生态环境与社会学的研究进展",
        en: "Research progress in ecology and sociology"
    },
    descKappa: {
        zh: "灵感来源于芥川龙之介《侏儒的话》——日志中的零星感想",
        en: "Inspired by Akutagawa's 'The Words of a Dwarf' — scattered thoughts in journals"
    },
    // 占位
    noEntries: {
        zh: "暂无内容，敬请期待。",
        en: "No entries yet. Stay tuned."
    },
    // 快速添加工具
    quickAddTitle: {
        zh: "快速添加新条目 ✏️",
        en: "Quick Add Entry ✏️"
    },
    quickAddHint: {
        zh: "填写以下信息，然后复制生成的 JSON 代码，粘贴到 data/content.json 中对应分类数组里。",
        en: "Fill in the fields, copy the generated JSON, and paste it into the corresponding array in data/content.json."
    },
    qaCategory: {
        zh: "所属分类 *",
        en: "Category *"
    },
    qaTitleZh: {
        zh: "中文标题 *",
        en: "Chinese Title *"
    },
    qaTitleEn: {
        zh: "英文标题 *",
        en: "English Title *"
    },
    qaDate: {
        zh: "日期 *",
        en: "Date *"
    },
    qaTagsZh: {
        zh: "中文标签（逗号分隔）",
        en: "Chinese Tags (comma-separated)"
    },
    qaTagsEn: {
        zh: "英文标签（逗号分隔）",
        en: "English Tags (comma-separated)"
    },
    qaContentZh: {
        zh: "中文内容（支持 Markdown）",
        en: "Chinese Content (Markdown supported)"
    },
    qaContentEn: {
        zh: "英文内容（支持 Markdown）",
        en: "English Content (Markdown supported)"
    },
    qaImages: {
        zh: "图片路径（每行一个）",
        en: "Image paths (one per line)"
    },
    qaLinks: {
        zh: "外部链接（每行：文字,网址）",
        en: "External links (one per line: text,url)"
    },
    qaVideos: {
        zh: "视频链接（每行一个）",
        en: "Video links (one per line)"
    },
    qaGenerateBtn: {
        zh: "生成 JSON 🔄",
        en: "Generate JSON 🔄"
    },
    qaResultLabel: {
        zh: "✅ 生成的 JSON（复制后粘贴到 data/content.json）：",
        en: "✅ Generated JSON (copy & paste into data/content.json):"
    },
    qaCopyBtn: {
        zh: "📋 复制",
        en: "📋 Copy"
    },
    qaOutputHint: {
        zh: "👆 复制上面的代码，打开 GitHub 上的 data/content.json，找到对应分类数组，粘贴进去即可。",
        en: "👆 Copy the code above, open data/content.json on GitHub, find the matching category array, and paste it in."
    }
};
