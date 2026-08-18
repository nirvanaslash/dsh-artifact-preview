# dsh-artifact-preview

[English](README.md) · [中文](README.zh-CN.md)

为 **DeepSeek Harness (DSH)** 提供 Codex 风格的产物预览。

`dsh-artifact-preview` 是一个客户端插件（`dsh.client.platform: "web"`），让产出的文件在对话中直接可见、可检查：

- **对话内产物卡片行** —— agent 写完文件后，消息末尾会出现"产物"行：按类型着色的卡片（Markdown 蓝 / 代码 绿 / CSV 青 / JSON 琥珀 / 图片 粉 / HTML 橙 / 文档 灰），**图片卡片内嵌缩略图**；点击任意卡片打开侧边预览。
- **分屏侧边预览面板** —— 可拖宽的真分屏右侧面板（对话内容完整可见、不被遮挡），支持渲染：
  - **Markdown** → 富文本（标题、表格、列表、代码块、链接、图片；相对路径本地图片自动解析）
  - **源代码**（`.py .js .ts .sh .css …`）→ 深色语法高亮
  - **CSV** → HTML 表格
  - **JSON** → 可折叠树
  - **图片**（`.png .jpg .gif .webp .svg …`）→ 棋盘格衬底居中
  - **HTML / 本地端口** → iframe（含开发服务器端口 chips、地址栏、后退/前进/刷新、外部打开）
- 全局钩子（`window.__dshOpenFilePreview` / `__dshCanPreviewPath`），其他插件可把"打开文件"意图路由进预览面板。

## 安装

从 GitHub 安装（本包同时声明了 `dsh.bundle` 与 `dsh.client`，`dsh plugin add` 会一次性装入依赖并自动注册为活动客户端插件层，无需手工编辑 profile）：

```sh
dsh plugin --profile web add github:nirvanaslash/dsh-artifact-preview
```

重启 `dsh web` 服务（或 DSH Desktop）并刷新页面。

发布到 npm 后，`dsh plugin --profile web add dsh-artifact-preview` 与市场搜索安装同样可用。

## 前置条件

- DSH Desktop（或安装了 `dsh-file-changes` 配套插件的 `dsh web` profile）—— 预览通过其 `/dsh-files/static/<绝对路径>` 路由读取文件内容。DSH Desktop 内置该路由；纯 `dsh web` 安装需先安装 `dsh-file-changes` 配套插件。
- 使用 `write`/`edit` 类工具产出文件的模型（"产物"正是由此追踪）。

## 兼容性

- 面向 DSH `0.1.0-rc.7`（DSH Desktop 2.0.1 内置）客户端插件 ABI：`window.__ModuleLoader__` 模块格式、`dsh.client` 元数据、`dsh.bundle` patch 注册、`conversation.chat.turnTail` 链槽。链槽选举依赖低 `priority`（`-100`）赢得产物行、优先于官方 deliverables 行；DSH 升级后请实测。

## 已知边界

- 对话产物行与预览面板在本包内完全自包含。
- 两项可选行为**不随包分发**（需修改 DSH 核心文件，公共包有意不带）：文件视图的多类型预览按钮、消息正文中文件名引用"打开即预览"。缺少它们时：文件视图预览保持 DSH 官方仅 HTML 的行为，正文引用用系统程序打开。

## 许可

MIT
