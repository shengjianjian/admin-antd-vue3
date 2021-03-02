import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { get, remove } from 'js-cookie';

import NProgress from '@/plugins/nprogress';
import { removeStorage, setStorage, getStorage } from '@/utils/storage';
import config from '@/config';
import routes, { noMatchRoute } from './constRoutes';
import asyncRoutes from './asyncRoutes';
import { getPageTitle } from '@/utils';
import { ganerAuthData } from '@bwrong/auth-tool';
// import authApi from '@/api/auth';
// 重写路由的push方法，解决同一路由多次跳转报错 message: "Navigating to current location (XXX) is not allowed"
// const { push: routerPush, replace: routerReplace } = VueRouter.prototype;
// VueRouter.prototype.push = function push(location, onResolve, onReject) {
//   if (onResolve || onReject) return routerPush.call(this, location, onResolve, onReject);
//   return routerPush.call(this, location).catch((err) => err);
// };
// VueRouter.prototype.replace = function replace(location, onResolve, onReject) {
//   if (onResolve || onReject) return routerReplace.call(this, location, onResolve, onReject);
//   return routerReplace.call(this, location).catch((err) => err);
// };
let routerLoaded = false; // 动态路由是否已加载
const createRouterFactory = () => {
  routerLoaded = false; // 重置状态
  return createRouter({
    history: createWebHistory(process.env.BASE_URL),
    scrollBehavior: () => ({ top: 0, left: 0 }),
    routes
  });
};
let router = createRouterFactory();
router.beforeEach(async (to, from) => {
  // 进度条
  NProgress.start();
  // 设置页面标题
  // document.title = getPageTitle(to.meta.title);
  const token = get(config.tokenKey);
  // 其实路由拦截后所做跳转仅有一下几种情况：
  // 1.已登录时跳转到登录页（非登出的情况）需要重定向到根路径
  if (token && to.path === '/login') return '/';
  // 2.路由在白名单，或者已经登录且动态路由已加载完成，均放行
  if (config.whiteRoutes.includes(to.path) || (token && routerLoaded)) return true;
  // 3.未登录且不在白名单，重定向到登录页，带上回调地址，方便回归
  if (!token) return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
  // 4.根据后台返回权限标识洗出有权限的路由，并将洗过的路由表动态添加到路由中
  // let role =getStorage('userinfo')?.role; // 仅用作模拟，勿在生产环境使用
  // const menus = await authApi.getMenus({
  //   role
  // }).then(res => res);
  // const menus = await authApi.getMenus({}).then(res =>  {
  //   if(res.code === 200) {
  //     setStorage('userinfo', res.body.sysUser);
  //     return res.menus;
  //   }
  // });
  let menus = getStorage('menuList') || [];
  const allowRoutes = _ganerRoutesAndMenus(asyncRoutes, menus);
  // const allowRoutes:any[] = asyncRoutes; // 暂时跳过权限检查
  allowRoutes.push(noMatchRoute);
  console.log(allowRoutes);
  // 未加载则动态加载
  allowRoutes.map((item) => router.addRoute(item));
  routerLoaded = true;
  return { ...to, replace: true };
});
// 路由后置守卫
router.afterEach(() => NProgress.done());

// 重置路由
export function resetRouter() {
  router = createRouterFactory();
}

/**
 * 生成权限路由和菜单
 * @param {*} routes 需要鉴权的路由
 * @param {*} permissions 菜单和权限标识集
 */
function _ganerRoutesAndMenus(routes: Array<RouteRecordRaw>, permissions: any[]) {
  const { routes: filterRoutes, menus } = ganerAuthData({
    routes,
    permissions,
    authKey: 'permission'
  });
  // setStorage('authMap', authMap);
  setStorage('menus', menus);
  return filterRoutes as Array<RouteRecordRaw>;
}
// 登出
export function logout() {
  remove(config.tokenKey);
  remove(config.refreshTokenKey);
  remove(config.tokenExpiresKey);
  removeStorage('userinfo', 'menus');
  // router.replace('/login');
  resetRouter();
  location.reload();
}
export default router;
