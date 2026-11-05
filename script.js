/* =========================================================
   HIGHWAY Driver App — script.js
   ملف مُجمَّع من جزأين: (1) الشاشة الافتتاحية وتسجيل الدخول المشتركة
   (2) منطق تطبيق الكابتن: الاتصال والوردية، الخريطة ومناطق الطلب، العروض، مراحل التوصيل
       ورمز التسليم، الإبلاغ عن مشكلة، الأهداف، الأرباح والتسوية النقدية.
   يعتمد على: hw-config.js, hw-orders.js, hw-map.js, hw-food.js, hw-notify.js, hw-biz.js
   ========================================================= */
/* ---------- الشاشة الافتتاحية: رسومات الطعام العائمة ---------- */


function buildSplashIcons() {
    const wrap = document.getElementById('splashIcons');
    const SPL = HWFood.splashSet();   // رسومات الطعام المشتركة (hw-food.js)
    for (let i = 0; i < 18; i++) {
        const el = document.createElement('div');
        el.className = 'float-icon';
        const size = 26 + Math.random() * 34;
        el.style.width = el.style.height = size + 'px';
        el.style.left = (Math.random() * 94) + '%';
        el.style.animationDuration = (9 + Math.random() * 9) + 's';
        el.style.animationDelay = (-Math.random() * 14) + 's';
        el.innerHTML = SPL[(i * 7) % SPL.length];
        wrap.appendChild(el);
    }
}

/* ---------- فيديو الشاشة الافتتاحية بخلفية شفافة ----------
   الفيديو بلا قناة شفافية، فيُعرض عبر WebGL مع حذف لونه التركوازي لحظياً ليظهر الإطار الزجاجي من خلفه.
   لضمان عدم اختفاء اللوجو نهائياً: ننتهي دائماً بصورة اللوجو الثابتة (بنفس مقاس آخر إطار) بدل الاعتماد
   على لوحة WebGL، وننتقل إليها فوراً إذا فشل أي شيء (منع التشغيل التلقائي، فقد سياق WebGL، تأخر الفيديو). */
function initIntroVideo() {
    const video = document.getElementById('splashVideo');
    const canvas = document.getElementById('splashCanvas');
    const card = document.getElementById('splashCard');
    if (!video || !canvas || !card) return null;

    let stopped = false;
    const showStatic = () => {                 // يعرض الصورة الثابتة ويوقف الرسم والفيديو
        stopped = true;
        card.classList.add('static-logo');
        video.pause();
    };

    let gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }); } catch (e) {}
    if (!gl) { showStatic(); return { stop() {} }; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showStatic(); });

    const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER,
        'attribute vec2 p; varying vec2 uv;' +
        'void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }');
    const fs = compile(gl.FRAGMENT_SHADER,
        'precision mediump float; uniform sampler2D tex; varying vec2 uv;' +
        'const vec3 BG = vec3(33.0,204.0,208.0)/255.0;' +            // لون خلفية الفيديو
        'void main(){' +
        '  vec3 c = texture2D(tex, uv).rgb;' +
        '  float a = clamp((distance(c, BG) - 0.035) / 0.80, 0.0, 1.0);' +
        '  vec3 f = a > 0.001 ? clamp((c - (1.0 - a) * BG) / a, 0.0, 1.0) : vec3(0.0);' +
        '  gl_FragColor = vec4(f * a, a);' +                          // ألوان مضروبة مسبقاً بالشفافية
        '}');
    const prog = gl.createProgram();
    if (!vs || !fs) { showStatic(); return { stop() {} }; }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { showStatic(); return { stop() {} }; }
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const draw = () => {
        if (video.readyState < 2) return;
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); }
        catch (e) { showStatic(); return; }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    let finished = false;
    const canvasBlank = () => {                                   // هل الصف الأوسط من اللوحة فارغ؟
        if (gl.isContextLost()) return true;
        const row = new Uint8Array(canvas.width * 4);
        gl.readPixels(0, canvas.height >> 1, canvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
        for (let i = 3; i < row.length; i += 4) if (row[i] > 200) return false;
        return true;
    };
    const next = (fn) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(fn) : requestAnimationFrame(fn));
    const loop = () => { if (!stopped) { draw(); next(loop); } };

    let began = false;
    const begin = () => { if (!began && !stopped) { began = true; next(loop); } };
    video.addEventListener('playing', begin);
    video.addEventListener('ended', () => { draw(); finished = true; card.classList.add('logo-done'); });   // النهاية: يبقى آخر إطار من الفيديو معروضاً
    // عند العودة للتطبيق: إن فُرغت لوحة الرسم بصمت نعرض الصورة الثابتة (مأخوذة من آخر إطار فلا يتغير شيء)
    document.addEventListener('visibilitychange', () => { if (!document.hidden && finished && !stopped && canvasBlank()) showStatic(); });
    video.addEventListener('error', showStatic);
    if (!video.paused && video.readyState >= 3) begin();       // بدأ التشغيل التلقائي قبل تسجيل المستمعين

    video.muted = true;                                          // مطلوب ليعمل التشغيل التلقائي
    const p = video.play();
    if (p && p.catch) p.catch(showStatic);                       // التشغيل التلقائي ممنوع (مثلاً توفير الطاقة)
    setTimeout(() => { if (!began) showStatic(); }, 2000);       // لم يبدأ الفيديو خلال ثانيتين
    setTimeout(() => { if (!stopped) showStatic(); }, 9000);     // شبكة أمان إن تجمّد الفيديو قبل نهايته

    return { stop() { stopped = true; video.pause(); } };
}


/* الإطار الزجاجي يكبر ليظهر نموذج الدخول، وزر الرجوع يعيد الشاشة الافتتاحية كما كانت */
let introCtl = null;
function setLoginFocusable(on) {
    document.querySelectorAll('#loginPanel input, #loginPanel button, #loginBack').forEach(el => el.tabIndex = on ? 0 : -1);
    document.getElementById('loginPanel').setAttribute('aria-hidden', on ? 'false' : 'true');
}
function openLogin() {
    document.getElementById('splash').classList.add('login-mode');
    setLoginFocusable(true);
    if (window.matchMedia('(hover:hover)').matches) setTimeout(() => document.getElementById('loginUser').focus(), 650);
}
function closeLogin() {
    document.getElementById('splash').classList.remove('login-mode');
    setLoginFocusable(false);
    document.getElementById('loginError').textContent = '';
    ['loginUserField', 'loginPassField'].forEach(id => document.getElementById(id).classList.remove('invalid'));
    document.getElementById('loginPass').value = '';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function finishLogin() {
    document.getElementById('splash').classList.add('hide');
    if (introCtl) setTimeout(introCtl.stop, 800);
}


/* =========================================================
   Driver App — HIGHWAY Delivery
   الطلبات والعروض، الخريطة ومناطق الطلب، الوردية، رمز التسليم،
   الإبلاغ عن مشكلة، الأهداف والمكافآت، الأرباح والتسوية النقدية.
   ========================================================= */
const CFG = window.HW_CONFIG;
const KEY = 'hwk-user', SEEN_KEY = 'hwk-seen';
const $ = (id) => document.getElementById(id);
const H = HWOrders.esc, money = HWOrders.money;
const ROOTS = ['screen-jobs', 'screen-earn', 'screen-profile'];
const TAB_OF = { 'screen-jobs': 'jobs', 'screen-job': 'jobs', 'screen-earn': 'earn', 'screen-profile': 'profile' };
const settingsCol = HWDB.col('settings'), stState = HWDB.col('storestate');
/* موقع المتجر: من الطلب، وإن لم يُحفظ فيه (طلبات المطعم) نأخذه من بيانات المتجر التي تحددها الإدارة */
function sLoc(o) { if (o.storeLoc && o.storeLoc.lat != null) return o.storeLoc; const st = o.storeId && stState.get(o.storeId); return st && st.lat != null ? { lat: st.lat, lng: st.lng } : null; } let autoMode = true, actMap = null;
let me = null, orders = [], stack = ['screen-jobs'], cur = 'screen-jobs', earnRange = 'open', jobId = null, prevOffers = null, gpsWatch = null, lastGps = 0;
let seen = {}; try { seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch (e) {}
const caps = HWDB.col('captains'), issuesCol = HWDB.col('issues');
let heatOn = false;   /* مناطق الطلب مخفية افتراضيًا، يشغّلها الكابتن من زر الشعلة على الخريطة */

function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }
function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
function normPhone(v) { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('962')) d = d.slice(3); if (d.startsWith('0')) d = d.slice(1); return /^7\d{8}$/.test(d) ? '0' + d : ''; }
function money2(n) { return money(n) + ' د.أ'; }

/* ---------- التنقل ---------- */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active'); cur = id;
    document.body.classList.toggle('cap-home', id === 'screen-jobs');
    if (id !== 'screen-jobs') ['cap-off', 'cap-idle', 'cap-offer', 'cap-job'].forEach(c => document.body.classList.remove(c));
    $('headerBack').classList.toggle('show', ROOTS.indexOf(id) < 0);
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === TAB_OF[id]));
    HWHead.close(); if (id !== 'screen-jobs') HWHead.place(null);
    window.scrollTo({ top: 0, behavior: 'auto' }); render();
    if (id === 'screen-jobs' && homeMap) setTimeout(() => homeMap.invalidateSize(), 60);
}
function goTo(id) { if (stack[stack.length - 1] !== id) stack.push(id); showScreen(id); }
function goBack() { if (stack.length > 1) { stack.pop(); showScreen(stack[stack.length - 1]); } }
function tabGo(id) { buzz(); stack = id === 'screen-jobs' ? ['screen-jobs'] : ['screen-jobs', id]; showScreen(id); }

