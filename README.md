# JKK 个人网页 / JKK's Personal Page

🌐 **免费静态个人网站 | Free Static Personal Website**

中英双语个人网页，基于 GitHub Pages 免费托管，全球可访问。

---

## 🚀 快速部署 (5分钟)

### 前提条件
- 一个 GitHub 账号

### 步骤

#### 1. 创建 GitHub 仓库
1. 登录 [GitHub](https://github.com)
2. 点击右上角 **"+"** → **"New repository"**
3. **Repository name** 输入：`你的用户名.github.io`
   - ⚠️ 必须填 `<你的GitHub用户名>.github.io`
   - 例如用户名是 `jkk`，就填 `jkk.github.io`
4. 设为 **Public**
5. 点击 **"Create repository"**

#### 2. 上传文件
**方法一：直接在 GitHub 网页上传**
1. 进入刚创建的仓库
2. 点击 **"Add file"** → **"Upload files"**
3. 将本文件夹内所有文件拖拽上传
4. 点击 **"Commit changes"**

**方法二：使用 Git 命令行**
```bash
# 克隆仓库
git clone https://github.com/你的用户名/你的用户名.github.io.git
# 将本文件夹所有文件复制进去
# 然后
git add .
git commit -m "初始化个人网页"
git push
```

#### 3. 启用 GitHub Pages
1. 进入仓库 → **"Settings"**
2. 左侧找到 **"Pages"**
3. **"Source"** 选择 **"Deploy from a branch"**
4. **Branch** 选择 **main**，文件夹选 **/(root)**
5. 点击 **"Save"**

#### 4. 访问
等待 1-2 分钟，访问 `https://你的用户名.github.io` ✨

> 如需自定义域名（如 `jkk.com`），在 Pages 设置中配置即可。

---

## 📝 如何更新内容

### ⭐ 推荐方式：使用页面内快速添加工具

网站右下角有一个 **"+"** 按钮，点击后打开快速添加面板：

1. 选择 **所属分类**
2. 填写 **中文标题 / 英文标题 / 日期**
3. 填写 **标签、内容（Markdown）、图片路径、链接**
4. 点击 **"生成 JSON"**
5. 点击 **"📋 复制"**
6. 打开 GitHub 仓库，进入 `data/content.json`
7. 点击 ✏️ 编辑，找到对应分类数组（如 `"books"`），粘贴新条目
8. 点击 **"Commit changes"**
9. 等 1 分钟刷新页面即可看到更新

> 💡 **或者直接在 GitHub 上编辑 `data/content.json`**，GitHub 会自动以树形结构展示 JSON，非常清晰。

### JSON 格式参考（直接编辑 content.json 时用）

在 `data/content.json` 中找到对应分类数组，添加：

```json
{
    "id": "my-new-post",
    "title_zh": "我的新文章",
    "title_en": "My New Post",
    "date": "2026-07-28",
    "tags_zh": ["标签1", "标签2"],
    "tags_en": ["Tag1", "Tag2"],
    "content_zh": "**Markdown** 内容…",
    "content_en": "**Markdown** content…",
    "images": ["images/photo.jpg"],
    "videos": [
        { "url": "https://www.bilibili.com/video/BVxxx", "platform": "bilibili" }
    ],
    "links": [
        { "url": "https://...", "text": "链接文字" }
    ]
}
```

> ⚠️ 注意 JSON 格式比 JS 严格：**key 和字符串必须用双引号**，最后一个元素**不能有逗号**。

### 添加更多分类

编辑 `js/data.js` 中的 `navigation` 数组：

```javascript
{
    id: "travel",           // 分类ID（唯一）
    icon: "TR",             // 像素图标代码（1-3 个字母）
    labelKey: "categoryTravel",  // 对应 i18n 中的键名
    subItems: [
        { id: "places", labelKey: "subPlaces" }
    ]
}
```

然后在 `js/i18n.js` 中添加翻译：

```javascript
categoryTravel: { zh: "旅行", en: "Travel" },
subPlaces: { zh: "去过的地方", en: "Places Visited" },
descTravel: { zh: "旅行记录", en: "Travel Records" },
```

---

## 📤 上传图片

### 方法一：通过管理后台上传（推荐）
1. 打开 `admin.html` 并连接 GitHub 仓库
2. 新增或编辑条目，在“本地图片”区域点击选择或直接拖入图片
3. 在编辑器中确认预览，点击“保存”
4. 点击顶部 **“保存到 GitHub”**

图片会通过 GitHub API 写入仓库的 `images/` 文件夹，条目的 `images` 数组只保存相对引用路径。图片与 `data/content.json` 会在同一次 Git 提交中生效，避免内容已经发布但图片还未上传的情况。

支持 JPG、PNG、GIF、WEBP、AVIF，单张最大 10MB。

### 方法二：直接上传到仓库
仍可在 GitHub 仓库的 `images/` 文件夹使用 **“Add file” → “Upload files”** 手动上传，然后在条目中填写相对路径，例如 `"images/photo.jpg"`。

### 方法三：使用图床工具
- 推荐 **PicGo** + 阿里云OSS/腾讯云COS（国内速度快）
- 或者使用免费图床如 **imgur**、**sm.ms**

### 方法四：社交媒体外链
大量图片可上传到 Threads/微博/Instagram，在文章里放链接即可。

---

## 🎬 嵌入视频

### Bilibili
粘贴 B 站视频链接即可，系统会自动识别：
```javascript
videos: [{ url: "https://www.bilibili.com/video/BV1GJ411x7Z7", platform: "bilibili" }]
```

### YouTube
```javascript
videos: [{ url: "https://www.youtube.com/watch?v=xxxxx", platform: "youtube" }]
```

---

## 🎨 自定义样式

编辑 `css/style.css` 中的 CSS 变量即可修改主题色：

```css
:root {
    --accent: #ff2f87;       /* 霓虹粉 */
    --cyan: #28e6db;         /* 终端青 */
    --bg-primary: #100b1b;   /* 深紫背景 */
    --bg-sidebar: #161022;   /* 侧栏颜色 */
}
```

---

## 📁 项目结构

```
jkk-personal-site/
├── index.html          # 主页面（公开网页）
├── admin.html          # 🔒 管理后台（仅你知道路径）
├── css/
│   ├── style.css       # 公开网页样式
│   └── admin.css       # 管理后台样式
├── js/
│   ├── app.js          # 公开网页逻辑
│   ├── admin.js        # 🔒 管理后台逻辑（GitHub API 读写）
│   ├── data.js         # 导航结构 & 配置
│   └── i18n.js         # 中英翻译文本
├── data/
│   └── content.json    # 📌📌📌 核心内容数据
├── images/             # 📌 上传图片到这里
└── README.md           # 本文件
```

---

## 🔒 管理后台（推荐！）

访问 `https://你的用户名.github.io/admin.html` 即可打开管理后台。

### 首次配置（1 分钟）

1. **生成 GitHub Token**
   - 打开 [GitHub Token 设置](https://github.com/settings/tokens)
   - 点击 **"Generate new token (classic)"**
   - 勾选 `public_repo` 权限（公开仓库）或 `repo`（私有仓库）
   - 点击底部 **"Generate token"**
   - **复制生成的 Token**（⚠️ 关闭页面后不会再显示）

2. **填入后台**
   - 在管理后台填入：**用户名、仓库名、Token**
   - 点击 **"连接仓库"**
   - 成功后会显示分类列表

### 使用流程

```
进入 admin.html → 选分类 → 新增/编辑条目 → 选择本地图片 → 保存条目
                                                        ↓
                                           点"保存到 GitHub"
                                                        ↓
                               内容与图片同一次提交，稍后公开网页自动更新
```

### 功能

| 功能 | 说明 |
|------|------|
| **浏览条目** | 左侧分类 → 右侧显示全部条目 |
| **新增条目** | 点击 "＋ 新增条目" → 填写内容/选择图片 → 保存条目 → 保存到 GitHub |
| **编辑条目** | 点击条目打开编辑器 → 修改 → 保存条目 → 保存到 GitHub |
| **本地图片** | 选择或拖入多张图片 → 预览/移除 → API 自动上传并保存引用 |
| **删除条目** | 悬停条目右侧 ✕ 按钮 |
| **原子保存** | 图片与内容统一通过 **"[SAVE] 保存到 GitHub"** 在一次提交中写入 |
| **未保存提醒** | 有更改未保存时，底部会显示提示条 |

---

## 💡 提示

- **⚡ 推荐用管理后台**：`admin.html` 最快捷，所见即所得
- **🔄 更新流程**：在后台编辑 → 点保存 → 等1-2分钟 → 公开网页自动更新
- **📤 图片上传**：后台可直接选择本地图片，上传后在条目中保存 `images/...` 引用
- **📱 手机编辑**：手机浏览器打开 `admin.html` 也可编辑（适配中）
- **🔒 安全性**：Token 只保存在当前浏览器；请使用最小权限 Token，不要把 Token 写入仓库
- **💰 零成本**：GitHub Pages 完全免费，自带全球 CDN

---

Made with ❤️ by JKK
