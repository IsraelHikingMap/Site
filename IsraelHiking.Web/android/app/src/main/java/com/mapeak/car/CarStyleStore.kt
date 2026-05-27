package com.mapeak.car

import android.content.Context

class CarStyleStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun save(styleJson: String) {
        prefs.edit().putString(KEY_STYLE, styleJson).apply()
    }

    fun load(): String? = prefs.getString(KEY_STYLE, null)

    companion object {
        private const val PREFS_NAME = "mapeak_car"
        private const val KEY_STYLE = "last_style"
    }
}
