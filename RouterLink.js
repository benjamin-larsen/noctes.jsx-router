import { createElement } from "noctes.jsx";

export default {
  methods: {
    route(e) {
      e.preventDefault();

      if (typeof this.props.to !== 'string') return;
      this.$router.navigate(this.props.to);
    }
  },

  render(ctx, props, slots) {
    return [
      createElement("a", { ...props, ref: props.elRef, elRef: undefined, to: undefined, href: (ctx.$router.hrefPrefix || "") + props.to, onClick: ctx.methods.route }, slots.default && slots.default() || null)
    ]
  }
}