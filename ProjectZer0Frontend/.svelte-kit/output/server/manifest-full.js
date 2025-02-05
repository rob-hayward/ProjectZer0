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
		client: {"start":"_app/immutable/entry/start.BAksqkZE.js","app":"_app/immutable/entry/app.CNOCNZ2X.js","imports":["_app/immutable/entry/start.BAksqkZE.js","_app/immutable/chunks/entry.DQxgZDBP.js","_app/immutable/chunks/scheduler.B-0CXS5p.js","_app/immutable/chunks/index.BLBD6f_K.js","_app/immutable/entry/app.CNOCNZ2X.js","_app/immutable/chunks/scheduler.B-0CXS5p.js","_app/immutable/chunks/index.Cd9iFXld.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js'))
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
				id: "/graph/[view]",
				pattern: /^\/graph\/([^/]+?)\/?$/,
				params: [{"name":"view","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
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
