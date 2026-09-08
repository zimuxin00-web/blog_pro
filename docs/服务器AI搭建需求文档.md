# 云服务器 AI 搭建需求文档（用 Hexo 博客替换现有 Typecho）

> **本文档供服务器端 AI / 运维同学阅读并执行。**
> 目标：把当前跑在 `maoniang.cloud` 上的 **Typecho 动态博客，整体替换为这个 Hexo 静态博客**，保持域名不变、访问体验更好、内容零丢失，
> **并部署一个 Qexo 网页后台，让博主像以前用 Typecho 一样在浏览器里图形化写文章、拖图、发布**（不需要懂 Markdown 格式或命令行）。
> 用户会在文档开头补一张「待你填写/确认的信息表」，AI 执行前先核对，缺的别瞎猜，问用户。

---

## 一、一句话目标

服务器上装好 **Node.js → 拉取 GitHub 代码 → 构建出静态 HTML → 用 Nginx 托管 → 域名 maoniang.cloud 通过 HTTPS 指向它**，把原 Typecho 安全下线/迁移，**再部署 Qexo 作为博客的图形化后台**，博主日常在 Qexo 网页里写文章、拖图、点发布。

---

## 二、待确认信息表（执行前请先填/确认）

| 项 | 值 | 说明 |
|---|---|---|
| 服务器系统 | ?（Ubuntu/Debian/CentOS…） | 影响安装命令 |
| 服务器公网 IP | ? | 域名 A 记录要指向它 |
| GitHub 仓库地址 | https://github.com/zimuxin00-web/blog_pro | 代码来源（若改则填新的） |
| GitHub Token（repo 权限） | ?（博主提供，**敏感勿入库**） | Qexo 读写仓库文章用 |
| 域名 | maoniang.cloud（根域名直达） | 已确认 |
| 后台访问方式 | ?（建议 `admin.maoniang.cloud` 子域 或 `/admin` 子路径） | 见「六 Qexo」 |
| 图床方案 | ?（推荐：GitHub 图床 或 腾讯云 COS/R2，见 7.3.1） | 决定博主传图是否流畅 |
| 原 Typecho 是否保留数据 | ?（建议：先备份再下线） | 见「四」 |
| 服务器是否已装 Nginx | ? | 决定装或复用 |
| 服务器是否方便装 Docker | ?（宝塔可装；无宝塔用命令行） | Qexo 用 Docker 最省心 |
| 是否用宝塔面板 | ? | 有则走面板；无则纯命令行 |
| HTTPS 证书方案 | 建议 Let's Encrypt / 宝塔自动签发 | 见「五」 |

> AI 拿到这些就能开干。若某项用户没填，**先问，不要假设**。

---

## 三、整体架构（先看懂再动手）

```
博主电脑 / 手机
   │  ①浏览器登录 Qexo 后台：写文字、拖图片、点“发布”
   ▼
Qexo（服务器上的网页后台，127.0.0.1:8000）
   │  ②把文章/图片提交到 GitHub 仓库 blog_pro
   ▼
GitHub 仓库 blog_pro
   │  ③服务器检测到新提交 → 自动 git pull + npm run build
   ▼
Nginx 托管 /var/www/blog/public   ← 纯静态 HTML（对外）
   ▲
④ 访问者 https://maoniang.cloud 看到更新后的博客
```

- 对外跑的是**纯静态站**（不需要 PHP/MySQL 给访客）。
- **Qexo 是博主专用的后台**，通过 Nginx 反代到内网端口，博主登录后一切图形化。
- 博主日常两种用法二选一或混用：**在 Qexo 里自己写**，或**把想法直接发给电脑上的 AI**，让 AI 产出初稿和图片，再进 Qexo 检查/发布。

- 这是**纯静态站**，不需要 PHP / MySQL / Typecho 运行环境。
- 原 Typecho 依赖的 Nginx+PHP 可以不再对外提供动态页面（PHP 是否保留见「四」）。
- 域名保持不变，用户无需改访问习惯。

---

## 四、Typecho 替换步骤（务必先备份，别急着删）

原站是 Typecho（PHP + 一般配 SQLite 或 MySQL）。目标不是“同一时刻删掉”，而是**先让新站能访问，再平滑切换，最后清理**。按序执行：

1. **全量备份**原站（避免任何数据损失）：
   ```bash
   # 站点文件
   sudo cp -r /www/wwwroot/原typecho目录 /backup/typecho_site_$(date +%F)
   # 数据库（若是 MySQL，用 mysqldump；若是 SQLite，直接拷 .db 文件）
   mysqldump -u 用户名 -p 数据库名 > /backup/typecho_$(date +%F).sql
   ```
   把备份目录放到服务器**另一块盘或下载到本地**，别和站点放一起。

