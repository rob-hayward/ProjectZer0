import{s as ne,n as J,o as ie,d as se}from"../chunks/scheduler.DUa3pFyD.js";import{S as oe,i as fe,e as d,s as g,c as m,m as D,h as E,n as N,j as P,o as re,g as p,b as v,d as x,f as C,k as n,l as q}from"../chunks/index.BtLLPK58.js";import{g as ue}from"../chunks/entry._RkA5kDJ.js";import{h as ce,g as pe,l as de}from"../chunks/auth0.DsDXFQ5O.js";function me(i){let e,l="No user data available";return{c(){e=d("p"),e.textContent=l},l(t){e=m(t,"P",{"data-svelte-h":!0}),D(e)!=="svelte-4dxqnb"&&(e.textContent=l)},m(t,s){P(t,e,s)},p:J,d(t){t&&p(e)}}}function he(i){let e,l,t,s=(i[0].preferred_username||i[0].name||i[0].nickname||"User")+"",o,U,k,h,S,b=(i[0].email||"Not provided")+"",f,a,_,L,W,H=(i[0].preferred_username||"Not set")+"",A,G,M,R,j=(i[0].mission_statement||"Not provided")+"",B,V,O,$="User Details:",z,T,w=JSON.stringify(i[0],null,2)+"",F,K,y,ee="Edit Profile",Q,te,u=i[0].picture&&ae(i);return{c(){e=d("div"),l=d("h2"),t=v("Welcome, "),o=v(s),U=v("!"),k=g(),h=d("p"),S=v("Email: "),f=v(b),a=g(),u&&u.c(),_=g(),L=d("p"),W=v("Preferred Username: "),A=v(H),G=g(),M=d("p"),R=v("Mission Statement: "),B=v(j),V=g(),O=d("h3"),O.textContent=$,z=g(),T=d("pre"),F=v(w),K=g(),y=d("button"),y.textContent=ee,this.h()},l(c){e=m(c,"DIV",{class:!0});var r=x(e);l=m(r,"H2",{});var I=x(l);t=C(I,"Welcome, "),o=C(I,s),U=C(I,"!"),I.forEach(p),k=E(r),h=m(r,"P",{});var X=x(h);S=C(X,"Email: "),f=C(X,b),X.forEach(p),a=E(r),u&&u.l(r),_=E(r),L=m(r,"P",{});var Y=x(L);W=C(Y,"Preferred Username: "),A=C(Y,H),Y.forEach(p),G=E(r),M=m(r,"P",{});var Z=x(M);R=C(Z,"Mission Statement: "),B=C(Z,j),Z.forEach(p),V=E(r),O=m(r,"H3",{"data-svelte-h":!0}),D(O)!=="svelte-iel9ah"&&(O.textContent=$),z=E(r),T=m(r,"PRE",{class:!0});var le=x(T);F=C(le,w),le.forEach(p),K=E(r),y=m(r,"BUTTON",{class:!0,"data-svelte-h":!0}),D(y)!=="svelte-1psycvk"&&(y.textContent=ee),r.forEach(p),this.h()},h(){N(T,"class","svelte-1rvx8as"),N(y,"class","svelte-1rvx8as"),N(e,"class","user-info svelte-1rvx8as")},m(c,r){P(c,e,r),n(e,l),n(l,t),n(l,o),n(l,U),n(e,k),n(e,h),n(h,S),n(h,f),n(e,a),u&&u.m(e,null),n(e,_),n(e,L),n(L,W),n(L,A),n(e,G),n(e,M),n(M,R),n(M,B),n(e,V),n(e,O),n(e,z),n(e,T),n(T,F),n(e,K),n(e,y),Q||(te=re(y,"click",i[4]),Q=!0)},p(c,r){r&1&&s!==(s=(c[0].preferred_username||c[0].name||c[0].nickname||"User")+"")&&q(o,s),r&1&&b!==(b=(c[0].email||"Not provided")+"")&&q(f,b),c[0].picture?u?u.p(c,r):(u=ae(c),u.c(),u.m(e,_)):u&&(u.d(1),u=null),r&1&&H!==(H=(c[0].preferred_username||"Not set")+"")&&q(A,H),r&1&&j!==(j=(c[0].mission_statement||"Not provided")+"")&&q(B,j),r&1&&w!==(w=JSON.stringify(c[0],null,2)+"")&&q(F,w)},d(c){c&&p(e),u&&u.d(),Q=!1,te()}}}function _e(i){let e,l;return{c(){e=d("p"),l=v(i[1]),this.h()},l(t){e=m(t,"P",{class:!0});var s=x(e);l=C(s,i[1]),s.forEach(p),this.h()},h(){N(e,"class","error svelte-1rvx8as")},m(t,s){P(t,e,s),n(e,l)},p(t,s){s&2&&q(l,t[1])},d(t){t&&p(e)}}}function ve(i){let e,l="Loading user data...";return{c(){e=d("p"),e.textContent=l},l(t){e=m(t,"P",{"data-svelte-h":!0}),D(e)!=="svelte-9u4hfj"&&(e.textContent=l)},m(t,s){P(t,e,s)},p:J,d(t){t&&p(e)}}}function ae(i){let e,l;return{c(){e=d("img"),this.h()},l(t){e=m(t,"IMG",{src:!0,alt:!0,class:!0}),this.h()},h(){se(e.src,l=i[0].picture)||N(e,"src",l),N(e,"alt","User's avatar"),N(e,"class","profile-picture svelte-1rvx8as")},m(t,s){P(t,e,s)},p(t,s){s&1&&!se(e.src,l=t[0].picture)&&N(e,"src",l)},d(t){t&&p(e)}}}function Ce(i){let e,l="Dashboard",t,s,o,U="Logout",k,h;function S(a,_){return a[2]?ve:a[1]?_e:a[0]?he:me}let b=S(i),f=b(i);return{c(){e=d("h1"),e.textContent=l,t=g(),f.c(),s=g(),o=d("button"),o.textContent=U,this.h()},l(a){e=m(a,"H1",{"data-svelte-h":!0}),D(e)!=="svelte-101alym"&&(e.textContent=l),t=E(a),f.l(a),s=E(a),o=m(a,"BUTTON",{class:!0,"data-svelte-h":!0}),D(o)!=="svelte-18t49m"&&(o.textContent=U),this.h()},h(){N(o,"class","svelte-1rvx8as")},m(a,_){P(a,e,_),P(a,t,_),f.m(a,_),P(a,s,_),P(a,o,_),k||(h=re(o,"click",i[3]),k=!0)},p(a,[_]){b===(b=S(a))&&f?f.p(a,_):(f.d(1),f=b(a),f&&(f.c(),f.m(s.parentNode,s)))},i:J,o:J,d(a){a&&(p(e),p(t),p(s),p(o)),f.d(a),k=!1,h()}}}function be(i,e,l){let t=null,s=null,o=!0;ie(async()=>{try{await ce();const h=await pe();h?l(0,t=h):l(1,s="Failed to fetch user data")}catch{l(1,s="Failed to fetch user data")}finally{l(2,o=!1)}});function U(){de()}function k(){ue("/edit-profile")}return[t,s,o,U,k]}class Pe extends oe{constructor(e){super(),fe(this,e,be,Ce,ne,{})}}export{Pe as component};