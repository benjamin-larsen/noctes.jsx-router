import { createComponent, createElement } from "noctes.jsx";
import { VIEW_DEPTH } from "./constants.js";

export default {
  render(ctx, props, slots) {
    const router = ctx.$router;
    const depth = ctx.$get(VIEW_DEPTH, -1) + 1;
    ctx.$set(VIEW_DEPTH, depth);

    const matchedRoute = router.currentRoutes.value[depth];

    if (!matchedRoute || !matchedRoute.component) return [null];

    if (typeof matchedRoute.component === 'function') {
      return [
        createComponent("Lazy", { ...props, loadFunc: matchedRoute.component, fallback: matchedRoute.fallback || router.fallback })
      ]
    } else {
      return [
        createComponent(matchedRoute.component, props, slots)
      ]
    }
  }
}