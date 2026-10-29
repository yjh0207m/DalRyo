package com.dalryo.app

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.*
import android.os.*
import android.util.AtomicFile
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.*

// No JS timer or Firebase connection is needed to record a foreground run.
// AtomicFile is private to this app (backup is disabled in the manifest).
object RunJournal {
  private var loaded = false
  private var state: JSONObject? = null
  private var activeSince: Long? = null
  private var lastFix: Location? = null
  private var rejected = 0
  private var lastReceived = 0L
  private fun file(context: Context) = AtomicFile(File(context.filesDir, "active-run-v1.json"))
  fun load(context: Context): JSONObject? {
    if (!loaded) {
      val disk = file(context)
      if (disk.baseFile.exists() || File(disk.baseFile.path + ".bak").exists()) {
        // Do not silently overwrite an unreadable journal with a new run.
        state = JSONObject(String(disk.readFully(), Charsets.UTF_8))
        loaded = true
        if (state!!.getString("phase") == "running") {
          state!!.put("phase", "paused").put("interrupted", true).put("speedKmh", 0)
          persist(context)
        }
      }
      loaded = true
    }
    return state
  }
  private fun elapsed(): Long = (state?.optLong("elapsedMs") ?: 0) + (activeSince?.let { SystemClock.elapsedRealtime() - it } ?: 0)
  fun snapshot(context: Context): JSONObject? {
    val s = load(context) ?: return null
    return JSONObject(s.toString()).put("updatedAtMs", System.currentTimeMillis()).put("elapsedMs", elapsed()).put("speedKmh", if (SystemClock.elapsedRealtime() - lastReceived > 5000) 0 else s.optDouble("speedKmh"))
  }
  fun persist(context: Context) {
    val s = state ?: return
    val copy = JSONObject(s.toString()).put("elapsedMs", elapsed()).put("updatedAtMs", System.currentTimeMillis())
    val disk = file(context)
    val stream = disk.startWrite()
    try { stream.write(copy.toString().toByteArray(Charsets.UTF_8)); disk.finishWrite(stream) }
    catch (error: Exception) { disk.failWrite(stream); throw error }
  }
  fun begin(context: Context, metadata: JSONObject): JSONObject {
    val existing = load(context)
    if (existing != null) {
      if (existing.getJSONObject("context").optString("sessionKey") == metadata.optString("sessionKey")) return snapshot(context)!!
      error("먼저 남아 있는 달리기를 복구하거나 저장해 주세요.")
    }
    state = JSONObject().put("version", 1).put("context", metadata).put("phase", "running")
      .put("startedAtMs", System.currentTimeMillis()).put("elapsedMs", 0).put("distanceKm", 0)
      .put("route", JSONArray()).put("speedKmh", 0).put("gpsStatus", "tracking")
    activeSince = SystemClock.elapsedRealtime(); lastFix = null; rejected = 0
    persist(context)
    return snapshot(context)!!
  }
  fun owned(context: Context, uid: String, startedAt: Double): JSONObject {
    val s = load(context) ?: error("진행 중인 기록이 없어요.")
    check(s.getJSONObject("context").getString("uid") == uid && s.getLong("startedAtMs") == startedAt.toLong()) { "달리기 계정이나 세션이 달라요." }
    return s
  }
  fun command(context: Context, uid: String, startedAt: Double, action: String): JSONObject? {
    val s = owned(context, uid, startedAt)
    when (action) {
      "pause", "finish" -> {
        s.put("elapsedMs", elapsed()).put("phase", if (action == "finish") "finished" else "paused").put("speedKmh", 0)
        activeSince = null; lastFix = null
      }
      "resume" -> {
        check(s.getString("phase") != "finished") { "이미 종료한 기록이에요." }
        if (s.getString("phase") != "running") { activeSince = SystemClock.elapsedRealtime(); lastFix = null; rejected = 0 }
        s.put("phase", "running").put("interrupted", false)
      }
      "clear" -> {state = null; activeSince = null; lastFix = null; file(context).delete(); return null}
      else -> error("알 수 없는 요청이에요.")
    }
    persist(context)
    return snapshot(context)
  }
  fun gpsStatus(context: Context, value: String) { state?.put("gpsStatus", value); persist(context) }
  fun location(context: Context, fix: Location) {
    val s = state ?: return
    if (s.getString("phase") != "running" || !fix.hasAccuracy() || fix.accuracy > 25 || fix.accuracy < 0 || !fix.latitude.isFinite() || !fix.longitude.isFinite()) return
    val age = SystemClock.elapsedRealtimeNanos() - fix.elapsedRealtimeNanos
    if (age < 0 || age > 15_000_000_000L) return
    val previous = lastFix
    if (previous != null) {
      val dt = (fix.elapsedRealtimeNanos - previous.elapsedRealtimeNanos) / 1_000_000_000.0
      if (dt <= 0) return
      val step = previous.distanceTo(fix) / 1000.0
      // Never join a long GPS outage with an invented straight-line distance.
      if (dt > 30) { lastFix = null; s.put("speedKmh", 0) }
      else {
        val implied = step / (dt / 3600)
        if (implied > 45) {
          rejected++
          if (rejected >= 3) { lastFix = fix; rejected = 0 }
          return
        }
        rejected = 0
        s.put("distanceKm", s.getDouble("distanceKm") + step)
        val speed = if (fix.hasSpeed() && fix.speed > 0) min(45.0, fix.speed * 3.6) else implied
        s.put("speedKmh", s.optDouble("speedKmh") * 0.6 + speed * 0.4)
      }
    }
    lastFix = Location(fix); lastReceived = SystemClock.elapsedRealtime()
    s.put("gpsStatus", "tracking")
    val route = s.getJSONArray("route")
    val last = if (route.length() > 0) route.getJSONObject(route.length() - 1) else null
    val delta = FloatArray(1)
    if (last != null) Location.distanceBetween(last.getDouble("lat"), last.getDouble("lng"), fix.latitude, fix.longitude, delta)
    if (last == null || delta[0] >= 5) {
      // Keep the complete duration/distance while bounding Firestore document size.
      if (route.length() >= 6000) {
        val reduced = JSONArray()
        for (i in 0 until route.length() step 2) reduced.put(route.getJSONObject(i))
        s.put("route", reduced)
      }
      s.getJSONArray("route").put(JSONObject().put("lat", fix.latitude).put("lng", fix.longitude).put("timestamp", fix.time))
    }
    persist(context)
  }
}

