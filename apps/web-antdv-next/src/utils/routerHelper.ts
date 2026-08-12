import type {
  RouteLocationNormalized,
  RouteRecordNormalized,
} from 'vue-router';

import { defineAsyncComponent } from 'vue';

const modules = import.meta.glob('../views/**/*.{vue,tsx}');

function normalizeComponentPath(componentPath: string) {
  const path = componentPath
    .trim()
    .split('@')[0]
    ?.split(/[?#]/)[0]
    ?.replace(/^#\/views/, '')
    .replace(/^\.\.\/views/, '')
    .replace(/\.(tsx|vue)$/, '')
    .replace(/\/index$/, '');

  return path?.startsWith('/') ? path : `/${path || ''}`;
}

function findComponentLoader(componentPath: string) {
  const normalizedPath = normalizeComponentPath(componentPath);
  return Object.entries(modules).find(([modulePath]) => {
    return normalizeComponentPath(modulePath) === normalizedPath;
  })?.[1];
}

/**
 * 注册一个异步组件
 * @param componentPath 例:/bpm/oa/leave/detail
 */
export function registerComponent(componentPath: string) {
  const loader = findComponentLoader(componentPath);
  return loader ? defineAsyncComponent(loader as any) : undefined;
}

/** 判断业务表单配置的组件路径是否真实存在。 */
export function isComponentRegistered(componentPath: string) {
  return Boolean(findComponentLoader(componentPath));
}

export const getRawRoute = (
  route: RouteLocationNormalized,
): RouteLocationNormalized => {
  if (!route) return route;
  const { matched, ...opt } = route;
  return {
    ...opt,
    matched: (matched
      ? matched.map((item) => ({
          meta: item.meta,
          name: item.name,
          path: item.path,
        }))
      : undefined) as RouteRecordNormalized[],
  };
};
