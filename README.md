# LOCK/ON — 锁定练枪场

一个无需后端服务的 2D / 3D 浏览器练枪项目。使用原生 HTML、CSS、JavaScript、Canvas 2D 与 Three.js，训练记录仅保存在当前浏览器中。

## 功能

- 六种训练：精准定位、反应射击、动态跟枪、精确射手、3×3 九宫格射击、飞碟射击。
- 2D 与 3D 训练场景，支持灵敏度、准星、难度、训练时长、主题和声音设置。
- 3×3 九宫格始终保持三颗球，击中后在不同空格刷新。
- 每轮结束后有 3 秒防误触等待时间，结果页按钮与 `R` 快捷键均受此限制。
- 本地保存最佳成绩与最近训练记录，不上传个人训练数据。

## 下载源码

在 GitHub 仓库页面选择 **Code → Download ZIP**，解压后进入项目目录。

也可以使用 Git：

```bash
git clone https://github.com/Imixiss/lock-on-aim-trainer.git
cd lock-on-aim-trainer
```

## 本地运行

要求：Node.js 20 或更高版本。

```bash
npm install
npm start
```

然后在浏览器中打开：

```text
http://127.0.0.1:4174
```

请通过上述本地服务器访问，不要直接双击 `public/index.html`，否则浏览器可能阻止 ES 模块加载。

## 语法检查

```bash
npm run check
```

## 项目结构

```text
public/              页面、样式与训练逻辑
public/js/modes/     各训练模式
server.mjs           本地静态服务器
package.json         项目依赖与运行脚本
```

## 开源许可

本项目采用 [MIT License](LICENSE)。Three.js 作为 npm 依赖引入，其许可证随依赖包提供。
