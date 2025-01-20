export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","favicon.png","fonts/Orbitron_ExtraBold.json","fonts/Orbitron_Regular.json","images/.DS_Store","images/InvertedStar.png"]),
	mimeTypes: {".png":"image/png",".json":"application/json"},
	_: {
		client: {"start":"_app/immutable/entry/start.h6OKc7pR.js","app":"_app/immutable/entry/app.BjM32r3J.js","imports":["_app/immutable/entry/start.h6OKc7pR.js","_app/immutable/chunks/entry.B9Xi5JFP.js","_app/immutable/chunks/scheduler.DhRaDfhv.js","_app/immutable/chunks/utils.JM6e9OV-.js","_app/immutable/chunks/index.CmQ9bmmN.js","_app/immutable/chunks/control.CYgJF_JY.js","_app/immutable/entry/app.BjM32r3J.js","_app/immutable/chunks/utils.JM6e9OV-.js","_app/immutable/chunks/scheduler.DhRaDfhv.js","_app/immutable/chunks/index.d7ykBbfN.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
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
				id: "/graph",
				pattern: /^\/graph\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/graph/[view]",
				pattern: /^\/graph\/([^/]+?)\/?$/,
				params: [{"name":"view","optional":false,"rest":false,"chained":false}],
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
