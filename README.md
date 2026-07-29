# JKK 个人网页

中英双语个人网站，基于 GitHub Pages 免费托管，内置管理后台支持在线编辑与自动同步。

---

## 🚀 快速部署

### 前提
- 一个 GitHub 账号

### 1. 创建仓库
1. GitHub 右上角 **"+"** → **"New repository"**
2. Repository name 填 `你的用户名.github.io`（必须是你的 GitHub 用户名）
3. 设为 **Public**，点击 **"Create repository"**

### 2. 上传文件
**网页上传：** 仓库 → **"Add file"** → **"Upload files"** → 拖入所有文件 → **"Commit changes"**

**或 Git 上传：**
```bash
git clone https://github.com/你的用户名/你的用户名.github.io.git
# 将所有文件复制进去
git add . && git commit -m "初始化" && git push
```

### 3. 启用 Pages
仓库 → **Settings** → 左侧 **Pages** → Source: **Deploy from a branch** → Branch: `main`, `/(root)` → **Save**

### 4. 访问
等待 1–2 分钟，访问 `https://你的用户名.github.io`

---

## 🔒 管理后台

管理后台 `admin.html` 可在线编辑网站全部内容并一键同步到 GitHub。

### 首次配置
1. 访问 `https://你的用户名.github.io/admin.html`
2. [在此生成 Token](https://github.com/settings/tokens)，勾选 `public_repo`，复制
3. 在后台填入：**用户名、仓库名、Token、分支** → 点击 **"LINK"**

### 功能一览

| 功能 | 操作 |
|------|------|
| 编辑欢迎页 | 左侧「欢迎页编辑」→ 点击 `[E]` 修改标题 / 描述 / 引用 |
| 编辑联系方式 | 左侧「联系方式」→ 点击 `[E]` 修改邮箱等 |
| 管理大类 | 导航底部 `[+] 添加新大类`，支持编辑名称 / 图标 / 描述 / 删除 |
| 管理子类 | 进入大类后点击 `[+] 添加子类`，支持新增 / 编辑名称 / 删除 |
| 编辑条目 | 点击条目卡片 `EDIT`，支持标题 / 日期 / 标签 / Markdown / 图片 / 链接 / 视频 |
| 编辑播放列表 | 左侧「编辑 music-list」，可新增、删除、排序并选择音频或视频媒体类型 |
| 同步保存 | 顶部 `[SAVE] 保存到 GitHub`，所有修改一次性提交到仓库 |

> 编辑先在本地生效，点击 **SAVE** 后通过 GitHub API 提交，约 1 分钟后公开页面自动更新。

---

## 📝 数据结构

核心内容在 `data/content.json`：

```json
{
    "navigation": [ … ],
    "contact": { … },
    "welcome": { … },
    "content": {
        "books": [
            {
                "id": "my-book",
                "title_zh": "书名",
                "title_en": "Book Title",
                "date": "2026-07-29",
                "tags_zh": ["小说"],
                "tags_en": ["Fiction"],
                "content_zh": "**Markdown** 正文",
                "content_en": "**Markdown** body",
                "images": [],
                "videos": [],
                "links": []
            }
        ]
    }
}
```

> 日常内容管理建议直接使用管理后台，无需手动编辑 JSON。

---

## 🎨 自定义主题

编辑 `css/style.css` 变量：

```css
:root {
    --accent: #ff2f87;
    --cyan: #28e6db;
    --bg-primary: #100b1b;
    --bg-sidebar: #161022;
}
```

---

## 📁 项目结构

```
├── index.html          # 公开主页
├── admin.html          # 管理后台
├── css/
│   ├── style.css       # 公开页面样式
│   └── admin.css       # 管理后台样式
├── js/
│   ├── app.js          # 公开页面逻辑
│   ├── admin.js        # 管理后台逻辑（GitHub API）
│   ├── data.js         # 默认导航结构
│   └── i18n.js         # 中英翻译
├── data/
│   └── content.json    # 核心内容数据
├── images/             # 图片资源
└── fonts/              # 像素字体
```

---

## 🎬 嵌入视频

| 平台 | 格式 |
|------|------|
| Bilibili | `{ "url": "https://www.bilibili.com/video/BVxxx", "platform": "bilibili" }` |
| YouTube | `{ "url": "https://www.youtube.com/watch?v=xxx", "platform": "youtube" }` |

侧边栏音乐播放器使用 `data/music-list.json`。它支持音频文件直链，以及 MP4 / WEBM / MOV 等视频媒体文件直链；视频类型只输出声音，不显示画面。第三方视频网站的普通页面链接不用于隐藏播放。

---

## 📤 图片管理

管理后台编辑条目时，在图片区点击或拖入本地图片即可。**SAVE 时图片与内容在同一次提交中上传**，支持 JPG / PNG / GIF / WEBP / AVIF，单张 ≤ 10 MB。

---

## ⚙️ 技术栈

- 纯 HTML / CSS / JavaScript
- [marked.js](https://marked.js.org/) — Markdown 渲染
- [GitHub REST API](https://docs.github.com/en/rest) — 在线读写
- GitHub Pages — 免费托管