/* ---------- الدخول ---------- */
/* الكابتن يقرأ: الطلبات الجديدة (للعروض) + النشطة (لمعرفة الكباتن المشغولين) + طلباته هو (للأرباح) */
function capScope(u) { if (u && u.id) HWOrders.scope([{ by: 'status', eq: 'new' }, { by: 'status', eq: 'accepted' }, { by: 'status', eq: 'picked' }, Object.assign({ by: 'capKey' }, HWOrders.keyRange(u.id, 40))]); }
function applyUser(u) { me = u; capScope(u); document.body.classList.toggle('authed', !!u); $('appShell').inert = !u; if (u) { $('pfName').textContent = u.name; $('pfPhone').textContent = u.phone; fillAv(); HWSupport.rescope(); } else HWHead.user(null); }
/* صورة الكابتن: تختارها أو ترفعها الإدارة فقط. تظهر في الملف الشخصي وأعلى الشاشة */
function fillAv() {
    if (!me) return; const d = myDoc(), src = HWBiz.capAv(Object.assign({ id: me.id }, d));
    $('pfAv').src = src; $('pfNum').textContent = d.num || '—';
    HWHead.user({ img: src, name: me.name, role: 'كابتن HIGHWAY' + (d.num ? ' · ' + d.num : '') });
}
HWHead.init({
    app: 'captain', logout: () => logout(),
    items: [{ k: 'profile', t: 'الملف الشخصي', fn: () => tabGo('screen-profile') }, { k: 'support', t: 'الدعم', fn: () => openSupport() }],
    go: (k) => { if (/^support/.test(k)) HWSupport.open(); else tabGo('screen-jobs'); }
});
HWSupport.init({ role: 'k', me: () => me ? { uid: me.id, name: me.name, phone: me.phone, img: HWBiz.capAv(Object.assign({ id: me.id }, myDoc())) } : null });
async function submitLogin(ev) {
    ev.preventDefault();
    const err = $('loginError'); err.textContent = '';
    ['loginUserField', 'loginPassField'].forEach(i => $(i).classList.remove('invalid'));
    const phone = normPhone($('loginUser').value), pin = $('loginPass').value.trim();
    if (!phone) { $('loginUserField').classList.add('invalid'); err.textContent = 'أدخل رقم هاتف صحيح (07XXXXXXXX)'; return; }
    if (!pin) { $('loginPassField').classList.add('invalid'); err.textContent = 'أدخل الرمز السري'; return; }
    const btn = $('loginBtn'); btn.classList.add('loading');
    await caps.ready();                                  // قبل تحميل قائمة الكباتن لا نحكم على الرمز
    const hash = await HW_sha256('HWK|' + phone + '|' + pin);
    await new Promise(r => setTimeout(r, 300)); btn.classList.remove('loading');
    const c = caps.list().filter(x => x.phone === phone && x.pin === hash)[0];
    if (!c) { $('loginPassField').classList.add('invalid'); err.textContent = 'الرقم أو الرمز غير صحيح'; return; }
    if (c.active === false) { err.textContent = 'حسابك موقوف، تواصل مع الدعم'; return; }
    try { localStorage.setItem(KEY, JSON.stringify({ id: c.id, name: c.name, phone: c.phone })); } catch (e) {}
    applyUser({ id: c.id, name: c.name, phone: c.phone }); finishLogin(); render(); setTimeout(() => { ensureMap(); startGps(false); renderMapLayers(true); homeMap && homeMap.invalidateSize(); }, 700);
}
function logout() { if (me) caps.patch(me.id, { online: false }); stopGps(); try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }

