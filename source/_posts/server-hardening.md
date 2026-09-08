---
title: 服务器上线前必做的 10 项安全加固
tags:
  - 网络安全
  - 运维
  -  hardening
categories:
  - 网络安全
cover: /img/default_cover.svg
description: 一台刚开出来的云服务器，从裸机到能放心对外提供服务，中间要做的 10 件事。
date: 2026-09-07 21:40:00
---

新买的云服务器默认是很「裸」的。下面这 10 项做完，能挡掉 **90% 的自动化扫描和脚本小子**。全程命令行，一台机器大约半小时。

<!-- 封面图：图片放在与本文同名的 server-hardening/ 文件夹里，正文写 ![](图片名) 即可显示 -->
![Linux服务器加固封面](linux-security-cover.svg)

## 1. 禁用 root 直接登录，改用密钥

```bash
# 本地生成密钥
ssh-keygen -t ed25519 -C "your@email.com"

# 把公钥传上去
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server-ip
```

然后改 `/etc/ssh/sshd_config`：

```ini
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
sudo systemctl restart sshd
```

**改之前务必另开一个终端确认能登进去**，否则可能把自己锁在门外。

## 2. 换掉默认 SSH 端口（可选）

改成非 22 能显著减少日志里的爆破噪音，但**这不是安全措施**，只是减少骚扰。真正的安全靠的是第 1 步的密钥。

## 3. 装 fail2ban

自动封禁连续登录失败的 IP：

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

## 4. 配置防火墙，只开必要端口

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**数据库端口（3306、6379、27017）千万不要对外开放。** 这是最常见的翻车点。

## 5. 开启自动安全更新

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 6. 全站 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

顺手加上安全响应头：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## 7. 隐藏版本号

```nginx
server_tokens off;
```

同理，关闭 Nginx / PHP 的版本暴露，别让攻击者一眼知道你跑的是什么版本。

## 8. 数据库不要用默认账户和默认库

```sql
-- 删掉测试库，删掉匿名账户
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.user WHERE User='';
-- 应用账户只给必要的库权限，不要给 ALL PRIVILEGES
GRANT SELECT,INSERT,UPDATE,DELETE ON blog.* TO 'blog'@'localhost';
```

## 9. 备份：3-2-1 原则

- **3** 份副本
- **2** 种不同介质
- **1** 份异地

最小可用实现：每天 `mysqldump` + `rsync` 到另一台机器，保留 7 天。

```bash
#!/bin/bash
DATE=$(date +%F)
mysqldump -u root -p'密码' blog > /backup/blog-$DATE.sql
find /backup -name "*.sql" -mtime +7 -delete
```

**没验证过能恢复的备份，不算备份。** 至少真的恢复演练一次。

## 10. 日志要送到删不掉的地方

攻击者进来第一件事就是清日志。把关键日志实时同步到远程：

```bash
# rsyslog 转发到远端，或者用云厂商的日志服务
*.* @@log-server.example.com:514
```

---

## 做完之后的检查

```bash
# 看看哪些端口在对外监听
sudo ss -tlnp
# 看看有没有异常登录
sudo last -20
# 看看谁在爆破
sudo grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -nr | head
```

---

## 一句话总结

安全加固的优先级：**密钥登录 > 防火墙 > HTTPS > 自动更新 > 备份**。前两项做了，绝大多数自动化攻击就与你无关了。
