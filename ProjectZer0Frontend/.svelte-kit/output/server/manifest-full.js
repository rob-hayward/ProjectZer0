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
		client: {"start":"_app/immutable/entry/start.DRKS1Mxf.js","app":"_app/immutable/entry/app.Ut9CIAo4.js","imports":["_app/immutable/entry/start.DRKS1Mxf.js","_app/immutable/chunks/entry.C6B3fOkw.js","_app/immutable/chunks/scheduler.CHpejKh9.js","_app/immutable/chunks/index.A4FuD42y.js","_app/immutable/entry/app.Ut9CIAo4.js","_app/immutable/chunks/scheduler.CHpejKh9.js","_app/immutable/chunks/index.DkR5ShKl.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js'))
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
				id: "/create-node",
				pattern: /^\/create-node\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/edit-profile",
				pattern: /^\/edit-profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/nodes/word/[word]",
				pattern: /^\/nodes\/word\/([^/]+?)\/?$/,
				params: [{"name":"word","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
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
