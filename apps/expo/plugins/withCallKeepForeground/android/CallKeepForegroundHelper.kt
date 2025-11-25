package __PACKAGE_NAME__.callkeep

import android.app.Activity
import android.content.Intent
import android.view.WindowManager
import android.os.Handler
import android.os.Looper
import android.app.ActivityManager
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter

object CallKeepForegroundHelper {
  private const val EVENT_NAME = "CallKeepAnswerCallUUID"

  fun applyWindowFlags(activity: Activity) {
    activity.window?.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )
  }

  fun handleIntent(activity: Activity, intent: Intent?) {
    val callUuid = intent?.getStringExtra("callUUID") ?: return
    val reactInstanceManager = getReactInstanceManager(activity) ?: return
    emitCallUuid(reactInstanceManager, callUuid)
    bringTaskToFront(activity)
  }

  private fun getReactInstanceManager(activity: Activity): ReactInstanceManager? {
    val reactApp = activity.application as? ReactApplication ?: return null
    return reactApp.reactNativeHost.reactInstanceManager
  }

  private fun emitCallUuid(reactInstanceManager: ReactInstanceManager, callUuid: String) {
    val currentContext: ReactContext? = reactInstanceManager.currentReactContext

    val emit: (ReactContext) -> Unit = { context ->
      context
        .getJSModule(RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, Arguments.createMap().apply { putString("callUUID", callUuid) })
    }

    if (currentContext != null) {
      emit(currentContext)
      return
    }

    reactInstanceManager.addReactInstanceEventListener(object :
      ReactInstanceManager.ReactInstanceEventListener {
      override fun onReactContextInitialized(context: ReactContext) {
        reactInstanceManager.removeReactInstanceEventListener(this)
        emit(context)
      }
    })

    if (!reactInstanceManager.hasStartedCreatingInitialContext()) {
      reactInstanceManager.createReactContextInBackground()
    }
  }

  private fun bringTaskToFront(activity: Activity) {
    val appContext = activity.applicationContext
    val launchIntent = appContext.packageManager.getLaunchIntentForPackage(appContext.packageName)
      ?: return

    launchIntent.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_SINGLE_TOP or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
    )

    appContext.startActivity(launchIntent)

    val activityManager = appContext.getSystemService(ActivityManager::class.java)
    activityManager?.appTasks?.firstOrNull()?.moveToFront()

    // Xiaomi/MIUI sometimes steals focus back; refocus shortly after
    Handler(Looper.getMainLooper()).postDelayed({
      appContext.startActivity(launchIntent)
      activityManager?.appTasks?.firstOrNull()?.moveToFront()
    }, 800)
  }
}