2. **部署新 Hexo 站**到独立目录（不要覆盖原 Typecho 目录，先并行存在）：
   ```bash
   sudo mkdir -p /var/www
   cd /var/www
   sudo git clone https://github.com/zimuxin00-web/blog_pro.git blog
   cd blog
   sudo npm install --production   # 按 package.json 装依赖
   sudo npm run build              # 产出 public/（若缺少依赖会自动失败，按报错补装）
   ```

3. **Nginx 临时切到新站**验证（可先用 IP+Host 头或临时子路径验证，确认 public/index.html 能打开、图片/音乐馆/搜索都正常）。

4. **平滑切换域名**：把 Nginx 站点配置文件里 `server_name maoniang.cloud` 的 `root` 指向 `/var/www/blog/public`，`nginx -t` 通过后 `systemctl reload nginx`。此时访问域名即新站。

5. **旧内容处理（二选一，问用户）**：
   - 用户原 Typecho 文章**要留**：把旧文章的正文，由用户逐个粘贴到新站 `source/_posts/*.md`（AI 可帮转格式），新站上线后旧 URL 做 301 跳首页或对应新文章；
   - 用户**不要旧站内容**：确认备份完好后，停掉 PHP 服务与 Typecho 目录，并删除对应 Nginx server 块。

6. **清理**：确认新站稳定运行 1~2 天后，再删 Typecho 备份以外的运行目录与 PHP 站点配置。备份 /backup 保留更久。

---

## 五、Nginx + 域名 + HTTPS 配置要点

### 5.1 解析
域名 maoniang.cloud 加两条 **A 记录**（可都指向同一 IP）：
- `@` → 服务器公网 IP
- `www` → 服务器公网 IP（若想 www 也能开，否则可只留 @）

### 5.2 Nginx 站点配置（Ubuntu/Debian 示例，路径以你的发行版为准）

`/etc/nginx/sites-available/blog`：

```nginx
server {
    listen 80;
    server_name maoniang.cloud www.maoniang.cloud;

    # 静态站：直接指到 Hexo 构建产物
    root /var/www/blog/public;
    index index.html;

    # 纯静态，不需要 location 里的 fastcgi/php
    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源长缓存（提升二次访问速度）
    location ~* \.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # 开启 gzip
    gzip on;
    gzip_min_length 1k;
    gzip_types text/plain text/css application/javascript application/json application/xml image/svg+xml;
}
```

启用并测试：
```bash
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> 若原 Typecho 站点配置仍在 `sites-enabled`，**先 disable 掉**（`sudo rm /etc/nginx/sites-enabled/旧typecho站点`），避免两个 server_name 冲突。改完务必 `nginx -t`。

### 5.3 HTTPS（强烈建议，博主站必须上）
- 推荐 **Let's Encrypt**：
  ```bash
  sudo apt install -y certbot python3-certbot-nginx   # Ubuntu/Debian
  sudo certbot --nginx -d maoniang.cloud -d www.maoniang.cloud
  ```
- 或用宝塔“SSL → Let's Encrypt → 申请”自动签发并强制 HTTPS。
- 申请前确保 A 记录已生效、80 端口通。
- 让 http 自动 301 到 https。

### 5.4 防火墙 / 安全组
确保云控制台安全组放行 **80、443**（以及你 SSH 用的 22）。若原先有 PHP 相关端口且不再需要，可收紧。

---

## 六、Node 环境安装（若服务器没有）

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 建议 >= 16，本项目用 Hexo 7 建议 18/20
```

> CentOS/RHEL：用 `yum install -y nodejs npm` 或 NodeSource 对应脚本。装完确认 `npm -v` 正常。

---

## 七、Qexo 网页后台（博主写文章/传图/发布的主力，必须部署）

> **为什么装**：博主不想记 Markdown 格式、不想用命令行。Qexo 是一个开源的 Hexo 在线后台，
> 博主在**浏览器里登录**后，像以前用 Typecho 一样：新建文章 → 打字（有可视化编辑器）→ **拖拽上传图片** →
> 点发布，Qexo 自动把改动提交到 GitHub 仓库，服务器再自动重新生成网站。

### 7.1 部署方式选 Docker（最省心，数据存服务器本地，无需外部数据库）

国内服务器建议用国内镜像源。装好 Docker 后：

```bash
mkdir -p /opt/qexo
cd /opt/qexo

# 国内镜像启动 Qexo（默认 sqlite，数据落在 ./db 目录，别删）
docker run -d \
  --name qexo \
  --restart=unless-stopped \
  -v /opt/qexo/db:/app/db \
  -p 8000:8000 \
  -e TIMEOUT=600 \
  -e DOMAINS="[\"maoniang.cloud\",\"admin.maoniang.cloud\"]" \
  docker.cnb.cool/qexo/qexo:latest
```

