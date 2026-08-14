# Context Map

## Contexts

- [宿舍管理](./apps/web-antdv-next/src/views/dorm/CONTEXT.md) — 区域/楼栋/房间/床位、住宿申请与订单、排房与调房、部门费用分摊
- [BPM 工作流](./apps/web-antdv-next/src/views/bpm/CONTEXT.md) — 流程定义、流程实例、审批任务、业务表单渲染
- [国际出运](./apps/web-antdv-next/src/views/shipment/CONTEXT.md) — 客户/工厂档案、运编号、装箱单、出运订单、订舱、分柜/拼柜、费用分摊

## Relationships

- **BPM → 宿舍管理**: 住宿申请通过 BPM 流程实例驱动审批；流程定义的业务表单查看组件（`formCustomViewPath`）指向宿舍管理域的只读详情组件（如 `dorm/apply/modules/process-detail.vue`），BPM 通过 `businessKey`/`businessFormData` 把流程实例和具体的住宿申请数据关联起来。BPM 不理解住宿申请内部的字段含义，只负责按注册表把渲染工作转交给宿舍管理域的组件。
- 宿舍管理与国际出运之间尚未定义领域关系。

## 与后端 `gths-admin` 仓库的对应关系

- 宿舍管理 ↔ 后端根 `CONTEXT.md`（宿舍排房）
- 国际出运 ↔ 后端 `admin-module-container/CONTEXT.md`（国际出运）
- BPM 工作流：后端 `admin-module-bpm` 暂未建立对应 `CONTEXT.md`（目前是通用流程引擎，未形成国泰华盛自定义领域规则）

两侧文档各自维护、互相引用，视角不同处（前端 UI/状态视角 vs 后端履约/业务规则视角）不强行合并，仅在正文用 `_Avoid_` 或说明文字标注已知差异。
