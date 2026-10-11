// Shared by the server layout (boot script) and the client prefs store.
export const STORAGE_KEY = { lang: "nanfeng.lang", theme: "nanfeng.theme", view: "nanfeng.view", intro: "nanfeng.intro" } as const;

// Runs before first paint (inline in <body>) so dark mode never flashes light.
export const prefsBootScript = `try{var t=localStorage.getItem("${STORAGE_KEY.theme}");if(t==="dark"||t==="light")document.body.dataset.theme=t;var l=localStorage.getItem("${STORAGE_KEY.lang}");if(l)document.documentElement.lang=l==="zh"?"zh-CN":l}catch(e){}`;
