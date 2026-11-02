# Changelog

## 1.0.2 — 2026-11-02

发布方式从 GitHub 源码迁移到 npm：`dsh-window-size` 现在按 registry 包名安装，插件管理器与插件市场直接取预构建产物，不再需要克隆仓库。

- `package.json` 补齐发布元数据：`engines.dsh`（`^0.2.1-rc.5`，宿主在 pnpm 之前校验）、`publishConfig.access`、`exports["./cordis.patch.yml"]`；`files` 补上 `README.en.md` 与 `CHANGELOG.md`，`keywords` 补 `dsh-plugin`。
- 新增 `scripts/validate.mjs`：校验清单、导出、locale 元数据、图标体积与 `npm pack` 的真实文件清单；`prepublishOnly` 会强制执行，打包内容漂移时发布直接失败。
- 新增 `.github/workflows/publish.yml`：推送 `v*` 标签时先校验标签与 `package.json` 版本一致，再带 provenance 发布到 npm。
- README 中英双语安装段改为 npm 优先，源码安装降级为开发小节；补 npm 徽章与发布流程说明。
- 运行时行为与 1.0.1 相同。

## 1.0.1 — 2026-10-30

- 启动尺寸改由 Host 注入的引导脚本在窗口显示前应用，消除“先默认尺寸再跳转”的闪烁。
- 窗口出现后最多做 5 次、间隔 350 ms 的居中校正（±12 px 内即停），修复“先出现在屏幕角落、再跳到中间”的跳变；保存与恢复默认后同样居中。

## 1.0.0 — 2026-10-30

首个公开版本。

- 启动默认尺寸：保存后立即应用，下次启动自动生效（窗口内容区尺寸）。
- 比例预设：4:3 / 16:9 / 16:10 三组，每组一大一小，共 6 个内置尺寸。
- 自定义预设：最多 12 个，可删除，跨重启保留。
- 实时显示当前窗口内容区尺寸；上限于屏幕可用区域减去窗口边框。
- 「恢复默认」只清除启动尺寸，保留自定义预设。
- 存储使用 `dsh-window-size:v2`，自动迁移旧 `v1` 键；窗口隐藏或最小化导致边框测量异常时自动回退。
- 纯 Client 插件：Host 半边为空 `apply()`，不写文件、不联网、不改 DSH 安装目录。
- 仅桌面版生效；浏览器中面板只读并提示该功能需要桌面应用。
