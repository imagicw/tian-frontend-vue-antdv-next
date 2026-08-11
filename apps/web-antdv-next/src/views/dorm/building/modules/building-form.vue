<script lang="ts" setup>
import type { DormApi } from '#/api/dorm';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createBuild, updateBuild } from '#/api/dorm';
import { getSimpleUserList } from '#/api/system/user';

const emit = defineEmits<{ success: [] }>();

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 96 },
  layout: 'horizontal',
  schema: [
    {
      fieldName: 'id',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'areaId',
      component: 'Input',
      dependencies: { triggerFields: [''], show: () => false },
    },
    {
      fieldName: 'buildName',
      label: '楼栋名称',
      component: 'Input',
      componentProps: {
        maxlength: 36,
        placeholder: '例如：A 栋、员工公寓 1 号楼',
        showCount: true,
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'buildNo',
      label: '楼栋编号',
      component: 'Input',
      componentProps: {
        maxlength: 13,
        placeholder: '例如：A、B01',
        showCount: true,
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'buildAdmin',
      label: '楼栋管理员',
      component: 'ApiSelect',
      componentProps: {
        api: getSimpleUserList,
        labelField: 'nickname',
        valueField: 'id',
        mode: 'multiple',
        maxTagCount: 'responsive',
        optionFilterProp: 'label',
        placeholder: '请选择楼栋管理员',
        showSearch: true,
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'buildStorey',
      label: '楼层数',
      component: 'InputNumber',
      componentProps: (values) => ({
        class: 'w-full',
        disabled: Boolean(values.id),
        min: 1,
        max: 100,
        placeholder: '请输入楼层数',
      }),
      dependencies: {
        triggerFields: ['id'],
      },
      rules: 'required',
      formItemClass: 'col-span-2',
    },
    {
      fieldName: 'address',
      label: '楼栋地址',
      component: 'Input',
      componentProps: { placeholder: '填写楼栋所在的具体位置' },
      formItemClass: 'col-span-4',
    },
    {
      fieldName: 'attention',
      label: '楼栋说明',
      component: 'RichTextarea',
      componentProps: {
        height: 320,
        width: '100%',
      },
      formItemClass: 'col-span-4',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-4',
});

const isEdit = ref(false);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    const data = (await formApi.getValues()) as DormApi.DormBuilding;
    try {
      await (data.id ? updateBuild(data) : createBuild(data));
      await modalApi.close();
      emit('success');
      message.success('操作成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) return;
    const data = modalApi.getData<Partial<DormApi.DormBuilding>>();
    isEdit.value = !!data?.id;
    await formApi.resetForm();
    if (data) await formApi.setValues(data);
  },
});
</script>

<template>
  <Modal :title="isEdit ? '编辑楼栋' : '新增楼栋'" class="w-[860px]">
    <div class="border-border bg-muted mx-4 mb-5 rounded-lg border px-4 py-3">
      <div class="text-foreground text-sm font-medium">楼栋基础信息</div>
      <div class="text-muted-foreground mt-1 text-xs leading-5">
        创建时将按楼层数生成楼层；创建后请通过楼层管理增删楼层。
      </div>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
