package com.example.catatin

import android.app.Application
import com.example.catatin.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class CatatinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@CatatinApp)
            modules(appModule)
        }
    }
}
