package com.rkgroup.qcall

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.rkgroup.qcall.messages.DefaultSmsModule // 🟢 Important: Points to the isolated folder!
import java.util.Collections

class CallManagerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        val modules = ArrayList<NativeModule>()
        
        modules.add(CallManagerModule(reactContext)) 
        modules.add(DefaultSmsModule(reactContext))  // 🟢 One powerful module handles it all
        
        return modules
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return Collections.emptyList()
    }
}