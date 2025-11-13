import { createComponent } from "noctes.jsx";
import { VIEW_DEPTH } from "./constants.js";

function ensureArray(obj) {
  if (Array.isArray(obj)) return obj;

  return [obj];
}

export default {
  render(ctx, props, slots) {
    const router = ctx.$router;
    const depth = ctx.$get(VIEW_DEPTH, -1) + 1;
    ctx.$set(VIEW_DEPTH, depth);

    const matchedRoute = router.currentRoutes.value[depth];

    if (!matchedRoute || !matchedRoute.component) return [null];

    let component = null;

    if (typeof matchedRoute.component === 'function') {
      component = createComponent("Lazy", { ...props, loadFunc: matchedRoute.component, fallback: matchedRoute.fallback || router.fallback })
    } else {
      component = createComponent(matchedRoute.component, props, slots)
    }

    return slots.default ? ensureArray(slots.default(component)) : [component];
  }
}