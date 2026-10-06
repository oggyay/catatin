package com.example.catatin.data.api

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "catatin_prefs")

class TokenManager(private val context: Context) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("jwt_token")
        private val PHONE_KEY = stringPreferencesKey("wa_phone")
    }

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[TOKEN_KEY] }

    suspend fun getToken(): String? = tokenFlow.firstOrNull()

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun clearToken() {
        context.dataStore.edit { it.remove(TOKEN_KEY) }
    }

    suspend fun savePhone(phone: String) {
        context.dataStore.edit { it[PHONE_KEY] = phone }
    }

    suspend fun getPhone(): String? {
        return context.dataStore.data.map { it[PHONE_KEY] }.firstOrNull()
    }

    suspend fun clearPhone() {
        context.dataStore.edit { it.remove(PHONE_KEY) }
    }
}
