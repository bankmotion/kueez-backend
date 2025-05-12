declare module "playwright-extra-plugin-stealth" {
  import { Plugin } from "playwright-extra";
  const stealth: () => Plugin;
  export default stealth;
}
