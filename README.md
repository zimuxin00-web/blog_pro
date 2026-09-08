# 星屑旅店 · 个人博客

基于 **Hexo 7** + **hexo-theme-anzhiyu（安知鱼）** 的个人博客。特性：

- 🎵 **音乐馆** `/music`：网易云歌单，桌面网页版 + 手机全屏播放器
- 📅 **侧边栏「时光问候」卡片**：日历 / 实时时钟 / 节假日调休 / 按时段问候 / 访问者 IP 归属地
- 🎌 星屑粒子动态背景（可选切视频）+ 移动端独立 App 感设计（底部 Tab 栏）
- 📱 手机 / 电脑全兼容，桌面与移动端各自独立布局
- 🤖 文章访问量、搜索、RSS、Sitemap、评论系统

---

## 目录结构

```
myblog/
├── _config.yml           # Hexo 主配置（站点名、URL、语言）
├── _config.anzhiyu.yml   # 安知鱼主题配置（注入自定义 CSS/JS、菜单、卡片开关）
├── build.js              # 构建脚本（绕过 hexo-cli，服务器也用它）
├── package.json          # 依赖 + npm 脚本（build / clean / server）
├── scaffolds/            # 新文章模板
├── source/
│   ├── _posts/           # 📝 你的文章（Markdown）
│   ├── about/ music/ comments/ ...  # 独立页面
│   ├── css/  js/  img/   # 自定义样式 / 脚本 / 素材
│   └── search.xml        # 站内搜索模板
└── themes/anzhiyu/       # 安知鱼主题源码（直接提交进仓库）
```

---

## 一、博主怎么写文章 / 传图

**博主本人不需要敲命令、不需要懂 Markdown 格式。** 请直接看文档：
- 📖 `docs/服务器AI搭建需求文档.md` —— 交给**服务器 AI** 搭建（含 Qexo 网页后台、替换 Typecho）。
- 📖 `docs/文章写作与图片上传指南.md` —— 给**博主本人**看：怎么在 Qexo 后台写文章、拖图片、发布。

简单说：
- 日常优先在 **Qexo 网页后台**（`https://admin.maoniang.cloud`）里写——像 Typecho 一样图形化，图片直接拖进正文。
- 或者**直接跟电脑/手机里的 AI 讲想法**，让 AI 排版好并配图。
- 站长/维护者若要本地改：直接编辑 `source/_posts/*.md`（Front Matter 格式见 `scaffolds/post.md`），图片放与文章**同名**的文件夹，正文用标准 Markdown `![](图片名.png)` 即可（已开 `post_asset_folder` + `postAsset`），改完 `npm run build` 或提交仓库。

---

## 二、部署到你的云服务器（推荐：服务器自己拉取构建）

> 完整、带 Qexo 与 Typecho 替换的部署步骤，**以 `docs/服务器AI搭建需求文档.md` 为准**。
> 下面是核心思路：

### 1. 把仓库推到 GitHub

```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

### 2. 服务器上首次拉取 + 构建

```bash
# 装 Node（Ubuntu 示例）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 拉取并构建
cd /var/www
sudo git clone https://github.com/zimuxin00-web/blog_pro.git blog
cd blog
sudo npm install --production
sudo npm run build        # 产出 public/
```

### 3. 配置 Nginx 指向 public

`/etc/nginx/sites-available/blog`：

```nginx
server {
    listen 80;
    server_name maoniang.cloud www.maoniang.cloud;

    root /var/www/blog/public;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源长缓存
    location ~* \.(css|js|png|jpg|gif|svg|webp|woff2)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # 开启 gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. 以后发新文章

在本地写完 → `git push`，然后**服务器上**执行：

```bash
cd /var/www/blog && git pull && npm run build
```

> 嫌手动麻烦？可以加一条 **hook** 让服务器自动更新，见下文「进阶」。

---

## 三、发布前必改的配置（★ 重要）

| 文件 | 项 | 现在 | 改成 |
|---|---|---|---|
| `_config.yml` | `url` | `https://maoniang.cloud` | （你的正式域名，已配好可不动） |
| `_config.yml` | `author` | `站长` | 你的昵称 |
| `_config.yml` | `title` / `subtitle` | 星屑旅店 | 你的博客名 |
| `_config.anzhiyu.yml` | 菜单/友链/头像等 | 见文件内注释 | 按需改 |

改完重新 `npm run build`。

---

## 三、进阶（可选）

### Qexo 网页后台（博主图形化写文章/传图）
Qexo 是跑在服务器上的 Hexo 在线后台，博主在浏览器里像用 Typecho 一样写文章、拖图、发布。
**完整部署步骤（Docker + Nginx 反代 + 与仓库/自动更新衔接）见 `docs/服务器AI搭建需求文档.md` 第七节。**

### 本地图片随手方案（供本地改文时）
- 文章同名的文件夹放图 + 正文写 `![](图片名.png)`（已配置，构建自动正确）。
- 或临时外链图床，正文贴链接。

---

## 说明
- 本文含示例文章与占位内容，发布前建议替换成你自己的内容。
- 节假日数据内置的是 **2026 年国务院官方安排**，跨年后需更新 `source/js/holiday-data.js`。