/* ---------- الاتصال والموقع ---------- */
/* حساب محذوف أو موقوف أو تسجيل دخول قديم من نسخة تجريبية: لا يمكن الاتصال، فنخرجه برسالة واضحة */
let acctChecked = false;
function checkAccount() {
    if (!me || !caps.loaded() || acctChecked || !caps.list().length) return;
    const d = caps.get(me.id);
    if (d && d.active !== false && (d.name || d.phone)) return;
    acctChecked = true;
    HWOrders.toast(d && d.active === false ? 'حسابك موقوف، تواصل مع الإدارة' : 'حسابك غير موجود، سجّل الدخول من جديد');
    setTimeout(() => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }, 2500);
}
function myDoc() { return me ? caps.get(me.id) || {} : {}; }
function isOnline() { return !!myDoc().online; }
let locChecked = false;
function locDenied() { HWOrders.toast('لا يمكنك الاتصال قبل السماح بالموقع. ' + HWNative.locHelp()); if (HWNative.is) setTimeout(HWNative.openSettings, 1800); }
function setOnline(v) {
    if (!v && active()) { HWOrders.toast('أنهِ طلبك الحالي قبل إنهاء الوردية'); return; }
    if (v && !locChecked) {   /* لا اتصال بدون إذن الموقع */
        if (!navigator.geolocation) { HWOrders.toast('جهازك لا يدعم تحديد الموقع'); return; }
        navigator.geolocation.getCurrentPosition(p => { locChecked = true; myPos = [p.coords.latitude, p.coords.longitude]; myAcc = p.coords.accuracy || 0; updateMeMarker(myPos, myAcc); setOnline(true); },
            e => { if (e && e.code === 1) locDenied(); else { locChecked = true; setOnline(true); } }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 });
        return;
    }
    const start = myDoc().shiftStart;
    caps.patch(me.id, v ? { online: true, lastSeen: Date.now(), shiftStart: Date.now() } : { online: false, shiftStart: 0 }); buzz(15);
    stopGps(); startGps(false);   /* في التطبيق: يبدأ الموقع المستمر في الخلفية مع الاتصال ويتوقف مع إنهاء الوردية */
    if (v) { HWNotify.unlock(); HWNotify.play('status'); pushLoc(true); } else { HWNotify.stop('offer'); if (start) shiftSheet(start); }
    HWNotify.keepAwake(v); render();
}
/* مشاركة الموقع مع مركز العمليات إلزامية أثناء الاتصال (لا يستطيع الكابتن إخفاءها) */
const shareLoc = true; let myPos = null, myAcc = 0;
/* تتبّع موقع الكابتن: يظهر دائمًا على خريطته، ويُرسل للمنسق فقط وهو متصل */
function gotPos(lat, lng, acc) { myPos = [lat, lng]; myAcc = acc || 0; updateMeMarker(myPos, myAcc); pushLoc(false); arriveCheck(); }
function gpsDenied() { gpsWatch = null; locChecked = false; if (me && isOnline() && !active()) { caps.patch(me.id, { online: false }); render(); } locDenied(); }
function startGps(manual) {
    if (gpsWatch != null) return;
    /* التطبيق الحقيقي وهو متصل: موقع مستمر حتى والشاشة مقفلة (إشعار ثابت "أنت متصل") */
    if (HWNative.bg && me && isOnline()) { gpsWatch = HWNative.watch(p => gotPos(p.lat, p.lng, p.acc), e => { if (e === 'denied') { if (gpsWatch) gpsWatch.stop(); gpsDenied(); } }); return; }
    if (!navigator.geolocation) return;
    gpsWatch = navigator.geolocation.watchPosition(p => gotPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
    (e) => { if (e && e.code === 1) gpsDenied(); else if (manual) HWOrders.toast('تعذر الوصول إلى موقعك'); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function pushLoc(force) {
    if (!me || !myPos || !shareLoc || !isOnline()) return;
    const job = active();
    if (!force && Date.now() - lastGps < (job ? 8000 : 15000)) return; lastGps = Date.now();
    caps.patch(me.id, { lat: myPos[0], lng: myPos[1], lastSeen: Date.now() });
    /* التتبّع الحي: موقع الكابتن يُكتب على طلبه النشط؛ المطعم والعميل يريان وقت الوصول، وأيقونته على خريطة العميل بعد الاستلام فقط، فيراه صاحب الطلب وحده ويختفي بعد التسليم */
    if (job) HWOrders.patchLite(job.id, { capLoc: { lat: +myPos[0].toFixed(6), lng: +myPos[1].toFixed(6), at: Date.now() } });
}
/* التطبيق الحقيقي: الموقع المستمر يعمل ما دام الكابتن متصلًا (حتى بعد إعادة فتح التطبيق) */
function syncGpsMode() { if (!HWNative.bg || !me) return; const nat = gpsWatch != null && typeof gpsWatch === 'object'; if (isOnline() !== nat) { stopGps(); startGps(false); } }
function stopGps() { if (gpsWatch != null) { if (typeof gpsWatch === 'object' && gpsWatch.stop) gpsWatch.stop(); else navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; } }
setInterval(() => { if (me && isOnline()) caps.patch(me.id, { lastSeen: Date.now() }); }, 30000);
/* أثناء المهمة: يُحدَّث الموقع على الطلب كل 15 ثانية حتى لو لم يتحرك الكابتن، فيبقى وقت الوصول ظاهرًا للمطعم والعميل */
setInterval(() => { const j = me && isOnline() && active(); if (!j) return; if (!j.capLoc || Date.now() - (j.capLoc.at || 0) > 14000) pushLoc(true); }, 5000);

/* ---------- العروض ---------- */
function mineOrders() { return orders.filter(o => o.captain && o.captain.id === me.id); }
function active() { return mineOrders().filter(o => o.status === 'accepted' || o.status === 'picked').sort((a, b) => a.createdAt - b.createdAt)[0]; }
function offers() {
    if (!me || !isOnline() || overLimit()) return [];
    const now = Date.now(), lim = (CFG.offerSeconds || 45) * 1000, dec = myDoc().declined || [];
    return orders.filter(o => HWOrders.offerable(o)).filter(o => {
        if (o.offerTo === me.id) return now - (o.offerAt || 0) < lim;          /* عرض موجّه لي (حتى لو رفضته في دورة سابقة) */
        if (o.offerTo || !autoMode || dec.indexOf(o.id) >= 0) return false;    /* موجّه لغيري، أو الوضع يدوي، أو رفضته */
        return now - (o.createdAt || 0) > 90000 && (o.offered || []).indexOf(me.id) < 0;   /* احتياط: لم يتصرف أحد فيعرض للجميع */
    });
}
/* الإسناد التلقائي من جهة الكابتن أيضًا: إن لم تكن لوحة المنسقين مفتوحة، يحسب كل تطبيق
   ترتيب الكباتن المتاحين بنفس قاعدة اللوحة (الأقرب للمتجر ثم الأقدم انتظارًا)، ويأخذ العرض إن كان هو الأول */
/* متاح: متصل وظاهر حديثًا، أو مفعّل الإشعارات (تصله العروض والتطبيق مغلق) خلال 12 ساعة */
function capLive(c) { const age = Date.now() - (c.lastSeen || 0), push = !!(CFG.push && CFG.push.server && c.pushOn); return c.active !== false && c.online && (!c.lastSeen || age < 120000 || (push && age < 12 * 3600e3)); }
function selfDispatch() {
    if (!me || !autoMode || !isOnline() || active() || overLimit()) return;
    const now = Date.now(), lim = (CFG.offerSeconds || 45) * 1000, all = caps.list();
    const busy = {}, pend = {};
    orders.forEach(o => {
        if (o.captain && o.captain.id && (o.status === 'accepted' || o.status === 'picked')) busy[o.captain.id] = 1;
        if (o.offerTo && HWOrders.offerable(o) && now - (o.offerAt || 0) < lim + 2000) pend[o.offerTo] = o.id;
    });
    if (pend[me.id]) return;
    const dist = (c, o) => { const l = sLoc(o); return c.lat != null && l ? HWMap.est([c.lat, c.lng], [l.lat, l.lng]) : null; };
    orders.filter(o => HWOrders.offerable(o)).sort((a, b) => a.createdAt - b.createdAt).some(o => {
        if (o.offerTo && now - (o.offerAt || 0) < lim + 2000) return false;
        let offered = (o.offered || []).slice(); if (o.offerTo && offered.indexOf(o.offerTo) < 0) offered.push(o.offerTo);
        const free = all.filter(c => capLive(c) && !c.overLimit && !busy[c.id] && !pend[c.id]);
        if (free.length && free.every(c => offered.indexOf(c.id) >= 0)) {           /* عُرض على الجميع: دورة جديدة (مثل لوحة الإدارة) */
            if (o.declinedAt && now - o.declinedAt < 30000) return false;              /* رُفض للتو: مهلة قصيرة قبل إعادة العرض */
            offered = [];
        }
        const cands = free.filter(c => offered.indexOf(c.id) < 0).sort((a, b) => {
            const da = dist(a, o), db = dist(b, o);
            if (da != null && db != null) return da - db; if (da != null) return -1; if (db != null) return 1; return (a.lastSeen || 0) - (b.lastSeen || 0);
        });
        if (!cands.length || cands[0].id !== me.id) return false;
        const d = dist(cands[0], o);
        HWOrders.update(o.id, { offerTo: me.id, offerAt: now, offered: offered.concat([me.id]), offerName: me.name, offerKm: d == null ? null : Math.round(d * 10) / 10 }, 'offer_sent');
        return true;
    });
}
setInterval(() => { try { selfDispatch(); } catch (e) {} }, 4000);
function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {} }
async function takeOffer(id) {
    if (active()) { HWOrders.toast('أنهِ طلبك الحالي أولًا'); return; }
    buzz(20);
    const d = myDoc(), ok = await HWOrders.claim(id, { id: me.id, num: d.num, name: me.name, phone: me.phone, av: d.av, pv: d.pv });   /* صورته تظهر للعميل والمطعم */
    if (ok) { HWOrders.toast('✓ الطلب لك، توجه للمتجر'); jobId = id; render(); } else { HWOrders.toast('سبقك كابتن آخر لهذا الطلب'); render(); }
}
function declineOffer(id) { const o = HWOrders.get(id); if (o && o.offerTo === me.id) HWOrders.update(id, { offerTo: null, offerAt: 0, declinedAt: Date.now(), offered: (o.offered || []).concat([me.id]) }); const d = (myDoc().declined || []).concat([id]).slice(-50); caps.patch(me.id, { declined: d }); buzz(); }
function earnOf(o) { const s = HWOrders.settle(o); return s.net; }


/* ---------- العرض ---------- */
function navTarget(o) {
    if (o.status === 'picked') {
        if (o.address && o.address.lat) return o.address.lat + ',' + o.address.lng;
        return ((o.address && o.address.details) || '') + ' ' + ((o.address && o.address.area) || o.to || '');
    }
    const sl = sLoc(o); if (sl) return sl.lat + ',' + sl.lng;
    const sd = o.storeId ? HWBiz.storeById(o.storeId) : null;   /* المتجر بلا موقع على الخريطة: نبحث باسمه وعنوانه */
    return [o.storeName || o.from || '', o.storeAddr || (sd && sd.addr) || 'السلط'].join(' ');
}
function nextStep(o) {
    if (o.status === 'accepted') return o.arrivedStore ? { k: 'pick', t: 'استلمت الطلب من المتجر' } : { k: 'arrS', t: 'وصلت للمتجر' };
    if (o.status === 'picked') return o.arrivedCustomer ? { k: 'done', t: 'تم التسليم وتحصيل المبلغ' } : { k: 'arrC', t: 'وصلت للعميل' };
    return null;
}
function activeCard(o) {
    const s = HWOrders.settle(o), st = nextStep(o), mk = HWOrders.isMarket(o), toStore = o.status === 'accepted';
    const sd = toStore && o.storeId ? HWBiz.storeById(o.storeId) : null;
    const phone = toStore ? o.storePhone || (sd && sd.phone) || '' : (o.customer && o.customer.phone) || o.phone || '';
    return '<div class="act-card"><small>' + H(o.code) + ' · ' + (toStore ? 'في الطريق للمتجر' : 'في الطريق للعميل') + '</small>' +
        '<h2>' + (toStore ? H(o.storeName || o.from || '') : H((o.customer && o.customer.name) || o.to || 'العميل')) + '</h2>' +
        '<div class="act-info">' +
        (toStore ? (mk ? '<div><span>تدفعه للمتجر نقدًا</span><b>' + money2(s.items) + '</b></div><div><span>حالة المتجر</span><b>' + (o.storeState === 'ready' ? 'جاهز ✓' : 'قيد التحضير') + '</b></div>' : '<div><span>من</span><b>' + H(o.from || '') + '</b></div>')
            : '<div><span>العنوان</span><b>' + H(((o.address && (o.address.label || o.address.area)) || o.to || '') + (o.address && o.address.details ? ' · ' + o.address.details : '')) + '</b></div>' + (o.address && o.address.note ? '<div class="drop-note"><span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8M8 12h5"/></svg> تعليمات العميل</span><b>' + H(o.address.note) + '</b></div>' : '') + (mk ? '<div><span>تحصّل من العميل</span><b>' + money2(s.collected) + '</b></div>' : '')) + '</div>' +
        '<div class="act-btns"><a href="' + H(navUrl(o)) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg> افتح الخريطة</a>' + (phone ? '<a href="tel:' + H(phone) + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg> ' + (toStore ? 'اتصل بالمتجر' : 'اتصال') + '</a>' : '') + '<button type="button" onclick="openJob(\'' + o.id + '\')">' + CI.list + 'التفاصيل</button></div>' +
        (st ? '<button type="button" class="submit-btn" style="margin-top:12px" data-step="' + st.k + '" data-id="' + o.id + '"><span class="btn-label">' + st.t + '</span></button>' : '') + '</div>';
}
function stepAction(k, id) {
    const o = HWOrders.get(id); if (!o) return; buzz(18);
    const s = HWOrders.settle(o);
    if (k === 'arrS') HWOrders.update(id, { arrivedStore: true }, 'arrived_store');
    else if (k === 'arrC') HWOrders.update(id, { arrivedCustomer: true }, 'arrived_customer');
    else if (k === 'pick') {
        if (HWOrders.isMarket(o)) sheet('<div class="sh-head"><div><small>' + H(o.code) + '</small><h3>ادفع للمتجر</h3></div></div><div class="pay-big"><div class="big">' + money(s.items) + ' د.أ</div><p class="mut">ادفع هذا المبلغ نقدًا لـ ' + H(o.storeName) + ' واستلم الطلب' + (o.storeState !== 'ready' ? '<br><b style="color:var(--danger)">تنبيه: المتجر لم يؤكد أن الطلب جاهز</b>' : '') + '</p></div><button type="button" class="submit-btn" onclick="confirmPick(\'' + id + '\')"><span class="btn-label">دفعت واستلمت</span></button>');
        else confirmPick(id);
    } else if (k === 'done') {
        if (HWOrders.isMarket(o)) sheet('<div class="sh-head"><div><small>' + H(o.code) + '</small><h3>حصّل من العميل</h3></div></div><div class="pay-big"><div class="big">' + money(s.collected) + ' د.أ</div><p class="mut">المنتجات ' + money(s.items) + ' + التوصيل ' + money(s.fee) + (s.promo ? ' − كود خصم ' + money(s.promo) : '') + '</p></div>' +
            (o.pin ? '<div class="pin-in"><label for="pinIn">رمز التسليم من العميل</label><input id="pinIn" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="• • • •" dir="ltr"><small class="mut">يظهر الرمز في تطبيق العميل</small></div>' : '') +
            '<button type="button" class="submit-btn" onclick="confirmDone(\'' + id + '\')"><span class="btn-label">استلمت المبلغ وسلّمت الطلب</span></button>' +
            (o.pin ? '<button type="button" class="more-link" style="margin-top:10px" onclick="noPin(\'' + id + '\')">العميل لا يملك الرمز</button>' : '') +
            '<button type="button" class="more-link" style="margin-top:6px" onclick="noAnswer(\'' + id + '\')">العميل لا يرد؟</button>');
        else confirmDone(id);
    }
}
function confirmPick(id) { closeSheet(); HWOrders.update(id, { status: 'picked', pickedPaid: true }); }
function confirmDone(id, skipPin) {
    const o = HWOrders.get(id); if (!o) return;
    if (o.pin && HWOrders.isMarket(o) && !skipPin) {
        const v = ($('pinIn').value || '').replace(/\D/g, '');
        if (v !== String(o.pin)) { $('pinIn').classList.add('bad'); HWOrders.toast('الرمز غير صحيح، اطلبه من العميل'); buzz(40); return; }
    }
    closeSheet(); HWOrders.update(id, { status: 'delivered', cashCollected: true, pinOk: !skipPin }); HWOrders.toast('✓ تم التسليم، أحسنت!'); jobId = null; if (cur === 'screen-job') goBack();
}
function noPin(id) {                                   // التسليم بدون رمز يُسجَّل كبلاغ لمراجعة الإدارة
    if (!confirm('تأكيد التسليم بدون رمز؟ سيُسجَّل ذلك لمراجعة الإدارة.')) return;
    reportIssue(id, 'تسليم بدون رمز', ''); confirmDone(id, true);
}

/* ---------- العميل لا يرد عند الباب ----------
   الكابتن يصوّر الطلب عند الباب كإثبات وصول، وبعد 5 دقائق من وصوله يستطيع تسجيل "لم يستلم".
   يُلغى الطلب، ويُرفع بلاغ للإدارة (لتعويض ما دفعه الكابتن للمطعم)، ويُسجَّل على رقم العميل */
const NOSHOW_WAIT = 5 * 60000;
function arrivedAt(o) { const h = (o.history || []).filter(x => x.s === 'arrived_customer')[0]; return h ? h.t : (o.arrivedCustomer ? o.updatedAt : 0); }
function noAnswer(id) {
    const o = HWOrders.get(id); if (!o) return;
    const left = Math.max(0, NOSHOW_WAIT - (Date.now() - (arrivedAt(o) || Date.now())));
    sheet('<div class="sh-head"><div><small>' + H(o.code) + '</small><h3>العميل لا يرد</h3></div></div>' +
        '<ol class="ns-steps"><li>اتصل بالعميل أكثر من مرة' + (o.customer && o.customer.phone ? ' <a href="tel:' + H(o.customer.phone) + '">اتصال</a>' : '') + '</li><li>صوّر الطلب عند الباب كإثبات وصولك</li><li>انتظر 5 دقائق من وصولك، ثم سجّل عدم الاستلام</li></ol>' +
        '<div class="ns-photo" id="nsPhoto">' + (o.podAt ? '<span>✓ تم حفظ صورة الإثبات</span>' : '') + '</div>' +
        '<label class="ghost-btn wide file-btn">' + (o.podAt ? 'إعادة التصوير' : 'صوّر الطلب عند الباب') + '<input type="file" accept="image/*" capture="environment" onchange="podPhoto(\'' + id + '\',this.files[0])"></label>' +
        '<button type="button" class="submit-btn dng" id="nsBtn" style="margin-top:10px" onclick="markNoShow(\'' + id + '\')"' + (left || !o.podAt ? ' disabled' : '') + '><span class="btn-label">' + (left ? 'يمكنك التسجيل بعد ' + Math.ceil(left / 60000) + ' د' : 'العميل لم يستلم الطلب') + '</span></button>');
}
function podPhoto(id, file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
        const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        HWBiz.putDoc('pod', id, { data: c.toDataURL('image/jpeg', .6), at: Date.now(), by: me.id }).then(() => { HWOrders.update(id, { podAt: Date.now() }, 'pod_photo'); HWOrders.toast('تم حفظ صورة الإثبات'); noAnswer(id); });
    }; im.src = fr.result; };
    fr.readAsDataURL(file);
}
function markNoShow(id) {
    const o = HWOrders.get(id); if (!o || !o.podAt) return;
    if (Date.now() - (arrivedAt(o) || 0) < NOSHOW_WAIT) { HWOrders.toast('انتظر 5 دقائق من وصولك'); return; }
    if (!confirm('تأكيد أن العميل لم يستلم الطلب؟ سيُلغى الطلب ويُبلَّغ الدعم.')) return;
    closeSheet();
    HWOrders.update(id, { status: 'cancelled', noShow: true, cancelReason: 'تعذر التسليم: لم يرد العميل عند الباب' }, 'no_show');
    reportIssue(id, 'العميل لم يستلم', 'صورة الإثبات محفوظة · دفع للمطعم ' + money(HWOrders.settle(o).items) + ' د.أ');
    const ph = o.customer && o.customer.phone;
    if (ph) HWBiz.myRecord(ph).then(r => HWBiz.customers.patch(String(ph), Object.assign({}, r, { name: o.customer.name || r.name || '', noShows: (r.noShows || 0) + 1, lastNoShow: Date.now(), devs: [...new Set((r.devs || []).concat(o.dev ? [o.dev] : []))] }), true));
    jobId = null; if (cur === 'screen-job') goBack(); render();
}

/* ---------- الإبلاغ عن مشكلة (تصل للوحة الإدارة) ---------- */
const ISSUES = ['المتجر مغلق أو لا يرد', 'تأخر تحضير الطلب', 'العميل لا يرد', 'العنوان غير صحيح', 'عطل أو حادث في الطريق', 'أخرى'];
function openIssue(id) {
    const o = HWOrders.get(id); if (!o) return;
    sheet('<div class="sh-head"><div><small>' + H(o.code) + '</small><h3>ما المشكلة؟</h3></div></div><div class="iss">' + ISSUES.map((r, i) => '<button type="button" class="chip" data-iss="' + i + '">' + r + '</button>').join('') + '</div>' +
        '<div class="field"><label for="issNote">تفاصيل <span class="opt">(اختياري)</span></label><textarea id="issNote" rows="2"></textarea></div>' +
        '<button type="button" class="submit-btn" onclick="sendIssue(\'' + id + '\')"><span class="btn-label">إرسال للإدارة</span></button>' +
        '<button type="button" class="ghost-btn wide" style="margin-top:8px" onclick="closeSheet();HWSupport.open({order:\'' + H(o.code) + '\'})">راسل الدعم</button>');
}
function sendIssue(id) {
    const on = document.querySelector('.iss .chip.on'); if (!on) { HWOrders.toast('اختر نوع المشكلة'); return; }
    reportIssue(id, ISSUES[+on.dataset.iss], ($('issNote').value || '').trim()); closeSheet(); HWOrders.toast('تم إبلاغ الإدارة، سنتواصل معك'); buzz(20);
}
function reportIssue(id, reason, note) {
    const o = HWOrders.get(id) || {};
    issuesCol.create({ orderId: id, code: o.code || '', storeName: o.storeName || '', captain: { id: me.id, name: me.name, phone: me.phone }, reason, note, at: Date.now(), status: 'open' });
    HWOrders.update(id, { hasIssue: true }, 'issue');
}

/* ---------- الوردية ---------- */
function shiftStats(from) {
    const l = mineOrders().filter(o => o.status === 'delivered' && (o.updatedAt || o.createdAt) >= from);
    return l.reduce((a, o) => { const s = HWOrders.settle(o); a.n++; a.net += s.net; a.col += s.collected; a.due += s.due; a.km += Number(o.distKm) || 0; return a; }, { n: 0, net: 0, col: 0, due: 0, km: 0 });
}
function dur(ms) { const m = Math.max(0, Math.round(ms / 60000)); return (m >= 60 ? Math.floor(m / 60) + ' س ' : '') + (m % 60) + ' د'; }
function shiftSheet(start) {
    const t = shiftStats(start);
    sheet('<div class="sh-head"><div><small>انتهت ورديتك</small><h3>ملخص الوردية</h3></div></div><div class="eg-grid">' +
        '<div class="eg hi"><small>صافي أرباح الوردية</small><b>' + money2(t.net) + '</b></div><div class="eg"><small>المدة</small><b>' + dur(Date.now() - start) + '</b></div>' +
        '<div class="eg"><small>طلبات مسلّمة</small><b>' + t.n + '</b></div><div class="eg"><small>المسافة</small><b>' + t.km.toFixed(1) + ' كم</b></div>' +
        '<div class="eg warn" style="grid-column:1/-1"><small>' + (t.due < 0 ? 'لك عند المنصة (أكواد خصم العملاء)' : 'المستحق للمنصة من هذه الوردية') + '</small><b>' + money2(Math.abs(t.due)) + '</b></div></div>' +
        '<button type="button" class="submit-btn" onclick="closeSheet()"><span class="btn-label">تم</span></button>');
}
/* ---------- الأهداف والمكافآت (تضعها الإدارة) ---------- */
function targetsBox() {
    const done = mineOrders().filter(o => o.status === 'delivered' && HWOrders.isToday(o.updatedAt || o.createdAt)).length;
    return HWBiz.todayTargets().map(t => { const p = Math.min(100, Math.round(done / t.count * 100)), ok = done >= t.count;
        return '<div class="tgt' + (ok ? ' ok' : '') + '"><div class="tgt-t"><b>' + H(t.title || ('أكمل ' + t.count + ' طلبات اليوم')) + '</b><span>' + (ok ? 'تم ✓ ' : '') + 'مكافأة ' + money(t.bonus) + ' د.أ</span></div><div class="tgt-bar"><i style="width:' + p + '%"></i></div><small>' + Math.min(done, t.count) + ' من ' + t.count + ' طلبات</small></div>'; }).join('');
}
function annBox() { return HWBiz.announcements('drivers').slice(0, 2).map(a => '<div class="ann-k"><b>' + H(a.title) + '</b>' + (a.body ? '<small>' + H(a.body) + '</small>' : '') + '</div>').join(''); }
/* ---------- مناطق الطلب: أين تتركز الطلبات في آخر ٣ ساعات ---------- */
function heatSpots() {
    const since = Date.now() - 3 * 3600e3, cells = {};
    orders.filter(o => o.createdAt > since && sLoc(o)).forEach(o => {
        const l = sLoc(o), k = (Math.round(l.lat * 100) / 100) + ',' + (Math.round(l.lng * 100) / 100);
        cells[k] = (cells[k] || 0) + 1;
    });
    return Object.keys(cells).map(k => { const p = k.split(',').map(Number); return { p, n: cells[k] }; });
}
function toggleHeat() { heatOn = !heatOn; buzz(); mapSig = ''; renderMapLayers(true); const b = $('heatBtn'); if (b) { b.classList.toggle('on', heatOn); b.setAttribute('aria-pressed', String(heatOn)); } HWOrders.toast(heatOn ? 'مناطق الطلب ظاهرة: الأصفر حيث تتركز الطلبات' : 'أُخفيت مناطق الطلب'); }
function sheet(h) { $('sheetBody').innerHTML = h; $('sheet').classList.add('show'); }
function closeSheet() { $('sheet').classList.remove('show'); }
function openJob(id) { jobId = id; goTo('screen-job'); }

/* خريطة الصفحة الرئيسية: موقعي بالضبط + الطلب الحالي أو العروض القريبة */
let homeMap = null, meMk = null, accMk = null, ordLayer = null, mapSig = '', followMe = true;
function ensureMap() {
    if (homeMap || !window.HWMap) return;
    const d = myDoc(), start = myPos || (d.lat != null ? [d.lat, d.lng] : HWMap.center());
    homeMap = HWMap.create($('actMapEl'), { center: start, zoom: 15 });
    ordLayer = L.layerGroup().addTo(homeMap);
    homeMap.on('dragstart', () => { followMe = false; });
}
function updateMeMarker(pos, acc) {
    if (!homeMap) return;
    if (!meMk) { meMk = L.marker(pos, { icon: HWMap.ICON.me(), interactive: false, zIndexOffset: 800 }).addTo(homeMap); accMk = L.circle(pos, { radius: acc || 0, color: '#25CED1', weight: 1, opacity: .5, fillColor: '#25CED1', fillOpacity: .12, interactive: false }).addTo(homeMap); }
    else { meMk.setLatLng(pos); accMk.setLatLng(pos); accMk.setRadius(acc || 0); }
    if (followMe && (!mapSig || mapSig[0] === 'i' || mapSig[0] === 'x')) centerMe(Math.max(homeMap.getZoom(), 15));
}
function recenter() { if (!homeMap) return; followMe = true; mapSig = ''; renderMapLayers(true); if (myPos) centerMe(16); else startGps(true); buzz(); }
function renderMapLayers(force) {
    ensureMap(); if (!homeMap) return;
    const a = active(), of = a ? [] : offers(), o = of[offerIdx] || of[0], idle = !a && !o && isOnline();
    const sig = (a ? 'a' + a.id + a.status + (sLoc(a) ? 'L' : '') : o ? 'o' + o.id + (sLoc(o) ? 'L' : '') : idle ? 'i' : 'x') + (heatOn ? '|h' : '');
    if (!force && sig === mapSig) return; mapSig = sig; ordLayer.clearLayers();
    const pts = myPos ? [myPos] : [], job = a || o, jsl = job && sLoc(job);
    if (job) {
        const sl = jsl ? [jsl.lat, jsl.lng] : null, dl = job.address && job.address.lat != null ? [job.address.lat, job.address.lng] : null;
        /* من موقعي إلى المطعم: خط منقط (قبل الاستلام) */
        if (myPos && sl && (!a || a.status === 'accepted')) L.polyline([myPos, sl], { color: '#0E3A3B', weight: 4, opacity: .8, dashArray: '2 10', lineCap: 'round', interactive: false }).addTo(ordLayer);
        if (sl && dl) ordLayer.addLayer(HWMap.line(homeMap, job.route || [sl, dl]));
        if (sl) { L.marker(sl, { icon: HWMap.ICON.store(job.storeId || ''), interactive: false }).addTo(ordLayer); pts.push(sl); }
        if (dl) { L.marker(dl, { icon: HWMap.ICON.home(), interactive: false }).addTo(ordLayer); pts.push(dl); }
    } else if (idle) {
        /* لا تظهر المطاعم إلا مع طلب متاح منها؛ وقت الانتظار تظهر مناطق الطلب فقط عند تشغيلها */
        if (heatOn) heatSpots().forEach(h => L.circle(h.p, { radius: 350 + h.n * 90, stroke: false, fillColor: '#E8EF44', fillOpacity: Math.min(.6, .2 + h.n * .1), interactive: false }).addTo(ordLayer));
    }
    /* البطاقة السفلية تغطي جزءًا من الخريطة: نضبط العرض على الجزء الظاهر فوقها */
    const sh = ($('cmSheet') && $('cmSheet').offsetHeight) || 300;
    homeMap.invalidateSize();
    if (job && pts.length > 1) { followMe = false; homeMap.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 120], paddingBottomRight: [40, sh + 30], maxZoom: 16, animate: false }); }
    else if (myPos) { followMe = true; centerMe(15); }
}
function centerMe(z) {
    if (!homeMap || !myPos) return;
    const sh = ($('cmSheet') && $('cmSheet').offsetHeight) || 300;
    homeMap.setView(myPos, z || homeMap.getZoom(), { animate: false }); homeMap.panBy([0, sh / 2 - 30], { animate: false });
}
/* =========================================================
   الشاشة الرئيسية للكابتن: الخريطة أولًا وتحتها بطاقة حسب الحالة
   off (غير متصل) · idle (بانتظار طلب) · offer (طلب جديد) · job (مهمة جارية)
   أثناء العرض والمهمة يختفي الشريط السفلي حتى يركّز الكابتن
   ========================================================= */
