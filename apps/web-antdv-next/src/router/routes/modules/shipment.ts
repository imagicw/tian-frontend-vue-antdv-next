import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: { icon: 'lucide:ship', order: 30, title: '物流管理' },
    name: 'Shipment',
    path: '/shipment',
    children: [
      {
        meta: {
          access: ['container:client-profile:query'],
          title: '客户配置',
        },
        name: 'ShipmentClient',
        path: 'client',
        component: () => import('#/views/shipment/client/index.vue'),
      },
      {
        meta: { access: ['container:factory:query'], title: '工厂管理' },
        name: 'ShipmentFactory',
        path: 'factory',
        component: () => import('#/views/shipment/factory/index.vue'),
      },
      {
        meta: {
          access: ['container:shipping-number:query'],
          title: '运编号管理',
        },
        name: 'ShipmentShippingNo',
        path: 'shipping-no',
        component: () => import('#/views/shipment/shipping-no/index.vue'),
      },
      {
        meta: {
          access: ['container:container-config:query'],
          title: '集装箱配置',
        },
        name: 'ShipmentContainerConfig',
        path: 'container-config',
        component: () => import('#/views/shipment/container-config/index.vue'),
      },
      {
        meta: {
          access: ['container:packing-list:query'],
          title: '装箱单管理',
        },
        name: 'ShipmentPackingList',
        path: 'packing-list',
        component: () => import('#/views/shipment/packing-list/index.vue'),
      },
      {
        meta: {
          access: ['container:packing-list:query'],
          hideInMenu: true,
          title: '装箱单详情',
        },
        name: 'ShipmentPackingListDetail',
        path: 'packing-list/:id',
        component: () => import('#/views/shipment/packing-list/[id].vue'),
      },
      {
        meta: { access: ['container:order:query'], title: '运输订单' },
        name: 'ShipmentOrder',
        path: 'order',
        component: () => import('#/views/shipment/order/index.vue'),
      },
      {
        meta: { access: ['container:booking:query'], title: '订舱管理' },
        name: 'ShipmentBooking',
        path: 'booking',
        component: () => import('#/views/shipment/booking/index.vue'),
      },
      {
        meta: { access: ['container:split:query'], title: '分柜工作台' },
        name: 'ShipmentSplit',
        path: 'split',
        component: () => import('#/views/shipment/split/index.vue'),
      },
      {
        meta: {
          access: ['container:consolidation:suggest'],
          title: '智能拼柜',
        },
        name: 'ShipmentConsolidation',
        path: 'consolidation',
        component: () => import('#/views/shipment/consolidation/index.vue'),
      },
      {
        meta: {
          access: ['container:cost-allocation:query'],
          title: '费用分摊',
        },
        name: 'ShipmentCostAllocation',
        path: 'cost-allocation',
        component: () => import('#/views/shipment/cost-allocation/index.vue'),
      },
      {
        meta: {
          access: ['container:operation-log:query'],
          title: '操作日志',
        },
        name: 'ShipmentLog',
        path: 'log',
        component: () => import('#/views/shipment/log/index.vue'),
      },
    ],
  },
];

export default routes;
