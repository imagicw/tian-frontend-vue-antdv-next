import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/dorm',
    name: 'Dorm',
    meta: {
      hideInMenu: true,
      title: '宿舍管理',
    },
    children: [
      {
        path: '/dorm/area',
        name: 'DormArea',
        component: () => import('#/views/dorm/area/index.vue'),
        meta: {
          hideInMenu: true,
          title: '区域管理',
          access: ['dorm:area:query'],
        },
      },
      {
        path: '/dorm/apply',
        name: 'DormApply',
        component: () => import('#/views/dorm/apply/index.vue'),
        meta: {
          hideInMenu: true,
          title: '住宿申请',
          access: ['dorm:apply:query'],
        },
      },
      {
        path: '/bpm/dorm/create',
        name: 'BpmDormApplyCreate',
        component: () =>
          import('#/views/dorm/apply/modules/process-create.vue'),
        meta: {
          hideInMenu: true,
          title: '公寓申请',
          access: ['dorm:apply:create'],
        },
      },
      {
        path: '/dorm/booking',
        redirect: '/dorm/scheduler',
        meta: {
          hideInMenu: true,
          title: '排房日历',
          access: ['dorm:room:query'],
        },
      },
      {
        path: '/dorm/my-order',
        name: 'DormMyOrder',
        component: () => import('#/views/dorm/order/my.vue'),
        meta: {
          hideInMenu: true,
          title: '我的订单',
          access: ['user:dorm:order:query'],
        },
      },
      {
        path: '/dorm/order',
        name: 'DormOrder',
        component: () => import('#/views/dorm/order/index.vue'),
        meta: {
          hideInMenu: true,
          title: '住宿订单',
          access: ['dorm:order:query'],
        },
      },
      {
        path: '/dorm/order/:serial',
        name: 'DormOrderDetail',
        component: () => import('#/views/dorm/order/modules/detail.vue'),
        meta: {
          hideInMenu: true,
          title: '订单详情',
          access: ['dorm:order:query', 'user:dorm:order:query'],
        },
      },
      {
        path: '/dorm/allocation',
        name: 'DormAllocation',
        component: () => import('#/views/dorm/allocation/index.vue'),
        meta: {
          hideInMenu: true,
          title: '费用分摊',
          access: ['dorm:dept-fee-allocation:query'],
        },
      },
      {
        path: '/dorm/allocation/:orderNo',
        name: 'DormAllocationDetail',
        component: () => import('#/views/dorm/allocation/modules/detail.vue'),
        meta: {
          hideInMenu: true,
          title: '分摊详情',
          access: ['dorm:dept-fee-allocation:query'],
        },
      },
      {
        path: '/dorm/building',
        name: 'DormBuilding',
        component: () => import('#/views/dorm/building/index.vue'),
        meta: {
          hideInMenu: true,
          title: '楼栋管理',
          access: ['dorm:build:query'],
        },
      },
      {
        path: '/dorm/scheduler',
        name: 'DormScheduler',
        component: () => import('#/views/dorm/scheduler/index.vue'),
        meta: {
          hideInMenu: true,
          title: '排房管理',
          access: ['dorm:room:query'],
        },
      },
    ],
  },
];

export default routes;
