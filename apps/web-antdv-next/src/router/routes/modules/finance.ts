import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/finance',
    name: 'Finance',
    meta: {
      hideInMenu: true,
      title: '财务管理',
    },
    children: [
      {
        path: '/finance/ec/sku-mapping',
        name: 'FinanceEcSkuMapping',
        component: () => import('#/views/finance/sku-mapping/index.vue'),
        meta: {
          hideInMenu: true,
          title: 'SKU 映射',
          access: ['finance:crossborder:sku-mapping:query'],
        },
      },
      {
        path: '/finance/ec/inventory',
        name: 'FinanceEcInventory',
        component: () => import('#/views/finance/inventory/index.vue'),
        meta: {
          hideInMenu: true,
          title: '库存管理',
          access: ['finance:crossborder:inventory:query'],
        },
      },
      {
        path: '/finance/ec/order',
        name: 'FinanceEcOrder',
        component: () => import('#/views/finance/order/index.vue'),
        meta: {
          hideInMenu: true,
          title: '订单导入',
          access: ['finance:crossborder:order-import:query'],
        },
      },
      {
        path: '/finance/ec/report',
        name: 'FinanceEcReport',
        component: () => import('#/views/finance/report/index.vue'),
        meta: {
          hideInMenu: true,
          title: '财务报表',
          access: ['finance:crossborder:order-import:query'],
        },
      },
    ],
  },
];

export default routes;