> - 若拉不到 `docker.cnb.cool`，改用 `abudulin/qexo:latest`。
> - 国内服务器默认访问 GitHub 仓库可能慢/超时，若 Qexo 提交文章到 GitHub 经常失败，
>   可让 Qexo 改用**服务器本地仓库**（把 `/var/www/blog` 作为源），由它直接改本地源码再触发构建；
>   具体在 Qexo 后台「设置」里按官方文档配「GitHub / 本地」模式二选一。

### 7.2 Nginx 反代（不直接暴露 8000 端口）

推荐用**子域名** `admin.maoniang.cloud` 指向后台（记得加一条 A 记录到服务器 IP），并申请 HTTPS。Nginx 配置片段：

```nginx
server {
    listen 80;
    server_name admin.maoniang.cloud;
    # …(HTTPS 由 certbot/宝塔自动补)…

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 用宝塔的话：新建站点 admin.maoniang.cloud → 反向代理到 `127.0.0.1:8000` → 申请 SSL 即可。
> **不要把 8000 端口直接暴露到公网**，只允许经 Nginx/HTTPS 访问。

### 7.3 Qexo 初始化（首次打开后台域名做一次）

1. 浏览器打开 `https://admin.maoniang.cloud`，按提示初始化。
2. 填入：**Hexo 仓库** `zimuxin00-web/blog_pro`、**GitHub Token**（博主提供，需 `repo` 权限）、本地仓库路径等，按 Qexo 官方引导完成。
3. 关联到服务器源码目录 `/var/www/blog`（或让 Qexo 走 GitHub，二选一，见 7.1 说明）。
4. 发布一篇测试文章，确认能自动触发重新构建、前台能看到更新。

### 7.3.1 ★ 配置图床（否则博主的图片无法上传 / 或只显示成链接，必须做）

Qexo 里「拖图片进正文」，实际是把图**上传到外部的图床**，再在文章里插入那条**图片的网址**。
因为它是完整的 `https://…图片` 外链，Hexo 构建时原样保留 → **访客看到的是真实图片，不是文字链接**。
**这个机制跟 Hexo 的图片文件夹、长短链接都无关，所以最稳。** 前提：先把一个图床配好。

> 若不配图床，或配错：上传会失败，或正文里只有一串 `![](…)` 代码而不显示成图——这正是博主最怕的「只显示链接」。所以这步必须配通并实测。

**国内博主推荐二选一：**
- **方案 A（最简单、免费）：GitHub 图床**。另建一个**公开**仓库存图（如 `zimuxin00-web/img-bed`），
  用刚才的 GitHub Token 授权。Qexo 设置里填：仓库名、分支 `main`、保存路径（可用
  `{year}/{month}/{filename}_{md5}.{extName}` 这类占位符）、自定义域名填 `https://raw.githubusercontent.com/zimuxin00-web/img-bed/main`。
  ⚠️ 注意：`raw.githubusercontent.com` 国内访问**可能慢/被墙**，若前台图加载不出来，改用方案 B。
- **方案 B（国内访问快、更省心）：腾讯云 COS 或 CloudFlare R2**（对象存储 + CDN 域名）。
  在 Qexo 设置里选对应图床类型（如 S3/COS），填桶名、密钥、绑定好的公开访问域名 `https://images.maoniang.cloud`。
  图放云存储，访客加载快，也不占服务器空间和带宽。

**配完必须实测**：Qexo 里新建一篇，拖一张图进正文 → 保存发布 → 打开前台那篇文章，
确认**图片真的显示出来**（不是 `![](…)` 文本）。图加载慢/失败就换上面的方案 B。

### 7.4 与「自动更新」的衔接（关键）

Qexo 保存文章后把改动写进仓库/本地 → 需要**立刻重建**而不是等 cron。两种让重建跟上的办法：
- **若 Qexo 走本地仓库**：Qexo 改的就是 `/var/www/blog`，在 Qexo 后台勾选「保存后自动执行构建」或
  让服务器监听该目录文件变化后跑 `npm run build`（可让 AI 写个简单的 inotify 脚本）。
- **若 Qexo 走 GitHub**：依赖第八节「姿势 A」的 cron 每 10 分钟 pull+build 兜底（最多延迟 10 分钟），
  或用 webhook 即时触发。
> AI 部署时选一种并验证「Qexo 点发布 → 前台几分钟内更新」这条链路能通。

---

## 八、日常更新的三种方式（配好一次，以后省心）

> 博主日常**优先在 Qexo 后台操作**（最顺手）；以下 git/cron 是让服务器自动跟上的支撑，博主一般不用碰。

