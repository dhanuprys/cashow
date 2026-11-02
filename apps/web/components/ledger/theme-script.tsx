/**
 * Applies the stored theme before first paint.
 *
 * The `dark` class has to be on `<html>` before the stylesheet resolves,
 * otherwise the page flashes white for dark-mode users. React cannot do this
 * early enough, so a tiny blocking script runs in `<head>`.
 */
const script = `(function(){try{
var stored=localStorage.getItem("cashow-theme");
var dark=stored==="dark"||((stored===null||stored==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var root=document.documentElement;
root.classList.toggle("dark",dark);
root.style.colorScheme=dark?"dark":"light";
}catch(e){}})();`;

export function ThemeScript() {
  // A static, project-authored string; no user input reaches it.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: blocking theme bootstrap
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