class RunTrackingService : Service(), LocationListener {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var locations: LocationManager
  private val checkpoint = object : Runnable {
    override fun run() {
      try { RunJournal.persist(this@RunTrackingService); notifyRun() }
      catch (_: Exception) { stopSelf() }
      handler.postDelayed(this, 5000)
    }
  }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onCreate() {super.onCreate(); locations = getSystemService(LOCATION_SERVICE) as LocationManager}
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val state = RunJournal.snapshot(this)
      if (state?.optString("phase") != "running") {stopSelf(); return START_NOT_STICKY}
      val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("active_run", "진행 중인 달리기", NotificationManager.IMPORTANCE_LOW))
      if (Build.VERSION.SDK_INT >= 29) startForeground(4107, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      else startForeground(4107, notification())
      locations.removeUpdates(this)
      // GPS callbacks and persistence run on the native main looper, independent of React.
      locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 3f, this, Looper.getMainLooper())
      if (locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000L, 3f, this, Looper.getMainLooper())
      handler.removeCallbacks(checkpoint); handler.post(checkpoint)
    } catch (_: Exception) {
      val s = RunJournal.snapshot(this)
      if (s != null) {RunJournal.command(this, s.getJSONObject("context").getString("uid"), s.getDouble("startedAtMs"), "pause"); RunJournal.gpsStatus(this, "error")}
      stopSelf()
    }
    return START_NOT_STICKY
  }
  private fun notification(): Notification {
    val s = RunJournal.snapshot(this)
    val seconds = (s?.optLong("elapsedMs") ?: 0) / 1000
    val launch = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return NotificationCompat.Builder(this, "active_run").setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("달료 · 달리기 기록 중")
      .setContentText(String.format(java.util.Locale.KOREA, "%.2fkm · %d분 %02d초 · 눌러서 돌아가기", s?.optDouble("distanceKm") ?: 0.0, seconds / 60, seconds % 60))
      .setContentIntent(PendingIntent.getActivity(this, 4107, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      .setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build()
  }
  private fun notifyRun() {(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(4107, notification())}
  override fun onLocationChanged(location: Location) {try {RunJournal.location(this, location)} catch (_: Exception) {stopSelf()}}
  override fun onProviderDisabled(provider: String) {if (provider == LocationManager.GPS_PROVIDER) RunJournal.gpsStatus(this, "error")}
  override fun onProviderEnabled(provider: String) { }
  @Deprecated("Deprecated by Android") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) { }
  override fun onDestroy() {
    locations.removeUpdates(this); handler.removeCallbacks(checkpoint)
    try {
      val s = RunJournal.snapshot(this)
      if (s?.optString("phase") == "running") RunJournal.command(this, s.getJSONObject("context").getString("uid"), s.getDouble("startedAtMs"), "pause")
    } catch (_: Exception) { }
    stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy()
  }
}

class RunTrackingModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "RunTracking"
  private fun run(promise: Promise, action: () -> Any?) {
    UiThreadUtil.runOnUiThread {
      try {promise.resolve(action())} catch (error: Exception) {promise.reject("RUN_TRACKING", error.message, error)}
    }
  }
  private fun ensureForegroundLocation() {
    check(context.currentActivity != null) { "앱 화면에서 달리기를 시작해 주세요." }
    check(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) { "정확한 위치 권한이 필요해요." }
  }
  @ReactMethod fun current(uid: String, promise: Promise) = run(promise) {
    val s = RunJournal.snapshot(context)
    if (s?.getJSONObject("context")?.optString("uid") == uid) s.toString() else null
  }
  @ReactMethod fun start(metadata: String, promise: Promise) = run(promise) {
    ensureForegroundLocation()
    val result = RunJournal.begin(context, JSONObject(metadata))
    try {ContextCompat.startForegroundService(context, Intent(context, RunTrackingService::class.java))}
    catch (error: Exception) {RunJournal.command(context, result.getJSONObject("context").getString("uid"), result.getDouble("startedAtMs"), "pause"); throw error}
    result.toString()
  }
  @ReactMethod fun command(uid: String, startedAt: Double, action: String, promise: Promise) = run(promise) {
    if (action == "resume") ensureForegroundLocation()
    val result = RunJournal.command(context, uid, startedAt, action)
    if (action == "resume") {
      try {ContextCompat.startForegroundService(context, Intent(context, RunTrackingService::class.java))}
      catch (error: Exception) {RunJournal.command(context, uid, startedAt, "pause"); throw error}
    } else context.stopService(Intent(context, RunTrackingService::class.java))
    result?.toString()
  }
}
class RunTrackingPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(RunTrackingModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
