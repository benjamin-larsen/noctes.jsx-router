import { shallowRef, globalProperties, isComponent, withoutTracking, readonly } from "noctes.jsx"
import RouterView from "./RouterView.js"
import RouterLink from "./RouterLink.js";

export { RouterView, RouterLink }

function transformPath(path, hasChildren) {
  const arr = [];
  let hasWildcard = false;

  for (const subpath of path.split("/")) {
    if (!subpath) continue;
    if (hasWildcard) throw Error("Can't have subpaths after wildcard.")

    if (subpath.startsWith(":")) {
      arr.push({ type: "param", value: subpath.slice(1) })
    } else if (subpath.startsWith("*")) {
      if (hasChildren) throw Error("Can't have wildcard along with nested routes.");
      hasWildcard = true;
      arr.push({ type: "wildcard" })
    } else {
      arr.push({ type: "literal", value: subpath })
    }
  }

  return arr;
}

function transformRoute(route, hasRoot) {
  if (route.component && !isComponent(route.component) && typeof route.component !== 'function') throw Error("Route Component must be a Component.");
  if (!route.component && !route.redirect && !route.children) throw Error("Route must contain atleast a component, redirect, or nested routes.");
  if (route.redirect && (route.children || hasRoot)) throw Error("Nested Routes can't be on Root Component with redirect.");

  if (route.fallback) {
    if (typeof route.component !== "function") throw Error("Route Fallback can only exist on async routes.");
    if (typeof route.fallback === 'function') throw Error("Route Fallback can't be an async component.");
    if (!isComponent(route.fallback)) throw Error("Route Fallback must be a Component.");
  }

  const isRoot = !!route.component || !!route.redirect;

  return {
    path: transformPath(route.path, !!route.children),
    component: route.component || null,
    redirect: route.redirect || null,
    children: route.children ? route.children.map(route => transformRoute(route, isRoot)) : null,
    fallback: route.fallback || null
  }
}

function comparePath(path, target) {
  if (path.length > target.length) return null;

  let params = {};

  for (const index in path) {
    const subpath = path[index];

    if (subpath.type === "param") {
      params[subpath.value] = decodeURIComponent(target[index]);
    } else if (subpath.type === "literal") {
      if (target[index] !== subpath.value) return null;
    } else if (subpath.type === "wildcard") {
      return {
        params,
        wildcard: true
      };
    }
  }

  return {
    params,
    wildcard: false
  };
}

function hasRouteNaive(path, routes) {
  if (!routes) return false;

  for (const route of routes) {
    const pathData = comparePath(route.path, path);
    if (!pathData) continue;
    
    return true;
  }

  return false;
}

function matchRoute(path, routes) {
  for (const route of routes) {
    const pathData = comparePath(route.path, path);
    if (!pathData) continue;

    const isRoot = !!route.component || !!route.redirect;

    const subPath = path.slice(route.path.length);
    
    if ((path.length > route.path.length && !pathData.wildcard) || !isRoot || hasRouteNaive(subPath, route.children)) {
      if (!route.children || route.children.length === 0) continue;

      const matchedChildRoute = matchRoute(subPath, route.children);
      if (!matchedChildRoute) continue;

      return {
        meta: route.meta ? { ...route.meta, ...matchedChildRoute.meta } : matchedChildRoute.meta,
        params: { ...pathData.params, ...matchedChildRoute.params },
        routes: isRoot ? [route, ...matchedChildRoute.routes] : matchedChildRoute.routes
      }
    } else {
      return {
        meta: route.meta || {},
        params: pathData.params,
        routes: [ route ]
      }
    }
  }

  return null;
}

class Router {
  constructor(fallback, routes) {
    if (fallback && !isComponent(fallback)) throw Error("Fallback must be a Component.");

    this.processRouteHooks = [];

    this.path = shallowRef(null);
    this.queryParams = shallowRef(null);
    this.fallback = fallback || null;
    this.currentRoutes = shallowRef([]);
    this.params = shallowRef({});
    this.meta = shallowRef({});
    
    this._setRoutes(routes);
  }

  processRoute(fn) {
    this.processRouteHooks.push(fn);
  }

  evaluateProcessRouteHooks(from, to) {
    for (const fn of this.processRouteHooks) {
      try {
        var value = fn(from, to);

        if (typeof value === 'string') return value;
      } catch(e) {
        console.log("[Noctes.jsx - Router]: Error occured while running Route Hook.")
      }
    }
  }

  _updateRoute(pathRaw) {
    const path = pathRaw.split("/").filter(x=>x)
    const matched = matchRoute(path, this.routes);
    let processedRedirect = matched && this.evaluateProcessRouteHooks(
      readonly({
        meta: this.meta.value,
        params: this.params.value,
        routes: this.currentRoutes.value
      }),
      readonly(matched)
    );

    if (processedRedirect) {
      return this.navigate(processedRedirect)
    }

    if (matched && matched.routes[0].redirect) {
      return this.navigate(matched.routes[0].redirect)
    }

    this.meta.value = matched ? matched.meta : {};
    this.params.value = matched ? matched.params : {};
    this.currentRoutes.value = matched ? matched.routes : [];
  }

  _setRoutes(routes) {
    this.routes = routes.map(route => transformRoute(route, false));
  }
}

class WebRouter extends Router {
  constructor(...args) {
    super(...args);

    this._refreshRoute();
    window.addEventListener("popstate", WebRouter.prototype._refreshRoute.bind(this));
  }

  navigate(newPath) {
    window.history.pushState({}, "", newPath);
    this._refreshRoute()
  }

  _refreshRoute() {
    withoutTracking(() => {
      const newPath = window.location.pathname;
      this.queryParams.value = window.location.search;

      if (this.path.value !== newPath) {
        this.path.value = newPath;
        this._updateRoute(newPath);
      }
    })
  }
}

class HashRouter extends Router {
  constructor(...args) {
    super(...args);

    this._refreshRoute();
    window.addEventListener("hashchange", HashRouter.prototype._refreshRoute.bind(this));

    this.hrefPrefix = "#";
  }
  
  navigate(newPath) {
    window.location.hash = "#" + newPath;
    this._refreshRoute()
  }

  _refreshRoute() {
    withoutTracking(() => {
      const newPath = window.location.hash.slice(1);

      if (this.path.value !== newPath) {
        this.path.value = newPath;
        this._updateRoute(newPath);
      }
    })
  }
}

export default function useRouter(ctx, config = {}) {
  const router = new (config.hash ? HashRouter : WebRouter)(config.fallback, config.routes);

  globalProperties.$router = router;
}