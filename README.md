# tian-frontend-vue-antdv-next

国泰华盛（Guotai Huasheng）盛天事业部信息系统（Tian System）的下一代前端项目，基于 [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) v5.7 fork 而来的 pnpm monorepo（Vue 3 + Ant Design Vue 4）。

区别于同系列的 `tian-frontend-vue`（多 UI 库分支），本仓库只维护单一应用 `apps/web-antdv-next`，其余部分（packages、内部工具链）沿用相同的 vben-admin 结构。

## 项目定位

Tian System 覆盖账号管理、集装箱/物流拼柜、宿舍管理、财务、WMS、BPMN 工作流等业务模块。本仓库是其前端部分，配套后端为 `gths-admin`（Spring Boot + yudao 框架，位于同级目录 `../gths-admin`）。

## 环境要求

- Node.js：`^22.18.0 || ^24.0.0`（`.node-version` 锁定 `24.16.0`）
- pnpm：`>= 11.0.0`（`preinstall` 钩子强制使用 pnpm，禁止 npm / yarn）

## 常用命令

```bash
pnpm install              # 安装依赖
pnpm dev:antdv-next        # 启动开发服务器（apps/web-antdv-next，默认端口 8001）
pnpm build:antdv-next      # 生产构建
pnpm lint                  # 代码检查（eslint + oxlint + stylelint）
pnpm format                # 代码格式化
pnpm check:type            # TypeScript 类型检查（全 monorepo）
pnpm check                 # 完整检查：循环依赖 + 依赖检查 + 类型检查 + 拼写检查
pnpm test:unit             # 单元测试（vitest，happy-dom）
pnpm test:e2e              # 端到端测试（playwright）
```

单独运行某个测试文件：在仓库根目录执行 `pnpm vitest run <path-to-spec>`。

## 项目结构

```
apps/web-antdv-next/    # 唯一应用：主 Web 前端
packages/
├── @core/               # 核心框架包（base、ui-kit、forward）
├── effects/             # 效果插件（plugins、hooks、layouts 等）
├── constants/           # 共享常量
├── icons/               # 图标定义
├── locales/             # 国际化
├── preferences/         # 应用偏好设置
├── stores/               # Pinia 状态管理
├── styles/               # 全局样式（Tailwind CSS 4）
├── types/                # 共享类型定义
└── utils/                # 工具函数
internal/                 # 内部工具（lint 配置、tsconfig、vite-config、node-utils）
docs/                     # VitePress 文档站（沿用上游 vben-admin 文档，多为通用内容）
```

`apps/web-antdv-next/src/` 下的关键目录：

```
router/routes/modules/   # 按业务域划分的路由定义（dashboard、dorm、bpm、finance、shipment、ai、infra、system、leave 等）
views/                   # 页面组件，与路由模块一一对应
api/                     # 后端 API 服务模块，按业务域划分子目录
adapter/                 # 适配层 / 布局配置
components/              # 共享组件
```

Tian 特有业务域位于 `views/dorm`、`views/bpm`、`views/finance`、`views/shipment`；其余模块（`system`、`infra`、`ai`、`mp`、`erp`、`wms`、`report`）基本沿用上游 yudao / vben 参考实现。

### 跨域上下文文档

部分业务域在页面目录旁维护 `CONTEXT.md`，记录领域术语与跨域关系（索引见仓库根目录 `CONTEXT-MAP.md`）：

- `apps/web-antdv-next/src/views/dorm/CONTEXT.md` — 宿舍管理（区域/楼栋/房间/床位、住宿申请与订单、排房与调房、部门费用分摊）
- `apps/web-antdv-next/src/views/bpm/CONTEXT.md` — BPM 工作流（流程定义/实例、审批任务、业务表单渲染）

这两个域是耦合的：住宿申请通过 BPM 流程实例驱动审批；跨域改动前请先阅读相关 `CONTEXT.md`，并在领域术语或关系变化时同步更新。

## 与后端的集成

- 开发环境代理 `/admin-api`（见 `apps/web-antdv-next/.env.development`，`VITE_GLOB_API_URL=/admin-api`），后端地址默认为 `http://127.0.0.1:8080`
- 默认启用租户模式（`VITE_APP_TENANT_ENABLE=true`，默认租户 id `1`）
- 默认启用接口加解密（`VITE_APP_API_ENCRYPT_ENABLE=true`，AES，请求头 `X-Api-Encrypt`）——调试网络原始报文时需留意
- 后端为 `gths-admin`（Spring Boot / yudao 框架，同级目录 `../gths-admin`），领域定义详见其自身的 `CONTEXT.md`

## 开发约定

- **Modal + Table 模式（重要）**：`<FormModal />` 与 `<Grid />`（或列表组件）必须是兄弟节点，而非嵌套。错误写法：`<FormModal><Grid /></FormModal>`；正确写法：`<FormModal /><Grid />`。Modal 通过 `useVbenModal({ connectedComponent: ... })` 声明，以命令式方式驱动（`formModalApi.open()` / `.setData()`），而非 slot 内容。
- **Commit 规范**：通过 `czg` / `cz-git`（`pnpm commit`）生成符合 Conventional Commits 的提交信息，由 commitlint + lefthook 校验。
- **国际化**：新增 key 需在 `packages/locales` 下各语言命名空间中保持一致。

## 相关文档

- 项目整体指引见根目录 `CLAUDE.md`
- 跨域上下文索引见 `CONTEXT-MAP.md`
