package __PACKAGE_NAME__.callkeep

import android.app.Activity
import android.content.Intent
import android.view.WindowManager
import com.facebook.react.ReactActivity
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

  fun handleIntent(activity: ReactActivity, intent: Intent?) {
    val callUuid = intent?.getStringExtra("callUUID") ?: return
    emitCallUuid(activity.reactNativeHost.reactInstanceManager, callUuid)
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
}
