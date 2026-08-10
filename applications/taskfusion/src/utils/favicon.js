// Sets the browser-tab favicon at runtime — needed because this is one
// SPA build serving multiple hosts (the platform host plus each domain
// service's microsite), so the icon can't be a single static
// public/favicon.ico link, it has to switch per host after mount.
export function setFavicon(href) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