### 方式 1：Qexo 网页后台（博主主用，见第七节）
博主在 `admin.maoniang.cloud` 写/改/删文章、拖图、点发布即可。

### 方式 2：服务器定时自动更新（兜底，推荐也配）
建脚本 `/var/www/blog/deploy.sh`：
```bash
#!/bin/bash
cd /var/www/blog
git pull origin main
npm install --production   # 新文章一般没新依赖，但保险起见跑一下
npm run build
```
加执行权限 `chmod +x`，然后挂 cron：
```bash
crontab -e
# 加一行（每 10 分钟检查一次，有更新才重建）：
*/10 * * * * /var/www/blog/deploy.sh >> /var/www/blog/deploy.log 2>&1
```
即便 Qexo 提交慢半拍，cron 也会兜底把网站更新到最新。

### 方式 3：手动更新（应急）
```bash
cd /var/www/blog && git pull && npm run build
```

> 说明：`npm run build` 只重建静态文件、很快；博客对外没有长驻进程，**不需要** systemd/进程守护，Nginx 一直在即可。

---

## 九、项目结构说明（AI 排查时快速定位）

```
blog/  (= GitHub 仓库 blog_pro)
├── _config.yml           # Hexo 主配置：站名、url:https://maoniang.cloud、语言、插件
├── _config.anzhiyu.yml   # 主题配置：菜单/卡片/注入的自定义 CSS/JS 都在这
├── package.json          # 依赖 + npm run build/clean/server（都走 build.js）
├── build.js              # 构建入口（new Hexo().init().then(generate)）
├── source/
│   ├── _posts/           # ★ 文章（Markdown），博主日常更新就在这里
│   ├── about/ music/ categories/ tags/ comments/   # 独立页面
│   ├── css/ js/ img/     # 自定义样式/脚本/素材（问候卡片、音乐馆、粒子背景…）
│   └── search.xml        # 站内搜索模板
└── themes/anzhiyu/       # 主题源码（直接提交在仓库里，pull 即得，无需单独拉）
```

**排查要点**：若页面异常，多半是
- `_config.anzhiyu.yml` 的 `inject.head / inject.bottom` 里引用的 `/css/…` `/js/…` 是否真的存在于 `source/css|js`（不存在则 F12 看 404）；
- 构建后 `public/` 是否生成、`nginx root` 是否指对 `public`（不是 `blog` 根目录）。

---

## 十、验收清单（AI 完成后逐条勾）

- [ ] `https://maoniang.cloud` 打开是**新 Hexo 站**，首页有粒子动画背景与打字副标题
- [ ] 手机访问自适应（底部 Tab 栏、音乐馆是全屏播放器）
- [ ] 侧边栏“时光问候”卡片显示：日历 / 时钟 / 节假日 / 问候语 / 访客 IP 归属
- [ ] `/music` 音乐馆能播放、能切歌/模式
- [ ] 搜索框能搜到文章；RSS `/atom.xml`、Sitemap 可访问
- [ ] HTTP 自动跳 HTTPS，证书无告警
- [ ] **Qexo 后台**：`admin.maoniang.cloud`（或约定地址）能登录；能新建文章、点发布；发布后前台几分钟内更新（7.4 链路已通）
- [ ] **图床已配好且实测**：在 Qexo 拖一张图上传 → 发布 → 前台那篇文章里**图片真实显示（不是 `![](…)` 文字链接）**，访问者能看到图（7.3.1）
- [ ] 原 Typecho 数据已按用户选择处理完毕，且**备份存在于服务器外/独立位置**
- [ ] 静态资源 7 天长缓存已生效，gzip 已开

---

## 十一、给服务器 AI 的执行顺序建议

1. 读“信息表”，缺项先问用户（尤其要拿到 GitHub Token）。
2. 备份 Typecho（一步都不省）。
3. 装 Node → 拉代码 → `npm install && npm run build` → 确认 `public/` 有 `index.html`。
4. 配 Nginx 指向 `public`，disable 旧 Typecho server，`nginx -t && reload`。
5. 解析好域名后申请并配 HTTPS。
6. **部署 Qexo**（第七节）：装 Docker → 起 Qexo → Nginx 反代子域名/子路径 → 初始化绑仓库 → **配好图床（7.3.1）** → 验证发布 + 传图链路。
7. 配好自动更新兜底（第八节方式 2 的 cron）。
8. 处理旧站（切内容或下线），全程保备份。
9. 按“验收清单”逐条自测，把结果回报用户，并教博主以后只在 Qexo 后台操作即可。

> 若中间任何一步与本文档冲突，以**实际服务器环境**为准并回报用户，不要擅自破坏现有 Typecho 数据。
