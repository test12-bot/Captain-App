/* =========================================================
   HIGHWAY — جسر التطبيق الحقيقي (hw-native.js)
   داخل تطبيق أندرويد (Capacitor) يتوفر موقع مستمر في الخلفية والشاشة مقفلة،
   مع إشعار ثابت "أنت متصل" طوال الوردية. في المتصفح يبقى كل شيء كما هو.
   ========================================================= */
(function (g) {
  var C = g.Capacitor, ua = navigator.userAgent || '';
  var native = !!(C && C.isNativePlatform && C.isNativePlatform());
  var BG = null;
  try { if (native && C.registerPlugin) BG = C.registerPlugin('BackgroundGeolocation'); } catch (e) {}
  var where = native ? 'app' : /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'web';
  g.HWNative = {
    is: native, where: where, bg: !!BG,
    /* موقع مستمر في الخلفية: onPos({lat,lng,acc}) و onErr('denied'|'other') */
    watch: function (onPos, onErr) {
      if (!BG) return null;
      var id = null, stopped = false;
      BG.addWatcher({ backgroundTitle: 'HIGHWAY · أنت متصل', backgroundMessage: 'نشارك موقعك مع مركز العمليات طوال الوردية', requestPermissions: true, stale: false, distanceFilter: 10 },
        function (loc, err) {
          if (err) { onErr(err.code === 'NOT_AUTHORIZED' ? 'denied' : 'other'); return; }
          if (loc) onPos({ lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy || 0 });
        }).then(function (x) { id = x; if (stopped) BG.removeWatcher({ id: id }); }).catch(function () { onErr('other'); });
      return { stop: function () { stopped = true; if (id) BG.removeWatcher({ id: id }); } };
    },
    openSettings: function () { if (BG && BG.openSettings) BG.openSettings(); },
    /* رسالة السماح بالموقع حسب الجهاز */
    locHelp: function () {
      return where === 'app' ? 'اسمح لتطبيق HIGHWAY Captain بالموقع: الإعدادات ← التطبيقات ← HIGHWAY Captain ← الأذونات ← الموقع ← السماح دائمًا'
        : where === 'android' ? 'اسمح بالموقع: اضغط على القفل بجانب الرابط أعلى Chrome ← الأذونات ← الموقع ← السماح'
        : where === 'ios' ? 'اسمح بالموقع: الإعدادات ← Safari ← الموقع ← السماح'
        : 'اسمح للمتصفح بالوصول إلى موقعك من إعدادات الموقع';
    }
  };
  if (native) document.documentElement.classList.add('hw-app');
})(window);
