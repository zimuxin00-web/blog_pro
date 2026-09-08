/* 构建脚本：绕过 hexo-cli（本机 CLI 注册命令失败时的备用入口）
   用法： node build.js generate    /    node build.js server    /    node build.js clean  */
const Hexo = require('hexo');
const cmd = process.argv[2] || 'generate';
const hexo = new Hexo(process.cwd(), {});

hexo
  .init()
  .then(() => hexo.call(cmd))
  .then(() => hexo.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
