/**
 * data.js - 网站导航结构与配置
 * 
 * ═══════════════════════════════════════════════════════
 *  📝 内容数据已移至 data/content.json
 *  直接在 GitHub 上编辑 content.json 即可更新条目
 *  ═══════════════════════════════════════════════════════
 */

const SITE_DATA = {
    // 导航结构
    navigation: [
        {
            id: "reading",
            icon: "RD",
            labelKey: "categoryReading",
            subItems: [
                { id: "books", labelKey: "subBooks" },
                { id: "movies", labelKey: "subMovies" },
                { id: "tv", labelKey: "subTV" }
            ]
        },
        {
            id: "art",
            icon: "AR",
            labelKey: "categoryArt",
            subItems: [
                { id: "music", labelKey: "subMusic" },
                { id: "calligraphy", labelKey: "subCalligraphy" }
            ]
        },
        {
            id: "sports",
            icon: "SP",
            labelKey: "categorySports",
            subItems: [
                { id: "running", labelKey: "subRunning" },
                { id: "other-sports", labelKey: "subOtherSports" }
            ]
        },
        {
            id: "research",
            icon: "RS",
            labelKey: "categoryResearch",
            subItems: [
                { id: "ecology", labelKey: "subEcology" },
                { id: "sociology", labelKey: "subSociology" }
            ]
        },
        {
            id: "kappa",
            icon: "KP",
            labelKey: "categoryKappa",
            subItems: [
                { id: "journal", labelKey: "subJournal" }
            ]
        }
    ],

    // 联系方式
    contact: {
        email: {
            label_zh: "邮箱",
            label_en: "Email",
            value: "jkk@example.com",
            icon: "ML"
        }
    }
};
