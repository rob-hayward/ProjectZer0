export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","favicon.png","images/.DS_Store","images/HomePageLayer0.png","images/InvertedStar.png","images/Star.png","images/background.png"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {"start":"_app/immutable/entry/start.C8omUBH9.js","app":"_app/immutable/entry/app.CsxvQMwS.js","imports":["_app/immutable/entry/start.C8omUBH9.js","_app/immutable/chunks/entry.DE9xMmjB.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.DspQOGsj.js","_app/immutable/entry/app.CsxvQMwS.js","_app/immutable/chunks/scheduler.DUa3pFyD.js","_app/immutable/chunks/index.BtLLPK58.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/edit-profile",
				pattern: /^\/edit-profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