let offerIdx = 0;
const SV = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 20) + '" height="' + (w || 20) + '" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const CI = {
    store: SV('<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18"/>'), user: SV('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    nav: SV('<path d="m3 11 18-8-8 18-2-8-8-2Z"/>', 18), phone: SV('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>', 18),
    bell: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6Zm-2 17a2 2 0 0 0 4 0Z"/></svg>',
    radar: SV('<circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>', 24),
    list: SV('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 18),
    info: SV('<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>', 18), warn: SV('<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>', 18)
};
const kmMin = km => Math.max(1, Math.round(km / ((CFG.capKmh || 25) / 60)));
function capMode() { const on = isOnline(), a = active(); return a ? 'job' : !on ? 'off' : offers().length ? 'offer' : 'idle'; }   /* طلب مسند له يظهر دائمًا، حتى لو كان غير متصل */
function renderJobs() {
    const on = isOnline(), a = active(), ofs = on && !a ? offers() : [], mode = capMode();
    if (offerIdx >= ofs.length) offerIdx = 0;
    const B = document.body;
    ['off', 'idle', 'offer', 'job'].forEach(m => B.classList.toggle('cap-' + m, mode === m));
    $('hdrSub').textContent = on ? 'متصل · ' + me.name.split(' ')[0] : 'غير متصل';
    const o = ofs[offerIdx];
    $('cmTop').innerHTML = mode === 'offer'
        ? '<div class="cm-new"><i></i><span class="bell">' + CI.bell + '</span>طلب جديد' + (ofs.length > 1 ? ' <button type="button" class="cm-next" onclick="offerIdx++;render()">' + (offerIdx + 1) + ' من ' + ofs.length + ' ‹</button>' : '') + '</div><button type="button" class="cm-dec" data-dec="' + H(o.id) + '">رفض</button>'
        : '<button type="button" class="cm-on' + (on ? ' on' : '') + '" onclick="setOnline(' + (!on) + ')" aria-label="تبديل الاتصال"><span class="tg"></span>' + (on ? 'متصل' : 'غير متصل') + '</button>' +
          '<span class="cm-sp"></span>';
    /* الجرس والصورة أعلى الخريطة (الهيدر مخفي في هذه الشاشة)؛ أثناء عرض طلب جديد تختفي حتى يركّز الكابتن */
    if (mode !== 'offer' && cur === 'screen-jobs') HWHead.place($('cmTop')); else HWHead.place(null);
    const hb = $('heatBtn'); if (hb) hb.classList.toggle('on', heatOn);
    $('cmSheet').innerHTML = '<div class="cm-grab"></div>' + (mode === 'off' ? offSheet() : mode === 'idle' ? idleSheet() : mode === 'offer' ? offerSheet(o) : jobSheet(a));
    document.documentElement.style.setProperty('--cm-h', $('cmSheet').offsetHeight + 'px');
    renderMapLayers(false);
    const n = ofs.length + (a ? 1 : 0), b = $('tabBadge'); b.textContent = n; b.classList.toggle('on', n > 0);
}
/* سطر التسوية النقدية: المستحق للشركة الآن */
function dueLine() {
    const due = dueNow(), lim = cashLimit();
    if (due <= lim) return '';   /* المستحق يظهر في «أرباحي» فقط؛ هنا تنبيه عند تجاوز الحد لأنه يوقف العروض */
    return '<button type="button" class="cm-due' + (due > lim ? ' over' : '') + '" onclick="tabGo(\'screen-earn\')">' + (due > lim ? CI.warn : CI.info) +
        '<span>' + (due > lim ? 'عليك ' + money(due) + ' د.أ للشركة. سوِّها لتستقبل طلبات جديدة' : 'المستحق للشركة ' + money(due) + ' د.أ') + '</span><b>التفاصيل</b></button>';
}
function todayStats() { const d0 = new Date(); d0.setHours(0, 0, 0, 0); return shiftStats(d0.getTime()); }
function offSheet() {
    const t = todayStats();
    /* زر واحد للوردية: مفتاح "متصل" أعلى الشاشة */
    return '<div class="cm-wait"><span class="cm-pulse off">' + CI.radar + '</span><div><b>أنت غير متصل</b><small>شغّل «متصل» في الأعلى لتصلك الطلبات القريبة منك</small></div></div>' +
        '<div class="cm-stats two"><div><small>ربح اليوم</small><b>' + money(t.net) + '</b></div><div><small>طلبات اليوم</small><b>' + t.n + '</b></div></div>' + dueLine();
}
function idleSheet() {
    const d = myDoc(), t = shiftStats(d.shiftStart || Date.now());
    return annBox() + dueLine() +
        '<div class="cm-wait"><span class="cm-pulse">' + CI.radar + '</span><div><b>' + (overLimit() ? 'العروض متوقفة مؤقتًا' : 'بانتظار طلب جديد') + '</b><small>' + (overLimit() ? 'سوِّ المستحق للشركة لتعود العروض' : 'ستصلك الطلبات القريبة منك هنا مع رنين') + '</small></div></div>' +
        '<div class="cm-stats"><div class="hi"><small>ربح الوردية</small><b>' + money(t.net) + '</b></div><div><small>طلبات</small><b>' + t.n + '</b></div><div><small>ورديتك</small><b>' + dur(Date.now() - (d.shiftStart || Date.now())) + '</b></div></div>' +
        targetsBox();
}
function offerSheet(o) {
    const s = HWOrders.settle(o), mk = HWOrders.isMarket(o), sl = sLoc(o);
    const pk = myPos && sl ? HWMap.est(myPos, [sl.lat, sl.lng]) : (o.offerKm != null ? o.offerKm : null);
    const dk = o.distKm != null ? Number(o.distKm) : null, lim = (CFG.offerSeconds || 45) * 1000, t0 = o.offerTo === me.id ? o.offerAt : seen[o.id];
    const left = Math.max(0, Math.ceil((lim - (Date.now() - (t0 || Date.now()))) / 1000));
    return (!s.fee && !HWOrders.isMarket(o) ? '<div class="cm-earn tbd"><b>تحدد لاحقًا</b><p>أجرة هذا الطلب تحددها الإدارة وتظهر في أرباحك فور تسعيره</p></div>' : '<div class="cm-earn"><b dir="ltr">' + money(s.net) + '<small>د.أ</small></b><p>ربحك من هذا الطلب' + (s.surge ? ' (شامل ' + money(s.surge) + ' رسوم ذروة)' : '') + '</p></div>') +
        '<div class="cm-rows"><div class="cm-row"><span class="ic">' + CI.store + '</span><div class="t"><small>الاستلام</small><b>' + H(o.storeName || o.from || '') + '</b></div><span class="km">' + (pk != null ? pk.toFixed(1) + ' كم · ' + kmMin(pk) + ' د' : '') + '</span></div>' +
        '<div class="cm-row"><span class="ic c">' + CI.user + '</span><div class="t"><small>التسليم</small><b>' + H((o.address && (o.address.label || o.address.area)) || o.to || '') + '</b></div><span class="km">' + (dk != null ? dk.toFixed(1) + ' كم · ' + (o.routeMin || kmMin(dk)) + ' د' : '') + '</span></div></div>' +
        (mk ? '<div class="cm-cash"><span>تدفع للمطعم <b>' + money(s.items) + '</b></span><span>تحصّل من العميل <b>' + money(s.collected) + '</b></span></div>' : '') +
        '<button type="button" class="cm-acc" data-take="' + H(o.id) + '" data-t0="' + (t0 || Date.now()) + '"><i class="fill" style="width:' + (100 * left / (lim / 1000)) + '%"></i><span>قبول الطلب</span><em>' + left + ' ث</em></button>';
}
function jobSheet(o) {
    const s = HWOrders.settle(o), st = nextStep(o), mk = HWOrders.isMarket(o), toStore = o.status === 'accepted';
    const sd = toStore && o.storeId ? HWBiz.storeById(o.storeId) : null;
    const phone = toStore ? o.storePhone || (sd && sd.phone) || '' : (o.customer && o.customer.phone) || o.phone || '';
    const tg = toStore ? sLoc(o) : (o.address && o.address.lat != null ? o.address : null), km = myPos && tg ? HWMap.est(myPos, [tg.lat, tg.lng]) : null;
    const who = toStore ? (o.storeName || o.from || '') : ((o.customer && o.customer.name) || 'العميل');
    const sub = toStore ? (o.storeState === 'ready' ? 'الطلب جاهز للاستلام' : 'الطلب قيد التحضير') : H(((o.address && (o.address.label || o.address.area)) || o.to || '') + (o.address && o.address.details ? ' · ' + o.address.details : ''));
    return '<div class="cm-job"><span class="av">' + (toStore && o.storeId ? '<img src="' + H(HWBiz.logo(o.storeId)) + '" alt="">' : CI.user) + '</span><div class="t"><small>' + H(o.code) + '</small><b>توجّه إلى ' + H(who) + '</b><small>' + sub + '</small></div>' +
        (km != null ? '<span class="eta">' + kmMin(km) + '<small> ' + (HWI18n.lang === 'en' ? 'min' : 'د') + '</small></span>' : '') + '</div>' +
        (!toStore && o.address && o.address.note ? '<div class="drop-note"><span>' + CI.info + ' تعليمات العميل</span><b>' + H(o.address.note) + '</b></div>' : '') +
        (mk ? '<div class="cm-cash">' + (toStore ? '<span>تدفع للمطعم <b>' + money(s.items) + '</b></span>' : '') + '<span>تحصّل من العميل <b>' + money(s.collected) + '</b></span></div>' : '') +
        '<div class="cm-btns"><a href="' + H(navUrl(o)) + '" target="_blank" rel="noopener">' + CI.nav + 'افتح الخريطة</a>' + (phone ? '<a href="tel:' + H(phone) + '">' + CI.phone + (toStore ? 'اتصل بالمطعم' : 'اتصل بالعميل') + '</a>' : '') +
        '<button type="button" onclick="openJob(\'' + o.id + '\')">' + CI.list + 'التفاصيل</button></div>' +
        (st ? '<button type="button" class="cm-main" data-step="' + st.k + '" data-id="' + o.id + '">' + st.t + '</button>' : '');
}
/* الدعم داخل التطبيق. أثناء طلب جارٍ: محادثة برقم الطلب، أو بلاغ سريع يصل للإدارة */
function openSupport() {
    const a = active();
    if (!a) { HWSupport.open(); return; }
    sheet('<div class="sh-head"><div><small dir="ltr">' + H(a.code) + '</small><h3>الدعم</h3></div></div><div class="sup-list">' +
        '<button type="button" onclick="closeSheet();HWSupport.open({order:\'' + H(a.code) + '\'})">راسل الدعم بخصوص هذا الطلب</button>' +
        '<button type="button" onclick="closeSheet();openIssue(\'' + a.id + '\')">الإبلاغ عن مشكلة في الطلب</button>' +
        '<a href="tel:' + H(CFG.opsPhone || '') + '">اتصال بمركز العمليات</a></div>' +
        '<button type="button" class="ghost-btn wide" onclick="closeSheet()">إغلاق</button>');
}
/* ---------- حد النقد: المستحق للشركة من الطلبات غير المسوّاة ---------- */
function cashLimit() { const c = HWBiz.setting('cash'); return c.limit != null ? +c.limit : (CFG.cashLimit != null ? CFG.cashLimit : 3); }
function dueNow() { return HWBiz.r2(mineOrders().filter(o => o.status === 'delivered' && !o.settledAt).reduce((n, o) => n + HWOrders.settle(o).due, 0)); }
function overLimit() { return dueNow() > cashLimit(); }
/* يُكتب على سجل الكابتن حتى تتخطاه لوحة الإدارة والخادم عند توزيع الطلبات */
function syncLimit() { if (!me || !caps.loaded()) return; const v = overLimit(), d = myDoc(); if (!!d.overLimit !== v) caps.patch(me.id, { overLimit: v }); }
/* ---------- الملاحة: خرائط Google دائمًا (بالإحداثيات إن وُجدت، وإلا بالاسم والعنوان) ---------- */
function navUrl(o) {
    const t = navTarget(o), ll = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(t) ? t : '';
    return ll ? 'https://www.google.com/maps/dir/?api=1&destination=' + ll + '&travelmode=driving' : HWOrders.openNav(t);
}
function renderJob() {
    const o = HWOrders.get(jobId); if (!o) { $('jobBody').innerHTML = '<div class="empty-orders">الطلب غير موجود</div>'; return; }
    const s = HWOrders.settle(o), st = nextStep(o), mk = HWOrders.isMarket(o);
    $('jobBody').innerHTML = '<div class="page-heading"><h1>' + H(o.code) + '</h1><p>' + H(o.storeName || o.from || '') + ' · ' + HWOrders.label(o) + '</p></div>' +
        (o.status === 'accepted' || o.status === 'picked' ? activeCard(o) : '') +
        (mk ? '<h3 class="sec-t">المنتجات</h3><div class="cart-card">' + o.items.map(l => '<div class="cl ro"><div class="cl-txt"><b>' + l.qty + '× ' + H(l.name) + '</b>' + (l.opts && l.opts.length ? '<small>' + H(HWBiz.optsText(l.opts)) + '</small>' : '') + (l.notes ? '<small>' + H(l.notes) + '</small>' : '') + '</div></div>').join('') + (o.notes ? '<p class="mut">ملاحظة: ' + H(o.notes) + '</p>' : '') + '</div>' : '') +
        '<h3 class="sec-t">الحساب</h3><div class="cart-card sum">' + (mk ? '<div><span>تدفع للمتجر</span><b>' + money2(s.items) + '</b></div><div><span>تحصّل من العميل</span><b>' + money2(s.collected) + '</b></div>' : '') + '<div><span>رسوم التوصيل</span><b>' + money2(s.fee) + '</b></div><div><span>عمولة المنصة (' + Math.round((CFG.commissionRate || .1) * 100) + '٪)</span><b>−' + money2(s.commission) + '</b></div><div class="tot"><span>صافي أرباحك</span><b>' + money2(s.net) + '</b></div></div>' +
        '<h3 class="sec-t">السجل</h3><div class="cart-card">' + HWOrders.timeline(o) + '</div>';
}

/* ---------- الأرباح ---------- */
/* "الحالي" = منذ آخر تسوية: بعد أن تسوّي الإدارة الحساب يبدأ من الصفر، والطلبات المسوّاة تبقى في اليوم/٧ أيام/الكل */
function earnList() { return mineOrders().filter(o => o.status === 'delivered' && (earnRange === 'open' ? !o.settledAt : inRange(o.updatedAt || o.createdAt))); }
function inRange(ts) {
    const d = new Date(ts), n = new Date();
    if (earnRange === 'today') return HWOrders.isToday(ts);
    if (earnRange === 'week') return n - d < 7 * 864e5;
    return true;
}
function renderEarn() {
    $('earnChips').innerHTML = [['open', 'الحالي'], ['today', 'اليوم'], ['week', '٧ أيام'], ['all', 'الكل']].map(r => '<button type="button" class="chip' + (earnRange === r[0] ? ' on' : '') + '" data-r="' + r[0] + '">' + r[1] + '</button>').join('');
    const list = earnList();
    const t = list.reduce((a, o) => { const s = HWOrders.settle(o); a.n++; a.col += s.collected; a.items += s.items; a.fee += s.fee; a.com += s.commission; a.net += s.net; return a; }, { n: 0, col: 0, items: 0, fee: 0, com: 0, net: 0 });
    $('earnBody').innerHTML = '<div class="eg-grid"><div class="eg hi" data-stat="net"><small>صافي أرباحك</small><b>' + money2(t.net) + '</b></div>' +
        '<div class="eg" data-stat="n"><small>طلبات مسلّمة</small><b>' + t.n + '</b></div><div class="eg" data-stat="fee"><small>رسوم التوصيل</small><b>' + money2(t.fee) + '</b></div>' +
        '<div class="eg" data-stat="col"><small>حصّلت من العملاء</small><b>' + money2(t.col) + '</b></div><div class="eg" data-stat="items"><small>دفعت للمطاعم</small><b>' + money2(t.items) + '</b></div>' +
        '<div class="eg warn" data-stat="com" style="grid-column:1/-1"><small>عمولة المنصة (' + Math.round((CFG.commissionRate || .1) * 100) + '٪ من التوصيل)</small><b>' + money2(t.com) + '</b></div></div>' +
        settleCard() +
        '<h3 class="sec-t">الطلبات</h3><div class="cart-card">' + (list.length ? list.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(o => '<div class="er"><div><b>' + H(o.storeName || o.from || '') + '</b><small>' + H(o.code) + ' · ' + HWOrders.ago(o.updatedAt || o.createdAt) + '</small></div><b>+' + money(earnOf(o)) + '</b></div>').join('') : '<p class="mut">لا توجد طلبات في هذه الفترة</p>') + '</div>';
}
/* تفاصيل بطاقات الأرباح (hw-stats.js): لكل رقم، من أين جاء طلبًا بطلب */
function statDetail(k) {
    const list = earnList().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const S = list.map(o => [o, HWOrders.settle(o)]), sum = f => S.reduce((a, x) => a + f(x[1]), 0);
    const per = { open: 'منذ آخر تسوية', today: 'اليوم', week: 'آخر ٧ أيام', all: 'كل الفترات' }[earnRange], m = v => money2(v);
    const km = list.reduce((a, o) => a + (Number(o.distKm || o.distance) || 0), 0);
    const it = (f) => S.map(x => HWStats.orderItem(x[0], m(f(x[1]))));
    const base = { sub: per, listTitle: 'لكل طلب' };
    if (k === 'net') return Object.assign(base, { title: 'صافي أرباحك', value: m(sum(s => s.net)), rows: [['رسوم التوصيل', m(sum(s => s.fee))], ['عمولة المنصة', '− ' + m(sum(s => s.commission))], ['متوسط الطلب', list.length ? m(sum(s => s.net) / list.length) : '—'], ['المسافة', km ? km.toFixed(1) + ' كم' : '—']], list: it(s => s.net) });
    if (k === 'n') { const byS = {}; list.forEach(o => { byS[o.storeName || o.from || '—'] = (byS[o.storeName || o.from || '—'] || 0) + 1; });
        return Object.assign(base, { title: 'طلبات مسلّمة', value: list.length, rows: Object.keys(byS).sort((a, b) => byS[b] - byS[a]).slice(0, 4).map(n => [n, byS[n] + ' طلب']), list: S.map(x => HWStats.orderItem(x[0], HWOrders.fmtTime(x[0].updatedAt || x[0].createdAt))) }); }
    if (k === 'fee') return Object.assign(base, { title: 'رسوم التوصيل', value: m(sum(s => s.fee)), rows: [['متوسط الرسوم', list.length ? m(sum(s => s.fee) / list.length) : '—'], ['أعلى رسوم', list.length ? m(Math.max.apply(null, S.map(x => x[1].fee))) : '—']], list: it(s => s.fee) });
    if (k === 'col') return Object.assign(base, { title: 'حصّلت من العملاء', value: m(sum(s => s.collected)), rows: [['قيمة الأصناف', m(sum(s => s.items))], ['رسوم التوصيل', m(sum(s => s.fee))]], list: it(s => s.collected) });
    if (k === 'items') return Object.assign(base, { title: 'دفعت للمطاعم', value: m(sum(s => s.items)), rows: [['عدد الطلبات', list.length]], list: it(s => s.items) });
    if (k === 'com') return Object.assign(base, { title: 'عمولة المنصة', value: m(sum(s => s.commission)), rows: [['النسبة', Math.round((CFG.commissionRate || .1) * 100) + '٪ من التوصيل'], ['من رسوم', m(sum(s => s.fee))]], list: it(s => s.commission) });
}
/* التسوية النقدية: ما لم تسلّمه للمنصة بعد (تُسجّلها الإدارة عند الاستلام) */
function settleCard() {
    const open = mineOrders().filter(o => o.status === 'delivered' && !o.settledAt);
    const due = HWBiz.r2(open.reduce((n, o) => n + HWOrders.settle(o).due, 0)), last = mineOrders().filter(o => o.settledAt).sort((a, b) => b.settledAt - a.settledAt)[0];
    return '<div class="settle' + (due > 0 ? ' due' : '') + '"><div><small>التسوية النقدية</small><b>' + (due > 0 ? 'عليك للمنصة ' + money2(due) : due < 0 ? 'لك عند المنصة ' + money2(-due) : 'لا يوجد مستحقات') + '</b>' +
        '<span>' + countTxt(open.length) + ' غير مسوّاة' + (last ? ' · آخر تسوية ' + new Date(last.settledAt).toLocaleDateString('ar-JO') : '') + '</span></div></div>';
}
function countTxt(n) { return n === 1 ? 'طلب واحد' : n === 2 ? 'طلبان' : n + ' طلبات'; }
function renderProfile() {
    $('pfGps').textContent = 'إلزامية أثناء الاتصال';
    const r = HWBiz.captainRating(me.id, orders);
    $('pfRate').textContent = r.n ? '★ ' + r.avg.toFixed(1) + ' (' + r.n + ')' : 'لا يوجد بعد';
}
function render() {
    if (!me) return;
    if (cur === 'screen-jobs') renderJobs(); else if (cur === 'screen-job') renderJob(); else if (cur === 'screen-earn') renderEarn(); else renderProfile();
    const a = active(), bar = $('liveBar'), show = !!a && cur !== 'screen-jobs';
    bar.classList.toggle('show', show); if (a) { $('lvTitle').textContent = (a.status === 'picked' ? 'في الطريق للعميل' : 'في الطريق للمتجر') + ' · ' + a.code; $('lvSub').textContent = a.storeName || a.from || ''; }
}
/* تنبيه "الطلب جاهز" من المطعم، وسؤال "وصلت؟" عند الاقتراب من المطعم أو العميل */
let readySeen = {}, askSeen = {};
function readyCheck() {
    const a = active(); if (!a || a.status !== 'accepted' || a.storeState !== 'ready' || readySeen[a.id]) return;
    readySeen[a.id] = 1; HWOrders.toast('✓ ' + (a.storeName || 'المتجر') + ': الطلب جاهز للاستلام'); HWNotify.play('status'); buzz([30, 60, 30]);
    HWNotify.notify('HIGHWAY · الطلب جاهز', (a.storeName || '') + ' جهّز الطلب ' + a.code);
}
function arriveCheck() {
    const a = active(); if (!a || !myPos) return;
    const toStore = a.status === 'accepted', tgt = toStore ? sLoc(a) : (a.address && a.address.lat != null ? a.address : null);
    if (!tgt || (toStore ? a.arrivedStore : a.arrivedCustomer)) return;
    const key = a.id + (toStore ? 's' : 'c'); if (askSeen[key]) return;
    if (HWMap.est(myPos, [tgt.lat, tgt.lng]) > .2) return;
    askSeen[key] = 1; buzz([20, 40, 20]); HWNotify.play('status');
    sheet('<div class="sh-head"><div><small>' + H(a.code) + '</small><h3>' + (toStore ? 'وصلت للمتجر؟' : 'وصلت للعميل؟') + '</h3></div></div>' +
        '<p class="mut">' + (toStore ? 'أنت قريب من ' + H(a.storeName || 'المتجر') : 'أنت قريب من عنوان ' + H((a.customer && a.customer.name) || 'العميل')) + (!toStore && a.address.note ? '<br><b><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4Z"/><path d="M8 9h8M8 12h5"/></svg> ' + H(a.address.note) + '</b>' : '') + '</p>' +
        '<div class="btn-row"><button type="button" class="submit-btn" data-step="' + (toStore ? 'arrS' : 'arrC') + '" data-id="' + a.id + '" onclick="closeSheet()"><span class="btn-label">نعم، وصلت</span></button><button type="button" class="ghost-btn" onclick="closeSheet()">ليس بعد</button></div>');
}
function onOrders(l) {
    orders = l; if (!me) return;
    const ids = offers().map(o => o.id).sort().join(',');
    if (prevOffers !== null && ids !== prevOffers) { const old = prevOffers.split(','); if (ids.split(',').some(x => x && old.indexOf(x) < 0)) { HWOrders.toast('طلب جديد متاح'); HWNotify.notify('HIGHWAY · طلب جديد', 'لديك عرض توصيل جديد'); } }
    prevOffers = ids; saveSeen(); readyCheck();
    if (ids && !active()) HWNotify.ring('offer', 'offer', 3000); else HWNotify.stop('offer');   /* يرن حتى يقبل الكابتن أو يرفض أو تنتهي المهلة */
    const a = mineOrders().filter(o => o.status === 'cancelled' && !seen['c' + o.id] && Date.now() - o.updatedAt < 6e5)[0];
    if (a) { seen['c' + a.id] = 1; HWOrders.toast('تم إلغاء الطلب ' + a.code); HWNotify.play('alert'); buzz(40); }
    render();
}

document.addEventListener('click', (e) => {
    let el;
    if ((el = e.target.closest('[data-take]'))) { takeOffer(el.dataset.take); return; }
    if ((el = e.target.closest('[data-dec]'))) { declineOffer(el.dataset.dec); return; }
    if ((el = e.target.closest('[data-step]'))) { stepAction(el.dataset.step, el.dataset.id); return; }
    if ((el = e.target.closest('#earnChips .chip'))) { earnRange = el.dataset.r; renderEarn(); return; }
    if ((el = e.target.closest('.iss .chip'))) { document.querySelectorAll('.iss .chip').forEach(c => c.classList.toggle('on', c === el)); buzz(); return; }
});
try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
window.addEventListener('pageshow', (e) => { window.scrollTo(0, 0); if (e.persisted) location.reload(); });

window.HWNotifyAskPerm = true;
/* عند عودة التطبيق للواجهة: تحديث "آخر ظهور" فورًا ليبقى الكابتن ضمن المتاحين، ثم الإسناد */
document.addEventListener('visibilitychange', () => {
    if (document.hidden || !me || !isOnline()) return;
    caps.patch(me.id, { lastSeen: Date.now() }); HWNotify.keepAwake(true);
    setTimeout(() => { try { selfDispatch(); } catch (e) {} render(); }, 300);
});
document.addEventListener('DOMContentLoaded', () => {
    buildSplashIcons();
    $('demoBanner').style.display = HWDB.mode === 'local' ? '' : 'none';
    const saved = readJSON(KEY, null);
    applyUser(saved && saved.id ? saved : null);
    if (saved && saved.id) setTimeout(() => { ensureMap(); startGps(false); renderMapLayers(true); }, 600);
    const splash = $('splash'); let skip = false;
    try { skip = sessionStorage.getItem('hw-skip-splash') === '1'; sessionStorage.removeItem('hw-skip-splash'); } catch (e) {}
    if (!saved) skip = false;
    if (skip) { splash.style.transition = 'none'; splash.classList.add('hide'); }
    introCtl = skip ? null : initIntroVideo();
    $('loginForm').addEventListener('submit', submitLogin);
    $('enterBtn').addEventListener('click', () => { if (me) finishLogin(); else openLogin(); });
    caps.subscribe(() => { if (me) { checkAccount(); render(); fillAv(); syncGpsMode(); } }); HWBiz.onMedia(() => { if (me) fillAv(); });
    stState.subscribe(() => { if (me) render(); }); HWBiz.storesCol.subscribe(() => { if (me) render(); });
    HWBiz.targets.subscribe(() => { if (me) render(); }); HWBiz.announcementsCol.subscribe(() => { if (me) render(); });
    settingsCol.subscribe(l => { const d = l.filter(x => x.id === 'dispatch')[0]; autoMode = !d || d.auto !== false; if (me) render(); });
    HWOrders.subscribe(onOrders);
    HWPush.init('captain', () => me && me.id, { open: () => { if (me) tabGo('screen-jobs'); } });
    showScreen('screen-jobs');
    /* كل ثانية: عدّاد العرض يتناقص على زر القبول، وإعادة الرسم عند تغيّر الحالة */
    let lastMode = '';
    setInterval(() => {
        if (document.hidden || !me) return;
        syncLimit();
        const mode = capMode(); if (mode !== 'offer') HWNotify.stop('offer');
        if (cur !== 'screen-jobs') return;
        if (mode !== lastMode) { lastMode = mode; render(); return; }
        const btn = document.querySelector('.cm-acc'); if (!btn) return;
        const lim = (CFG.offerSeconds || 45) * 1000, oo = HWOrders.get(btn.dataset.take), t0 = oo && oo.offerTo === me.id ? oo.offerAt : +btn.dataset.t0;
        const left = Math.max(0, Math.ceil((lim - (Date.now() - t0)) / 1000));
        btn.querySelector('.fill').style.width = (100 * left / (lim / 1000)) + '%'; btn.querySelector('em').textContent = left + ' ث';
        if (!left) render();
    }, 1000);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); if (splash.classList.contains('login-mode') && !splash.classList.contains('hide')) closeLogin(); } });
});
