# Context Map

## Contexts

- [宿舍管理](./apps/web-antdv-next/src/views/dorm/CONTEXT.md) — 区域/楼栋/房间/床位、住宿申请与订单、排房与调房、部门费用分摊
- [BPM 工作流](./apps/web-antdv-next/src/views/bpm/CONTEXT.md) — 流程定义、流程实例、审批任务、业务表单渲染

## Relationships

- **BPM → 宿舍管理**: 住宿申请通过 BPM 流程实例驱动审批；流程定义的业务表单查看组件（`formCustomViewPath`）指向宿舍管理域的只读详情组件（如 `dorm/apply/modules/process-detail.vue`），BPM 通过 `businessKey`/`businessFormData` 把流程实例和具体的住宿申请数据关联起来。BPM 不理解住宿申请内部的字段含义，只负责按注册表把渲染工作转交给宿舍管理域的组件。
